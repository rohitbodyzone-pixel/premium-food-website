import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

export interface ExpertRegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  countryCode?: string;
  categoryId?: string;
  title?: string;
  businessName?: string;
}

export interface PhoneSignupData {
  name: string;
  phoneNumber: string;
  countryCode: string;
  otp: string;
  role?: 'CONSUMER' | 'EXPERT';
  expertDetails?: {
    title?: string;
    businessName?: string;
    categoryId?: string;
    bio?: string;
  };
}

export interface SendPhoneOtpResponse {
  success: boolean;
  message: string;
  expiresInMinutes: number;
  normalizedPhone: string;
  devOtpPreview?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone?: string; countryCode?: string }) => Promise<void>;
  registerCustomer: (data: { name: string; email: string; password: string; phone?: string; countryCode?: string }) => Promise<void>;
  registerExpert: (data: ExpertRegisterData) => Promise<{ redirectTo?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  sendPhoneOtp: (phoneNumber: string, countryCode?: string, reason?: 'SIGNUP' | 'LOGIN' | 'PHONE_CHANGE') => Promise<SendPhoneOtpResponse>;
  signupWithPhone: (data: PhoneSignupData) => Promise<{ redirectTo?: string }>;
  loginWithPhone: (phoneNumber: string, countryCode: string, otp: string, targetPortal?: 'customer' | 'expert') => Promise<void>;
  requestPhoneChange: (newPhoneNumber: string, countryCode?: string) => Promise<SendPhoneOtpResponse>;
  verifyPhoneChange: (newPhoneNumber: string, countryCode: string, otp: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  switchDemoRole: (roleType: 'consumer' | 'expert_nz' | 'expert_au' | 'admin') => Promise<void>;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pt_token'));
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const storedToken = localStorage.getItem('pt_token');
    // Note: If cookie is used without localStorage token, we still attempt /auth/me
    try {
      const userData = await api.get<User>('/auth/me');
      setUser(userData);
    } catch (e) {
      if (storedToken) {
        console.warn('Session expired or invalid token');
        localStorage.removeItem('pt_token');
        setToken(null);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    localStorage.setItem('pt_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (data: { name: string; email: string; password: string; phone?: string; countryCode?: string }) => {
    const res = await api.post<{ token: string; user: User }>('/auth/register', data);
    localStorage.setItem('pt_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const registerCustomer = async (data: { name: string; email: string; password: string; phone?: string; countryCode?: string }) => {
    return register(data);
  };

  const registerExpert = async (data: ExpertRegisterData) => {
    const res = await api.post<{ token: string; user: User; redirectTo?: string }>('/auth/register-expert', data);
    localStorage.setItem('pt_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return { redirectTo: res.redirectTo };
  };

  const forgotPassword = async (email: string) => {
    return api.post<{ success: boolean; message: string }>('/auth/forgot-password', { email });
  };

  const resetPassword = async (token: string, newPassword: string) => {
    return api.post<{ success: boolean; message: string }>('/auth/reset-password', { token, newPassword });
  };

  const switchDemoRole = async (roleType: 'consumer' | 'expert_nz' | 'expert_au' | 'admin') => {
    if (!import.meta.env.DEV) {
      console.warn('Demo role switching is strictly disabled in production environments.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/demo-login', { roleType });
      localStorage.setItem('pt_token', res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (err: any) {
      console.error('Failed to switch demo role:', err);
      alert(err.message || 'Failed to switch demo role');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.warn('Logout request error:', e);
    } finally {
      localStorage.removeItem('pt_token');
      setToken(null);
      setUser(null);
    }
  };

  const sendPhoneOtp = async (
    phoneNumber: string,
    countryCode: string = 'NZ',
    reason: 'SIGNUP' | 'LOGIN' | 'PHONE_CHANGE' = 'LOGIN'
  ): Promise<SendPhoneOtpResponse> => {
    return api.post<SendPhoneOtpResponse>('/auth/phone/send-otp', { phoneNumber, countryCode, reason });
  };

  const signupWithPhone = async (data: PhoneSignupData): Promise<{ redirectTo?: string }> => {
    const res = await api.post<{ token: string; user: User; redirectTo?: string }>('/auth/phone/verify-signup', data);
    localStorage.setItem('pt_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return { redirectTo: res.redirectTo };
  };

  const loginWithPhone = async (
    phoneNumber: string,
    countryCode: string = 'NZ',
    otp: string,
    targetPortal?: 'customer' | 'expert'
  ): Promise<void> => {
    const res = await api.post<{ token: string; user: User }>('/auth/phone/login', {
      phoneNumber,
      countryCode,
      otp,
      targetPortal,
    });
    localStorage.setItem('pt_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const requestPhoneChange = async (newPhoneNumber: string, countryCode: string = 'NZ'): Promise<SendPhoneOtpResponse> => {
    return api.post<SendPhoneOtpResponse>('/auth/phone/change-request', { newPhoneNumber, countryCode });
  };

  const verifyPhoneChange = async (
    newPhoneNumber: string,
    countryCode: string = 'NZ',
    otp: string
  ): Promise<{ success: boolean; message: string }> => {
    const res = await api.post<{ success: boolean; message: string; user: User }>('/auth/phone/change-verify', {
      newPhoneNumber,
      countryCode,
      otp,
    });
    if (res.user) {
      setUser((prev) => (prev ? { ...prev, ...res.user } : res.user));
    }
    return { success: res.success, message: res.message };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        registerCustomer,
        registerExpert,
        forgotPassword,
        resetPassword,
        sendPhoneOtp,
        signupWithPhone,
        loginWithPhone,
        requestPhoneChange,
        verifyPhoneChange,
        logout,
        switchDemoRole,
        refreshUser,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
