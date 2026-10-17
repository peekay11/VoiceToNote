import { BrowserRouter, Routes, Route } from "react-router-dom";
import './App.css';
import NotesPage from "./Pages/NotesPage.tsx";
import NotesDetail from "./Pages/NotesDetail.tsx";

function App() {
    return (
        <BrowserRouter>
            <div style={{ padding: "20px" }}>
                <Routes>
                    {/* Main Home Page */}
                    <Route path="/" element={<NotesPage />} />

                    {/* Dynamic Note Detail Page */}
                    <Route path="/note/:id" element={<NotesDetail />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;
