import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import SearchBar from "../Components/SearchBar.tsx";
import VoiceRec from "../Components/VoiceRec.tsx";
import NoteCard, { type NoteItem } from "../Components/NoteCard.tsx";
import { fetchNotes, deleteNote, type Note } from "../services/api.ts";
import { useAuth } from "../context/AuthContext.tsx";
import notesFallback from "../Components/Notes.json";

function transformNote(note: Note): NoteItem {
  const words = (note.text || "").trim().split(/\s+/);
  const title = words.length > 5 ? words.slice(0, 5).join(" ") + "..." : words.join(" ") || "Voice Note";
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
  const { user, logout } = useAuth();

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const apiNotes = await fetchNotes();
      if (apiNotes && apiNotes.length > 0) {
        setNotes(apiNotes.map(transformNote));
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

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const handleDelete = async (e: React.MouseEvent, noteId: string) => {
    e.preventDefault(); // prevent Link navigation
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

  const planned = filteredNotes.filter((n) => n.status.toLowerCase() !== "done" && n.status.toLowerCase() !== "completed");
  const done = filteredNotes.filter((n) => n.status.toLowerCase() === "done" || n.status.toLowerCase() === "completed");

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <span style={{ fontSize: "14px", color: "#64748b" }}>Logged in as: </span>
          <strong>{user?.email}</strong>
        </div>
        <button
          onClick={logout}
          style={{
            background: "transparent",
            border: "1px solid #cbd5e1",
            padding: "6px 12px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
            color: "#475569",
          }}
        >
          Sign Out
        </button>
      </div>

      {/* Record + Search */}
      <div id="top-section">
        <SearchBar onSearch={setSearchQuery} />
        <VoiceRec onUploadSuccess={() => {
          setTimeout(loadNotes, 4000);
          setTimeout(loadNotes, 8000);
        }} />
      </div>

      {loading && <p style={{ color: "#64748b", textAlign: "center", marginTop: "20px" }}>Loading notes...</p>}

      {/* Planned Column */}
      {planned.length > 0 && (
        <section style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#2563eb", marginBottom: "12px" }}>
            📋 Planned ({planned.length})
          </h2>
          <div id="notes" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {planned.map((note) => (
              <div key={note.id} style={{ position: "relative" }}>
                <Link to={`/note/${note.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <NoteCard note={note} />
                </Link>
                {isLiveData && (
                  <button
                    onClick={(e) => handleDelete(e, note.id)}
                    title="Delete note"
                    style={deleteChipStyle}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Done Column */}
      {done.length > 0 && (
        <section style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#16a34a", marginBottom: "12px" }}>
            ✅ Done ({done.length})
          </h2>
          <div id="notes" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {done.map((note) => (
              <div key={note.id} style={{ position: "relative" }}>
                <Link to={`/note/${note.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <NoteCard note={note} />
                </Link>
                {isLiveData && (
                  <button
                    onClick={(e) => handleDelete(e, note.id)}
                    title="Delete note"
                    style={deleteChipStyle}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && filteredNotes.length === 0 && (
        <p style={{ color: "#94a3b8", textAlign: "center", marginTop: "40px" }}>
          No notes yet. Press <strong>Rec</strong> to record your first voice note!
        </p>
      )}
    </>
  );
};

const deleteChipStyle: React.CSSProperties = {
  position: "absolute",
  top: "10px",
  right: "10px",
  background: "#fee2e2",
  color: "#b91c1c",
  border: "none",
  borderRadius: "50%",
  width: "24px",
  height: "24px",
  fontSize: "12px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};

export default NotesPage;
