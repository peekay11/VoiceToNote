
import "./NoteCard.css";
import notesData from "./Notes.json"

const NoteCard = () => {
    return (
        <div id="notes">

            {notesData.notes.map((note)=>(


            <span key={note.title} className="note-card">
                <h1 className="title">{note.title}</h1>
                <p className="status">{note.status}</p>


                <ul  className="todo-list">
                    {note.todos.map((todo ,index)=>(

                    <li key={index } className="todo-item">{todo}</li>
                    ))}

                </ul>


                <p className="context-text">
                   {note.context}
                </p>
            </span>

            ))}


        </div>
    );
};

export default NoteCard;
