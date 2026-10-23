import { BrowserRouter, Routes, Route } from "react-router-dom";
import './App.css';
import { AuthProvider } from "./context/AuthContext.tsx";
import ProtectedRoute from "./Components/ProtectedRoute.tsx";
import LoginPage from "./Pages/LoginPage.tsx";
import SignupPage from "./Pages/SignupPage.tsx";
import NotesPage from "./Pages/NotesPage.tsx";
import NotesDetail from "./Pages/NotesDetail.tsx";

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <div style={{ padding: "20px" }}>
                    <Routes>
                        {/* Public Auth Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />

                        {/* Protected Notes Pages */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <NotesPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/note/:id"
                            element={
                                <ProtectedRoute>
                                    <NotesDetail />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </div>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
