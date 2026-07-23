"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string, role: string) => Promise<boolean>;
  loginWithGoogle: (credential: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Read session state on mount
    const savedUser = sessionStorage.getItem('hiregrid_io_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (_) {
        sessionStorage.removeItem('hiregrid_io_user');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      const isDashboardPath = pathname === '/dashboard';
      if (!user && isDashboardPath) {
        // Trying to visit private dashboard while guest -> Redirect to corporate login
        router.push('/login');
      } else if (user && pathname === '/login') {
        // Already authenticated -> Redirect directly to active session dashboard
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password,
        }),
      }).catch(() => {
        throw new Error('Backend service unavailable. Please make sure start.bat is running on http://localhost:8000.');
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Authentication failed. Please verify credentials.');
      }

      const userData = await response.json();
      const authenticatedUser: User = {
        email: userData.email,
        name: userData.name,
        role: userData.role,
      };

      sessionStorage.setItem('hiregrid_io_user', JSON.stringify(authenticatedUser));
      if (userData.token) {
        sessionStorage.setItem('hiregrid_io_token', userData.token);
      }
      setUser(authenticatedUser);
      setLoading(false);
      router.push('/dashboard');
      return true;
    } catch (err: any) {
      setLoading(false);
      throw err;
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    role: string
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password,
          name: name.trim() || 'Alex Sterling',
          role: role.trim() || 'Recruitment Lead',
        }),
      }).catch(() => {
        throw new Error('Backend service unavailable. Please make sure start.bat is running on http://localhost:8000.');
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Registration failed. Please check details.');
      }

      const userData = await response.json();
      const authenticatedUser: User = {
        email: userData.email,
        name: userData.name,
        role: userData.role,
      };

      sessionStorage.setItem('hiregrid_io_user', JSON.stringify(authenticatedUser));
      if (userData.token) {
        sessionStorage.setItem('hiregrid_io_token', userData.token);
      }
      setUser(authenticatedUser);
      setLoading(false);
      router.push('/dashboard');
      return true;
    } catch (err: any) {
      setLoading(false);
      throw err;
    }
  };

  const loginWithGoogle = async (credential: string): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: credential,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Google Authentication failed. Please try again.');
      }

      const userData = await response.json();
      const authenticatedUser: User = {
        email: userData.email,
        name: userData.name,
        role: userData.role,
      };

      sessionStorage.setItem('hiregrid_io_user', JSON.stringify(authenticatedUser));
      if (userData.token) {
        sessionStorage.setItem('hiregrid_io_token', userData.token);
      }
      setUser(authenticatedUser);
      setLoading(false);
      router.push('/dashboard');
      return true;
    } catch (err: any) {
      setLoading(false);
      throw err;
    }
  };

  const logout = () => {
    sessionStorage.removeItem('hiregrid_io_user');
    sessionStorage.removeItem('hiregrid_io_token');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
