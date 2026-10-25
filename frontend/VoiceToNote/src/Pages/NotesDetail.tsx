import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import notesData from "../Components/Notes.json";
import { fetchNotes, type Note } from "../services/api.ts";
import { type NoteItem } from "../Components/NoteCard.tsx";
import "./NotesDetail.css";

const NotesDetail = () => {
    const { id } = useParams<{ id: string }>();
    const [note, setNote] = useState<NoteItem | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function getNote() {
            try {
                const apiNotes = await fetchNotes();
                const matchedApiNote = apiNotes.find((n: Note) => n.noteId === id);
                if (matchedApiNote) {
                    const words = (matchedApiNote.text || "").trim().split(/\s+/);
                    const title = words.length > 5 ? words.slice(0, 5).join(" ") + "..." : words.join(" ") || "Voice Note";
                    setNote({
                        id: matchedApiNote.noteId,
                        title,
                        status: matchedApiNote.status,
                        todos: [],
                        context: matchedApiNote.text,
                        createdAt: matchedApiNote.createdAt,
                    });
                    setLoading(false);
                    return;
                }
            } catch {
                // Ignore API failures and check fallback
            }

            const fallbackNote = notesData.notes.find((n) => String(n.id) === id);
            if (fallbackNote) {
                setNote({
                    id: String(fallbackNote.id),
                    title: fallbackNote.title,
                    status: fallbackNote.status,
                    todos: fallbackNote.todos,
                    context: fallbackNote.context,
                });
            }
            setLoading(false);
        }

        getNote();
    }, [id]);

    if (loading) {
        return (
            <div className="notes-detail-container">
                <p>Loading note details...</p>
            </div>
        );
    }

    if (!note) {
        return (
            <div className="notes-detail-container">
                <h2>Note not found!</h2>
                <Link to="/" className="back-link">Back to Home</Link>
            </div>
        );
    }

    return (
        <div className="notes-detail-container">
            <nav className="detail-nav">
                <Link to="/" className="back-link">← Back to Notes</Link>
            </nav>

            <div className="note-detailed">
                <p className="status">{note.status}</p>
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
                <p className="context-text">
                    {note.context}
                </p>
            </div>
        </div>
    );
};

export default NotesDetail;
