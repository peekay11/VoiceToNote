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
        <div className="processing-bar processing-bar--title" />
        <div className="processing-bar processing-bar--line1" />
        <div className="processing-bar processing-bar--line2" />
      </div>
    </div>
  );
};

export default ProcessingCard;
