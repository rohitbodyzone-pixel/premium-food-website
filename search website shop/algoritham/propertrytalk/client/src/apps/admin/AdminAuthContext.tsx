import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../../types';

interface AdminAuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const ADMIN_TOKEN_KEY = 'pt_admin_token';
const API_BASE = '/api';

export const adminApi = {
  getHeaders(): HeadersInit {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'API Error' }));
      throw new Error(err.error || `Request failed with status ${res.status}`);
    }
    return res.json();
  },

  async post<T>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'API Error' }));
      throw new Error(err.error || `Request failed with status ${res.status}`);
    }
    return res.json();
  },

  async patch<T>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'API Error' }));
      throw new Error(err.error || `Request failed with status ${res.status}`);
    }
    return res.json();
  },

  async put<T>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'API Error' }));
      throw new Error(err.error || `Request failed with status ${res.status}`);
    }
    return res.json();
  },

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'API Error' }));
      throw new Error(err.error || `Request failed with status ${res.status}`);
    }
    return res.json();
  },
};

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ADMIN_TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const storedToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!storedToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const userData = await adminApi.get<User>('/auth/me');
      if (userData.role === 'SUPER_ADMIN') {
        setUser(userData);
      } else {
        // Token belongs to consumer or expert; clear admin session
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    } catch {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await adminApi.post<{ token: string; user: User }>('/auth/login', { email, password });
    if (res.user.role !== 'SUPER_ADMIN') {
      throw new Error('Access Denied: Only Super Admin accounts have administrative privileges.');
    }
    localStorage.setItem(ADMIN_TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await adminApi.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        loading,
        refreshUser,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
