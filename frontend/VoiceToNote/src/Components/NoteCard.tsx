import "./NoteCard.css";

interface NoteProps {
    note: {
        id: number;
        title: string;
        status: string;
        todos: string[];
        context: string;
    };
}

const NoteCard = ({ note }: NoteProps) => {
    return (
        <div className="note-card">
            <h1 className="title">{note.title}</h1>
            <p className="status">{note.status}</p>

            <ul className="todo-list">
                {note.todos.map((todo, index) => (
                    <li key={index} className="todo-item">{todo}</li>
                ))}
            </ul>

            <p className="context-text">
                {note.context}
            </p>
        </div>
    );
};

export default NoteCard;
