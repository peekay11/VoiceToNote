import "./NoteCard.css";
import { RiTimeLine, RiCheckboxCircleLine } from "react-icons/ri";

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
