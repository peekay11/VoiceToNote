// Card component that displays a single note in the grid.
// Used on NotesPage inside a <Link> so clicking the card navigates to the detail page.

import { RiTimeLine, RiCheckboxCircleLine } from "react-icons/ri";
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
}

const NoteCard = ({ note }: NoteCardProps) => {
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
    </div>
  );
};

export default NoteCard;
