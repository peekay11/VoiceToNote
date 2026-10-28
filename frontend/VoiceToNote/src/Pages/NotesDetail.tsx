
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { updateNote, deleteNote } from "../services/api.ts";
import { getCachedNotes, updateCachedNote, removeCachedNote } from "../services/notesCache.ts";
import { type NoteItem, type TodoItem } from "../Components/NoteCard.tsx";
import ConfirmModal from "../Components/ConfirmModal.tsx";
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
  const [loadingNote, setLoadingNote] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionError, setActionError] = useState("");


  useEffect(() => {
    const cached = getCachedNotes();
    const match = cached.find((n) => n.id === id);
    if (match) {
      setNote(match);
      setEditText(match.context);
    }
    setLoadingNote(false);
  }, [id]);



  const handleSaveEdit = async () => {
    if (!note) return;
    setSaving(true);
    setActionError("");
    try {
      // Backend will clean and re-structure via AI — we get updated fields back
      const updated = await updateNote(note.id, { text: editText } as Parameters<typeof updateNote>[1]);
      const changes: Partial<NoteItem> = {
        title: (updated as unknown as NoteItem & { title?: string }).title || note.title,
        context: (updated as unknown as NoteItem & { summary?: string }).summary || editText,
        todos: ((updated as unknown as NoteItem & { todos?: string[] }).todos || []).map((t: string | TodoItem) => ({
          text: typeof t === "string" ? t : t.text,
          done: typeof t === "string" ? false : t.done ?? false,
        })),
      };
      updateCachedNote(note.id, changes);
      setNote((prev) => (prev ? { ...prev, ...changes } : prev));
      setEditing(false);
    } catch {
      setActionError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!note) return;
    const newStatus = note.status === "Done" ? "Planned" : "Done";
    setActionError("");
    try {
      await updateNote(note.id, { status: newStatus } as Parameters<typeof updateNote>[1]);
      updateCachedNote(note.id, { status: newStatus });
      setNote((prev) => (prev ? { ...prev, status: newStatus } : prev));
    } catch {
      setActionError("Failed to update status. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    setDeleting(true);
    setActionError("");
    try {
      await deleteNote(note.id);
      removeCachedNote(note.id);
      navigate("/");
    } catch {
      setActionError("Failed to delete note. Please try again.");
      setDeleting(false);
    }
  };

  // Toggles a single todo and auto-moves the note to Done once every task is complete.
  const handleToggleTodo = async (index: number) => {
    if (!note) return;
    setActionError("");

    const updatedTodos = note.todos.map((todo, i) =>
      i === index ? { ...todo, done: !todo.done } : todo
    );
    const status: "Planned" | "Done" =
      updatedTodos.length > 0 && updatedTodos.every((todo) => todo.done)
        ? "Done"
        : "Planned";
    const changes = { todos: updatedTodos, status };

    setNote((prev) => (prev ? { ...prev, ...changes } : prev));
    updateCachedNote(note.id, changes);

    try {
      await updateNote(note.id, changes);
    } catch {
      setNote((prev) => (prev ? { ...prev, todos: note.todos, status: note.status } : prev));
      updateCachedNote(note.id, { todos: note.todos, status: note.status });
      setActionError("Failed to update task. Please try again.");
    }
  };



  if (loadingNote) {
    return (
      <div className="detail-page">
        <div className="detail-loading">Loading note...</div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="detail-page">
        <button className="detail-back-btn" onClick={() => navigate("/")}>
          <RiArrowLeftLine size={16} /> Back
        </button>
        <p className="detail-not-found">Note not found.</p>
      </div>
    );
  }

  const isDone = note.status === "Done";

  return (
    <div className="detail-page">
      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <ConfirmModal
          message="Delete this note? This cannot be undone."
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {/* Top navbar */}
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
        {/* Status badge + toggle button */}
        <div className="detail-status-row">
          <span className={`status-pill${isDone ? " status-pill--done" : ""}`}>
            {isDone ? <RiCheckLine size={12} /> : <RiTimeLine size={12} />}
            {note.status}
          </span>
          <button className="toggle-status-btn" onClick={handleToggleStatus}>
            Mark as {isDone ? "Planned" : "Done"}
          </button>
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
                <li key={index} className={`detail-todo-item${todo.done ? " detail-todo-item--done" : ""}`}>
                  <button
                    className={`todo-radio${todo.done ? " todo-radio--done" : ""}`}
                    onClick={() => handleToggleTodo(index)}
                    aria-label={todo.done ? "Mark incomplete" : "Mark complete"}
                  >
                    {todo.done && <RiCheckLine size={11} />}
                  </button>
                  <span className="todo-text">{todo.text}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Cleaned transcript */}
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
              <button
                className="action-btn action-btn--primary"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                className="action-btn action-btn--ghost"
                onClick={() => {
                  setEditing(false);
                  setEditText(note.context); // discard changes
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

        {/* Edit + Delete actions */}
        {!editing && (
          <div className="detail-actions">
            <button className="action-btn action-btn--primary" onClick={() => setEditing(true)}>
              <RiEditLine size={15} /> Edit
            </button>
            <button
              className="action-btn action-btn--danger"
              onClick={() => setShowDeleteModal(true)}
              disabled={deleting}
            >
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
