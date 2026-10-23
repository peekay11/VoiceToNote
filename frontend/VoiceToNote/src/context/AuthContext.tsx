import React, { createContext, useContext, useState, useEffect } from "react";

export interface AuthUser {
  email: string;
  sub: string;
  accessToken: string;
  idToken: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, tokens: { accessToken: string; idToken: string; sub?: string }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "voicetonote_auth";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (email: string, tokens: { accessToken: string; idToken: string; sub?: string }) => {
    const authData: AuthUser = {
      email,
      sub: tokens.sub || email,
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
    setUser(authData);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
