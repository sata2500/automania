'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  provider: 'google' | 'demo';
  role?: 'admin' | 'user';
}

interface AuthContextType {
  user: UserProfile | null;
  isAdmin: boolean;
  loginWithGoogle: () => void;
  loginWithDemo: (email?: string, name?: string, role?: 'admin' | 'user') => void;
  logout: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'automania_pod_user_session';

export const UserAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const saveUserSession = (userProfile: UserProfile | null) => {
    setUser(userProfile);
    if (userProfile) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userProfile));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  };

  const loginWithGoogle = () => {
    // Check if Google Client ID is configured via environment variables
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (googleClientId) {
      // Redirect to Google OAuth Endpoint
      const redirectUri = encodeURIComponent(window.location.origin + '/api/auth/google/callback');
      const scope = encodeURIComponent('email profile');
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
      window.location.href = googleAuthUrl;
    } else {
      // Prompt user or log in with Google Demo Account
      const demoEmail = prompt(
        'Google Hesabınızla Giriş Yapın:\nLütfen e-posta adresinizi girin (Google Auth simülasyonu):',
        'kullanici@gmail.com'
      );
      if (demoEmail) {
        const name = demoEmail.split('@')[0];
        const userProfile: UserProfile = {
          id: 'user-' + btoa(demoEmail).replace(/=/g, '').toLowerCase(),
          name: name.charAt(0).toUpperCase() + name.slice(1),
          email: demoEmail,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(demoEmail)}`,
          provider: 'google',
        };
        saveUserSession(userProfile);
        setIsAuthModalOpen(false);
      }
    }
  };

  const isAdmin = user
    ? user.role === 'admin' ||
      user.email === 'salihtanriseven25@gmail.com' ||
      user.email === 'admin@automania.com' ||
      user.email === 'kullanici@gmail.com' ||
      user.provider === 'demo'
    : false;

  const loginWithDemo = (email = 'salihtanriseven25@gmail.com', name = 'Salih TANRISEVEN (Admin)', role: 'admin' | 'user' = 'admin') => {
    const userProfile: UserProfile = {
      id: 'user-demo-101',
      name,
      email,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      provider: 'demo',
      role,
    };
    saveUserSession(userProfile);
    setIsAuthModalOpen(false);
  };

  const logout = () => {
    saveUserSession(null);
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loginWithGoogle,
        loginWithDemo,
        logout,
        isAuthModalOpen,
        setIsAuthModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a UserAuthProvider');
  }
  return context;
};
