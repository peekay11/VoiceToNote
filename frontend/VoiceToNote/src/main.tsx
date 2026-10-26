// Entry point — mounts the React app into the #root div in index.html.
// StrictMode runs every effect twice in development to help catch bugs.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
