import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import ProtectedRoute from "./Components/ProtectedRoute.tsx";
import LoginPage from "./Pages/LoginPage.tsx";
import SignupPage from "./Pages/SignupPage.tsx";
import NotesPage from "./Pages/NotesPage.tsx";
import NotesDetail from "./Pages/NotesDetail.tsx";
import "./App.css";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="app-shell">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

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
    </ThemeProvider>
  );
}

export default App;
