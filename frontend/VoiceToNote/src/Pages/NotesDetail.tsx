import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import notesData from "../Components/Notes.json";
import { fetchNotes, updateNote, deleteNote, type Note } from "../services/api.ts";
import { type NoteItem } from "../Components/NoteCard.tsx";
import "./NotesDetail.css";

const NotesDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [note, setNote] = useState<NoteItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLiveNote, setIsLiveNote] = useState(false);

    // Edit mode state
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
                    const title = words.length > 5 ? words.slice(0, 5).join(" ") + "..." : words.join(" ") || "Voice Note";
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
            const newTitle = words.length > 5 ? words.slice(0, 5).join(" ") + "..." : words.join(" ") || "Voice Note";
            await updateNote(note.id, { text: editText } as Parameters<typeof updateNote>[1]);
            setNote((prev) => prev ? { ...prev, title: newTitle, context: editText } : prev);
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
            setNote((prev) => prev ? { ...prev, status: newStatus } : prev);
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

    if (loading) {
        return (
            <div className="notes-detail-container">
                <p>Loading note...</p>
            </div>
        );
    }

    if (!note) {
        return (
            <div className="notes-detail-container">
                <h2>Note not found!</h2>
                <Link to="/" className="back-link">← Back to Notes</Link>
            </div>
        );
    }

    return (
        <div className="notes-detail-container">
            <nav className="detail-nav">
                <Link to="/" className="back-link">← Back to Notes</Link>
            </nav>

            <div className="note-detailed">
                {/* Status + toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <p className="status" style={{
                        color: note.status === "Done" ? "#16a34a" : "#2563eb",
                        margin: 0
                    }}>
                        {note.status}
                    </p>
                    {isLiveNote && (
                        <button
                            onClick={handleToggleStatus}
                            style={{
                                fontSize: "12px",
                                padding: "3px 10px",
                                border: "1px solid #cbd5e1",
                                borderRadius: "20px",
                                background: "transparent",
                                cursor: "pointer",
                                color: "#475569",
                            }}
                        >
                            Mark as {note.status === "Done" ? "Planned" : "Done"}
                        </button>
                    )}
                </div>

                <h1 className="title">{note.title}</h1>

                {note.todos.length > 0 && (
                    <>
                        <h3 className="section-title">Tasks</h3>
                        <ul className="todo-list">
                            {note.todos.map((todo, index) => (
                                <li key={index} className="todo">
                                    <label className="todo-item-label">
                                        <input type="checkbox" className="todo-checkbox" />
                                        {todo}
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                <h3 className="section-title">Context & Transcript</h3>

                {editing ? (
                    <div>
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={6}
                            style={{
                                width: "100%",
                                fontSize: "1.1rem",
                                lineHeight: "1.6",
                                padding: "12px",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                resize: "vertical",
                                fontFamily: "inherit",
                                boxSizing: "border-box",
                                outline: "none",
                            }}
                        />
                        <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                            <button onClick={handleSaveEdit} disabled={saving} style={btnStyle("#2563eb")}>
                                {saving ? "Saving..." : "Save"}
                            </button>
                            <button onClick={() => { setEditing(false); setEditText(note.context); }} style={btnStyle("#94a3b8")}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="context-text">{note.context}</p>
                )}

                {actionError && (
                    <p style={{ color: "#b91c1c", fontSize: "13px" }}>{actionError}</p>
                )}

                {/* Action buttons */}
                {isLiveNote && !editing && (
                    <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                        <button onClick={() => setEditing(true)} style={btnStyle("#1d1d1f")}>
                            Edit Note
                        </button>
                        <button onClick={handleDelete} disabled={deleting} style={btnStyle("#dc2626")}>
                            {deleting ? "Deleting..." : "Delete Note"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

function btnStyle(bg: string): React.CSSProperties {
    return {
        backgroundColor: bg,
        color: "white",
        border: "none",
        padding: "9px 18px",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
    };
}

export default NotesDetail;
