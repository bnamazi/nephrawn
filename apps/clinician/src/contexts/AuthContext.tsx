'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { api, setToken, clearToken, getToken } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface LoginResponse {
  token: string;
  user: User;
}

interface MeResponse {
  clinician: User;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean; // True once session restoration check is complete
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Start with loading=true to check for existing session
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Restore session on app load
  useEffect(() => {
    async function restoreSession() {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      try {
        // Verify token is still valid by fetching user profile
        const response = await api.get<MeResponse>('/clinician/me');
        setUser(response.clinician);
      } catch {
        // Token is invalid or expired, clear it
        clearToken();
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.post<LoginResponse>('/auth/clinician/login', {
        email,
        password,
      });
      setToken(response.token);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    isInitialized,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
