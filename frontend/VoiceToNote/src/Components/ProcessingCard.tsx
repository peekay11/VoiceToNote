// Placeholder card shown in the notes grid while AWS is transcribing a new recording.
// Removed automatically when the real note arrives in the next loadNotes() poll.

import { RiLoader4Line } from "react-icons/ri";
import "./ProcessingCard.css";

const ProcessingCard = () => {
  return (
    <div className="processing-card">
      <div className="processing-card-shimmer" />
      <div className="processing-card-inner">
        <div className="processing-status">
          <RiLoader4Line className="processing-spin" size={13} />
          <span>Processing</span>
        </div>
        {/* Skeleton lines to mimic the shape of a real NoteCard */}
        <div className="processing-bar processing-bar--title" />
        <div className="processing-bar processing-bar--line1" />
        <div className="processing-bar processing-bar--line2" />
      </div>
    </div>
  );
};

export default ProcessingCard;
