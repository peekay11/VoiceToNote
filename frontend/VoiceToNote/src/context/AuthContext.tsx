// Stores the logged-in user's tokens and info.
// Wrap your app in <AuthProvider> and call useAuth() anywhere to access the user.

import React, { createContext, useContext, useState, useEffect } from "react";
import { refreshSession } from "../services/cognitoAuth.ts";
import { clearNotesCache } from "../services/notesCache.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  email: string;
  sub: string;       // Cognito user ID
  accessToken: string;
  idToken: string;   // Sent as Bearer token on every API request
  refreshToken: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;  // true while we check localStorage on first load
  login: (email: string, tokens: { accessToken: string; idToken: string; refreshToken?: string; sub?: string }) => void;
  logout: () => void;
  refresh: () => Promise<boolean>;
}

// ─── Context setup ────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "voicetonote_auth";

// ─── Token expiry helpers ─────────────────────────────────────────────────────

// Reads the exp claim from a JWT without any library
function getTokenExpiry(token: string): number {
  try {
    const payloadBase64 = token.split(".")[1];
    const decoded = JSON.parse(atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.exp ?? 0;
  } catch {
    return 0;
  }
}

// Returns true if the token expires within the next 5 minutes
function isExpiringSoon(token: string): boolean {
  const expiresAt = getTokenExpiry(token);
  if (!expiresAt) return false;
  return Date.now() / 1000 > expiresAt - 300;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Gets new access + id tokens using the stored refresh token
  const refresh = async (): Promise<boolean> => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;

    try {
      const stored: AuthUser = JSON.parse(raw);
      if (!stored.refreshToken) return false;

      const newTokens = await refreshSession(stored.refreshToken);
      const updatedUser: AuthUser = { ...stored, ...newTokens };

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
      return true;
    } catch {
      return false;
    }
  };

  // On app load, restore the session from localStorage.
  // If the id token is about to expire, refresh it silently before showing the app.
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) return;

        const stored: AuthUser = JSON.parse(raw);

        if (isExpiringSoon(stored.idToken) && stored.refreshToken) {
          const refreshed = await refresh();
          if (!refreshed) {
            // Refresh token also expired — clear session, send to /login
            localStorage.removeItem(AUTH_STORAGE_KEY);
            setUser(null);
            return;
          }
        } else {
          setUser(stored);
        }
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Syncs state when api.ts refreshes tokens in the background (same-tab storage event)
  // Also listens for auth:logout fired when the refresh token itself has expired
  useEffect(() => {
    const onTokensUpdated = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY && e.newValue) {
        try {
          setUser(JSON.parse(e.newValue));
        } catch {
          // ignore malformed data
        }
      }
    };

    const onForceLogout = () => {
      clearNotesCache();
      setUser(null);
    };

    window.addEventListener("storage", onTokensUpdated);
    window.addEventListener("auth:logout", onForceLogout);

    return () => {
      window.removeEventListener("storage", onTokensUpdated);
      window.removeEventListener("auth:logout", onForceLogout);
    };
  }, []);

  const login = (
    email: string,
    tokens: { accessToken: string; idToken: string; refreshToken?: string; sub?: string }
  ) => {
    const newUser: AuthUser = {
      email,
      sub: tokens.sub || email,
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      refreshToken: tokens.refreshToken || "",
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    clearNotesCache(); // don't leave this user's notes visible to the next login
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
};
