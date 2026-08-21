import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, LoginResponse, Login2faType } from '../types/auth';
import { authApi } from '../api/authApi';
import { profileApi } from '../api/profileApi';
import {
  getAccessToken,
  setAccessToken,
  getServerUrl,
  setServerUrl as persistServerUrl,
  clearTokens,
} from '../api/tokenManager';

// ─── Context shape ───────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  serverUrl: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<LoginResponse>;
  login2fa: (
    userId: string,
    token: string,
    code: string,
    type?: Login2faType,
  ) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ userId: string; resendAfter: number }>;
  emailConfirm: (userId: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setServerUrl: (url: string) => void;
  clearServer: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [serverUrl, setServerUrlState] = useState<string | null>(
    getServerUrl,
  );
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch profile (validates token) ──────────────────────────────────

  const fetchProfile = useCallback(async () => {
    try {
      const data = await profileApi.getProfile();
      setUser(data);
    } catch {
      setUser(null);
      clearTokens();
    }
  }, []);

  // ── Bootstrap: check if we have a valid session ──────────────────────

  useEffect(() => {
    const bootstrap = async () => {
      const url = getServerUrl();
      const token = getAccessToken();
      if (url && token) {
        await fetchProfile();
      }
      setIsLoading(false);
    };
    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen for session-expired events from the HTTP client ───────────

  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
    };
    window.addEventListener('folio:session-expired', handleExpired);
    return () =>
      window.removeEventListener('folio:session-expired', handleExpired);
  }, []);

  // ── Auth methods ─────────────────────────────────────────────────────

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResponse> => {
      const res = await authApi.login(email, password);
      if (!res.need2fa) {
        setAccessToken(res.token);
        await fetchProfile();
      }
      return res;
    },
    [fetchProfile],
  );

  const login2fa = useCallback(
    async (
      userId: string,
      token: string,
      code: string,
      type: Login2faType = 'code',
    ): Promise<void> => {
      const res = await authApi.login2fa(userId, token, code, type);
      setAccessToken(res.token);
      await fetchProfile();
    },
    [fetchProfile],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      return authApi.register(name, email, password);
    },
    [],
  );

  const emailConfirm = useCallback(
    async (userId: string, code: string): Promise<void> => {
      const res = await authApi.emailConfirm(userId, code);
      setAccessToken(res.token);
      await fetchProfile();
    },
    [fetchProfile],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (getAccessToken()) {
      await fetchProfile();
    }
  }, [fetchProfile]);

  const handleSetServerUrl = useCallback((url: string) => {
    persistServerUrl(url);
    setServerUrlState(url);
  }, []);

  const clearServer = useCallback(() => {
    persistServerUrl(null);
    clearTokens();
    setServerUrlState(null);
    setUser(null);
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        user,
        serverUrl,
        isAuthenticated: !!user,
        isLoading,
        login,
        login2fa,
        register,
        emailConfirm,
        logout,
        refreshUser,
        setServerUrl: handleSetServerUrl,
        clearServer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
