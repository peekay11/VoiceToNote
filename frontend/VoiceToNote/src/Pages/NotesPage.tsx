import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import SearchBar from "../Components/SearchBar.tsx";
import VoiceRec from "../Components/VoiceRec.tsx";
import NoteCard, { type NoteItem } from "../Components/NoteCard.tsx";
import { fetchNotes, type Note } from "../services/api.ts";
import { useAuth } from "../context/AuthContext.tsx";
import notesFallback from "../Components/Notes.json";

function transformNote(note: Note): NoteItem {
  const words = (note.text || "").trim().split(/\s+/);
  const title = words.length > 5 ? words.slice(0, 5).join(" ") + "..." : words.join(" ") || "Voice Note";

  return {
    id: note.noteId,
    title: title,
    status: note.status || "Planned",
    todos: [],
    context: note.text || "",
    createdAt: note.createdAt,
  };
}

const NotesPage = () => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [searchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const apiNotes = await fetchNotes();
      if (apiNotes && apiNotes.length > 0) {
        setNotes(apiNotes.map(transformNote));
      } else {
        const formattedFallback: NoteItem[] = notesFallback.notes.map((n) => ({
          id: String(n.id),
          title: n.title,
          status: n.status,
          todos: n.todos,
          context: n.context,
        }));
        setNotes(formattedFallback);
      }
    } catch {
      const formattedFallback: NoteItem[] = notesFallback.notes.map((n) => ({
        id: String(n.id),
        title: n.title,
        status: n.status,
        todos: n.todos,
        context: n.context,
      }));
      setNotes(formattedFallback);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const filteredNotes = notes.filter((n) => {
    const query = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(query) ||
      n.context.toLowerCase().includes(query) ||
      n.status.toLowerCase().includes(query)
    );
  });

  return (
    <>
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

      <div id="top-section">
        <SearchBar />
        <VoiceRec onUploadSuccess={() => {
          setTimeout(loadNotes, 4000);
          setTimeout(loadNotes, 8000);
        }} />
      </div>

      {loading && <p style={{ color: "#64748b", textAlign: "center" }}>Loading notes...</p>}

      <div id="notes" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {filteredNotes.map((note) => (
          <Link
            to={`/note/${note.id}`}
            key={note.id}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <NoteCard note={note} />
          </Link>
        ))}
      </div>
    </>
  );
};

export default NotesPage;
