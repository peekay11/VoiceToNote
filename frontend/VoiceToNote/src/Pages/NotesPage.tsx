import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import SearchBar from "../Components/SearchBar.tsx";
import VoiceRec from "../Components/VoiceRec.tsx";
import NoteCard, { type NoteItem } from "../Components/NoteCard.tsx";
import ProcessingCard from "../Components/ProcessingCard.tsx";
import { fetchNotes, deleteNote, type Note } from "../services/api.ts";
import { useAuth } from "../context/AuthContext.tsx";
import { useTheme } from "../context/ThemeContext.tsx";
import notesFallback from "../Components/Notes.json";
import {
  RiMoonLine,
  RiSunLine,
  RiLogoutBoxLine,
  RiDeleteBin6Line,
  RiTimeLine,
  RiCheckboxCircleLine,
} from "react-icons/ri";
import "./NotesPage.css";

function transformNote(note: Note): NoteItem {
  const words = (note.text || "").trim().split(/\s+/);
  const title =
    words.length > 5 ? words.slice(0, 5).join(" ") + "..." : words.join(" ") || "Voice Note";
  return {
    id: note.noteId,
    title,
    status: note.status || "Planned",
    todos: [],
    context: note.text || "",
    createdAt: note.createdAt,
  };
}

const NotesPage = () => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [isLiveData, setIsLiveData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingCards, setPendingCards] = useState<string[]>([]);
  const knownNoteIdsRef = useRef<Set<string>>(new Set());
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const apiNotes = await fetchNotes();
      if (apiNotes && apiNotes.length > 0) {
        const transformed = apiNotes.map(transformNote);
        // Count how many NEW note IDs arrived — remove that many pending cards
        const newIds = transformed.filter((n) => !knownNoteIdsRef.current.has(n.id));
        if (newIds.length > 0) {
          knownNoteIdsRef.current = new Set(transformed.map((n) => n.id));
          setPendingCards((prev) => prev.slice(newIds.length));
        } else {
          knownNoteIdsRef.current = new Set(transformed.map((n) => n.id));
        }
        setNotes(transformed);
        setIsLiveData(true);
      } else {
        const fallback: NoteItem[] = notesFallback.notes.map((n) => ({
          id: String(n.id),
          title: n.title,
          status: n.status,
          todos: n.todos,
          context: n.context,
        }));
        setNotes(fallback);
        setIsLiveData(false);
      }
    } catch {
      const fallback: NoteItem[] = notesFallback.notes.map((n) => ({
        id: String(n.id),
        title: n.title,
        status: n.status,
        todos: n.todos,
        context: n.context,
      }));
      setNotes(fallback);
      setIsLiveData(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleDelete = async (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    if (!window.confirm("Delete this note?")) return;
    try {
      await deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      alert("Failed to delete. Please try again.");
    }
  };

  const filteredNotes = notes.filter((n) => {
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.context.toLowerCase().includes(q) ||
      n.status.toLowerCase().includes(q)
    );
  });

  const planned = filteredNotes.filter(
    (n) => n.status.toLowerCase() !== "done" && n.status.toLowerCase() !== "completed"
  );
  const done = filteredNotes.filter(
    (n) => n.status.toLowerCase() === "done" || n.status.toLowerCase() === "completed"
  );

  return (
    <div className="notes-page">
      {/* Navbar */}
      <header className="navbar">
        <div className="navbar-brand">
          <span className="brand-dot" />
          <span className="brand-name">VoiceToNote</span>
        </div>
        <div className="navbar-actions">
          <span className="navbar-user">{user?.email}</span>
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <RiSunLine size={18} /> : <RiMoonLine size={18} />}
          </button>
          <button className="icon-btn icon-btn--danger" onClick={logout} title="Sign out">
            <RiLogoutBoxLine size={18} />
          </button>
        </div>
      </header>

      {/* Search + Record toolbar */}
      <div className="toolbar">
        <SearchBar onSearch={setSearchQuery} />
        <VoiceRec
          onUploadSuccess={() => {
            // Add a processing placeholder card immediately
            setPendingCards((prev) => [...prev, `pending-${Date.now()}`]);
            setTimeout(loadNotes, 4000);
            setTimeout(loadNotes, 8000);
          }}
        />
      </div>

      <main className="notes-main">
        {loading && (
          <div className="loading-state">
            <span className="loading-spinner" />
            <p>Loading notes...</p>
          </div>
        )}

        {/* Planned section */}
        {(planned.length > 0 || pendingCards.length > 0) && (
          <section className="notes-section">
            <h2 className="section-header section-header--planned">
              <RiTimeLine size={14} />
              Planned <span className="count-badge">{planned.length + pendingCards.length}</span>
            </h2>
            <div className="notes-grid">
              {/* Processing placeholder cards */}
              {pendingCards.map((id) => (
                <ProcessingCard key={id} />
              ))}
              {planned.map((note) => (
                <div key={note.id} className="note-card-wrapper">
                  <Link
                    to={`/note/${note.id}`}
                    style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
                  >
                    <NoteCard note={note} />
                  </Link>
                  {isLiveData && (
                    <button
                      className="delete-btn"
                      onClick={(e) => handleDelete(e, note.id)}
                      title="Delete note"
                    >
                      <RiDeleteBin6Line size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Done section */}
        {done.length > 0 && (
          <section className="notes-section">
            <h2 className="section-header section-header--done">
              <RiCheckboxCircleLine size={14} />
              Done <span className="count-badge count-badge--done">{done.length}</span>
            </h2>
            <div className="notes-grid">
              {done.map((note) => (
                <div key={note.id} className="note-card-wrapper">
                  <Link
                    to={`/note/${note.id}`}
                    style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
                  >
                    <NoteCard note={note} />
                  </Link>
                  {isLiveData && (
                    <button
                      className="delete-btn"
                      onClick={(e) => handleDelete(e, note.id)}
                      title="Delete note"
                    >
                      <RiDeleteBin6Line size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && filteredNotes.length === 0 && (
          <div className="empty-state">
            <p>No notes yet. Press <strong>Rec</strong> to record your first voice note!</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default NotesPage;
