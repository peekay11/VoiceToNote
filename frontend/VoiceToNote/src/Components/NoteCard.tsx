import "./NoteCard.css";

export interface NoteItem {
  id: string;
  title: string;
  status: string;
  todos: string[];
  context: string;
  createdAt?: string;
}

interface NoteProps {
  note: NoteItem;
}

const NoteCard = ({ note }: NoteProps) => {
  return (
    <div className="note-card">
      <h1 className="title">{note.title}</h1>
      <p className="status" style={{
        color: note.status.toLowerCase() === "done" || note.status.toLowerCase() === "completed" ? "#16a34a" : "#2563eb"
      }}>
        {note.status}
      </p>

      {note.todos && note.todos.length > 0 && (
        <ul className="todo-list">
          {note.todos.map((todo, index) => (
            <li key={index} className="todo-item">{todo}</li>
          ))}
        </ul>
      )}

      <p className="context-text">
        {note.context}
      </p>
    </div>
  );
};

export default NoteCard;
