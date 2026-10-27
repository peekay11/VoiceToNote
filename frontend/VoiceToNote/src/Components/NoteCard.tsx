// Card component that displays a single note in the grid.
// Used on NotesPage inside a <Link> so clicking the card navigates to the detail page.

import { RiTimeLine, RiCheckboxCircleLine, RiCheckLine } from "react-icons/ri";
import "./NoteCard.css";

// NoteItem is the frontend shape — slightly different from the raw API Note type
export interface TodoItem {
  text: string;
  done: boolean;
}

export interface NoteItem {
  id: string;
  title: string;
  status: string;
  todos: TodoItem[];
  context: string;
  createdAt?: string;
}

interface NoteCardProps {
  note: NoteItem;
  onToggleTodo?: (index: number) => void;
}

const NoteCard = ({ note, onToggleTodo }: NoteCardProps) => {
  const isDone =
    note.status.toLowerCase() === "done" || note.status.toLowerCase() === "completed";

  return (
    <div className={`note-card${isDone ? " note-card--done" : ""}`}>
      <div className="note-card-status">
        {isDone ? <RiCheckboxCircleLine size={12} /> : <RiTimeLine size={12} />}
        <span>{note.status}</span>
      </div>
      <h2 className="note-card-title">{note.title}</h2>
      <p className="note-card-context">{note.context}</p>

      {note.todos.length > 0 && (
        <ul className="note-card-todos">
          {note.todos.map((todo, index) => (
            <li
              key={`${todo.text}-${index}`}
              className={`note-card-todo${todo.done ? " note-card-todo--done" : ""}`}
            >
              <button
                type="button"
                className={`note-card-check${todo.done ? " note-card-check--done" : ""}`}
                aria-label={todo.done ? "Mark task incomplete" : "Mark task complete"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleTodo?.(index);
                }}
              >
                {todo.done && <RiCheckLine size={10} />}
              </button>
              <span>{todo.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NoteCard;
