import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import notesData from "../Components/Notes.json";
import { fetchNotes, updateNote, deleteNote, type Note } from "../services/api.ts";
import { type NoteItem } from "../Components/NoteCard.tsx";
import { useTheme } from "../context/ThemeContext.tsx";
import {
  RiArrowLeftLine,
  RiEditLine,
  RiDeleteBin6Line,
  RiCheckLine,
  RiTimeLine,
  RiMoonLine,
  RiSunLine,
} from "react-icons/ri";
import "./NotesDetail.css";

const NotesDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [note, setNote] = useState<NoteItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiveNote, setIsLiveNote] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    async function getNote() {
      try {
        const apiNotes = await fetchNotes();
        const matchedApiNote = apiNotes.find((n: Note) => n.noteId === id);
        if (matchedApiNote) {
          const words = (matchedApiNote.text || "").trim().split(/\s+/);
          const title =
            words.length > 5 ? words.slice(0, 5).join(" ") + "..." : words.join(" ") || "Voice Note";
          const noteItem: NoteItem = {
            id: matchedApiNote.noteId,
            title,
            status: matchedApiNote.status,
            todos: [],
            context: matchedApiNote.text,
            createdAt: matchedApiNote.createdAt,
          };
          setNote(noteItem);
          setEditText(matchedApiNote.text);
          setIsLiveNote(true);
          setLoading(false);
          return;
        }
      } catch {
        // fallthrough to local data
      }

      const fallbackNote = notesData.notes.find((n) => String(n.id) === id);
      if (fallbackNote) {
        const noteItem: NoteItem = {
          id: String(fallbackNote.id),
          title: fallbackNote.title,
          status: fallbackNote.status,
          todos: fallbackNote.todos,
          context: fallbackNote.context,
        };
        setNote(noteItem);
        setEditText(fallbackNote.context);
      }
      setLoading(false);
    }
    getNote();
  }, [id]);

  const handleSaveEdit = async () => {
    if (!note || !isLiveNote) return;
    setSaving(true);
    setActionError("");
    try {
      const words = editText.trim().split(/\s+/);
      const newTitle =
        words.length > 5 ? words.slice(0, 5).join(" ") + "..." : words.join(" ") || "Voice Note";
      await updateNote(note.id, { text: editText } as Parameters<typeof updateNote>[1]);
      setNote((prev) => (prev ? { ...prev, title: newTitle, context: editText } : prev));
      setEditing(false);
    } catch {
      setActionError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!note || !isLiveNote) return;
    const newStatus = note.status === "Done" ? "Planned" : "Done";
    setActionError("");
    try {
      await updateNote(note.id, { status: newStatus } as Parameters<typeof updateNote>[1]);
      setNote((prev) => (prev ? { ...prev, status: newStatus } : prev));
    } catch {
      setActionError("Failed to update status. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (!note || !isLiveNote) return;
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    setDeleting(true);
    setActionError("");
    try {
      await deleteNote(note.id);
      navigate("/");
    } catch {
      setActionError("Failed to delete note. Please try again.");
      setDeleting(false);
    }
  };

  if (loading)
    return (
      <div className="detail-page">
        <div className="detail-loading">Loading note...</div>
      </div>
    );

  if (!note)
    return (
      <div className="detail-page">
        <button className="detail-back-btn" onClick={() => navigate("/")}>
          <RiArrowLeftLine size={16} /> Back
        </button>
        <p className="detail-not-found">Note not found.</p>
      </div>
    );

  const isDone = note.status === "Done";

  return (
    <div className="detail-page">
      {/* Navbar */}
      <header className="detail-navbar">
        <button className="detail-back-btn" onClick={() => navigate("/")}>
          <RiArrowLeftLine size={16} /> Back
        </button>
        <button
          className="icon-btn"
          onClick={toggleTheme}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <RiSunLine size={17} /> : <RiMoonLine size={17} />}
        </button>
      </header>

      <div className="detail-content">
        {/* Status row */}
        <div className="detail-status-row">
          <span className={`status-pill${isDone ? " status-pill--done" : ""}`}>
            {isDone ? <RiCheckLine size={12} /> : <RiTimeLine size={12} />}
            {note.status}
          </span>
          {isLiveNote && (
            <button className="toggle-status-btn" onClick={handleToggleStatus}>
              Mark as {isDone ? "Planned" : "Done"}
            </button>
          )}
        </div>

        <h1 className="detail-title">{note.title}</h1>

        {note.createdAt && (
          <p className="detail-date">
            {new Date(note.createdAt).toLocaleDateString("en-ZA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}

        {note.todos.length > 0 && (
          <>
            <h3 className="detail-section-title">Tasks</h3>
            <ul className="detail-todo-list">
              {note.todos.map((todo, index) => (
                <li key={index} className="detail-todo-item">
                  <label>
                    <input type="checkbox" />
                    {todo}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="detail-section-title">Transcript</h3>

        {editing ? (
          <div className="detail-edit-block">
            <textarea
              className="detail-textarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={8}
            />
            <div className="detail-edit-actions">
              <button className="action-btn action-btn--primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                className="action-btn action-btn--ghost"
                onClick={() => {
                  setEditing(false);
                  setEditText(note.context);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="detail-context">{note.context}</p>
        )}

        {actionError && <p className="detail-error">{actionError}</p>}

        {isLiveNote && !editing && (
          <div className="detail-actions">
            <button className="action-btn action-btn--primary" onClick={() => setEditing(true)}>
              <RiEditLine size={15} /> Edit
            </button>
            <button className="action-btn action-btn--danger" onClick={handleDelete} disabled={deleting}>
              <RiDeleteBin6Line size={15} />
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesDetail;
