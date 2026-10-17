import { useParams, Link } from "react-router-dom";
import notesData from "../Components/Notes.json";
import "./NotesDetail.css"; // 🔥 Import your new styles here

const NotesDetail = () => {
    const { id } = useParams<{ id: string }>();
    const currentNote = notesData.notes.find((note) => note.id === Number(id));

    if (!currentNote) {
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
                <p className="status">{currentNote.status}</p>
                <h1 className="title">{currentNote.title}</h1>

                <h3 className="section-title">Tasks</h3>
                <ul className="todo-list">
                    {currentNote.todos.map((todo, index) => (
                        <li key={index} className="todo">
                            <label className="todo-item-label">
                                <input type="checkbox" className="todo-checkbox" />
                                {todo}
                            </label>
                        </li>
                    ))}
                </ul>

                <h3 className="section-title">Context & Notes</h3>
                <p className="context-text">
                    {currentNote.context}
                </p>
            </div>
        </div>
    );
};

export default NotesDetail;
