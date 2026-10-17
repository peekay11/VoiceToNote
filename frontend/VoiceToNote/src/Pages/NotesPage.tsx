import { Link } from "react-router-dom";
import SearchBar from "../Components/SearchBar.tsx";
import VoiceRec from "../Components/VoiceRec.tsx";
import NoteCard from "../Components/NoteCard.tsx";
import notesData from "../Components/Notes.json"; // Adjust path if needed

const NotesPage = () => {
    return (
        <>
            <div id="top-section">
                <SearchBar />
                <VoiceRec />
            </div>

            <div id="notes" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {notesData.notes.map((note) => (
                    <Link
                        to={`/note/${note.id}`}
                        key={note.id}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                        <NoteCard note={note} />
                    </Link>
                ))}
            </div>
        </>
    );
};

export default NotesPage;
