
import React, { createContext, useContext, useState, useEffect } from "react";
import { refreshSession } from "../services/cognitoAuth.ts";
import { clearNotesCache } from "../services/notesCache.ts";


export interface AuthUser {
  email: string;
  sub: string;
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, tokens: { accessToken: string; idToken: string; refreshToken?: string; sub?: string }) => void;
  logout: () => void;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "voicetonote_auth";


function getTokenExpiry(token: string): number {
  try {
    const payloadBase64 = token.split(".")[1];
    const decoded = JSON.parse(atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.exp ?? 0;
  } catch {
    return 0;
  }
}

function isExpiringSoon(token: string): boolean {
  const expiresAt = getTokenExpiry(token);
  if (!expiresAt) return false;
  return Date.now() / 1000 > expiresAt - 300;
}



export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) return;

        const stored: AuthUser = JSON.parse(raw);

        if (isExpiringSoon(stored.idToken) && stored.refreshToken) {
          const refreshed = await refresh();
          if (!refreshed) {
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
    clearNotesCache();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
};
