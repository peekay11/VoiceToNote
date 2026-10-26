// Wraps routes that require the user to be logged in.
// Shows a loading screen while auth state is loading, then redirects to /login if no user.

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.tsx";

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  // Still reading auth from localStorage — wait before deciding
  if (loading) {
    return <div style={{ textAlign: "center", marginTop: "40px" }}>Loading...</div>;
  }

  // No user found — kick to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
