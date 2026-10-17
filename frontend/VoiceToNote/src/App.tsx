

import './App.css'
import SearchBar from "./Components/SearchBar.tsx";
import NoteCard from "./Components/NoteCard.tsx";
import VoiceRec from "./Components/VoiceRec.tsx";


function App() {


  return (
    <>
        <span id="top-section">
<SearchBar></SearchBar>
        <VoiceRec></VoiceRec>
            </span>

        <NoteCard></NoteCard>


    </>
  )
}

export default App
