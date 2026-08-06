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

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'blocked';
  provider: 'google' | 'demo';
  createdAt: string;
}

const DEFAULT_USERS: ManagedUser[] = [
  {
    id: 'user-demo-101',
    name: 'Salih TANRISEVEN',
    email: 'salihtanriseven25@gmail.com',
    role: 'admin',
    status: 'active',
    provider: 'google',
    createdAt: '2026-01-01',
  },
  {
    id: 'user-demo-102',
    name: 'Demo Tasarımcı',
    email: 'kullanici@gmail.com',
    role: 'user',
    status: 'active',
    provider: 'demo',
    createdAt: '2026-02-15',
  },
  {
    id: 'user-demo-103',
    name: 'Ahmet Yılmaz',
    email: 'ahmet@automania.com',
    role: 'user',
    status: 'active',
    provider: 'google',
    createdAt: '2026-03-10',
  },
];

interface AuthContextType {
  user: UserProfile | null;
  isAdmin: boolean;
  userList: ManagedUser[];
  loginWithGoogle: () => void;
  loginWithDemo: (email?: string, name?: string, role?: 'admin' | 'user') => void;
  logout: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  updateUserRole: (userId: string, newRole: 'admin' | 'user') => void;
  toggleUserBlock: (userId: string) => void;
  deleteUser: (userId: string) => void;
  addUser: (name: string, email: string, role: 'admin' | 'user') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'automania_pod_user_session';
const USER_LIST_STORAGE_KEY = 'automania_pod_user_list_v1';

export const UserAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userList, setUserList] = useState<ManagedUser[]>(DEFAULT_USERS);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setUser(parsed);
      }

      const savedUsers = localStorage.getItem(USER_LIST_STORAGE_KEY);
      if (savedUsers) {
        setUserList(JSON.parse(savedUsers));
      } else {
        localStorage.setItem(USER_LIST_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      }
    } catch {}
  }, []);

  const saveUserList = (newList: ManagedUser[]) => {
    setUserList(newList);
    try {
      localStorage.setItem(USER_LIST_STORAGE_KEY, JSON.stringify(newList));
    } catch {}
  };

  const saveUserSession = (userProfile: UserProfile | null) => {
    setUser(userProfile);
    if (userProfile) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userProfile));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  };

  const isUserBlocked = (email: string): boolean => {
    const found = userList.find((u) => u.email.toLowerCase() === email.toLowerCase());
    return found ? found.status === 'blocked' : false;
  };

  const loginWithGoogle = () => {
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (googleClientId) {
      const redirectUri = encodeURIComponent(window.location.origin + '/api/auth/google/callback');
      const scope = encodeURIComponent('email profile');
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
      window.location.href = googleAuthUrl;
    } else {
      const demoEmail = prompt(
        'Google Hesabınızla Giriş Yapın:\nLütfen e-posta adresinizi girin (Google Auth simülasyonu):',
        'kullanici@gmail.com'
      );
      if (demoEmail) {
        if (isUserBlocked(demoEmail)) {
          alert('⚠️ Bu e-posta adresi yönetici tarafından engellenmiştir. Sisteme giriş yapamazsınız.');
          return;
        }

        const name = demoEmail.split('@')[0];
        const existing = userList.find((u) => u.email.toLowerCase() === demoEmail.toLowerCase());
        const role = existing ? existing.role : demoEmail.includes('admin') || demoEmail === 'salihtanriseven25@gmail.com' ? 'admin' : 'user';

        const userProfile: UserProfile = {
          id: existing ? existing.id : 'user-' + btoa(demoEmail).replace(/=/g, '').toLowerCase(),
          name: name.charAt(0).toUpperCase() + name.slice(1),
          email: demoEmail,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(demoEmail)}`,
          provider: 'google',
          role,
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
    if (isUserBlocked(email)) {
      alert('⚠️ Bu hesap yönetici tarafından engellenmiştir.');
      return;
    }

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

  const updateUserRole = (userId: string, newRole: 'admin' | 'user') => {
    const updated = userList.map((u) => (u.id === userId ? { ...u, role: newRole } : u));
    saveUserList(updated);

    // If current logged in user's role changed, update active session
    if (user && user.id === userId) {
      saveUserSession({ ...user, role: newRole });
    }
  };

  const toggleUserBlock = (userId: string) => {
    const updated = userList.map((u) => (u.id === userId ? { ...u, status: (u.status === 'blocked' ? 'active' : 'blocked') as 'active' | 'blocked' } : u));
    saveUserList(updated);

    // If current user is blocked, log out immediately
    const target = updated.find((u) => u.id === userId);
    if (target && target.status === 'blocked' && user && user.id === userId) {
      alert('⚠️ Hesabınız engellendi. Oturum kapatılıyor.');
      logout();
    }
  };

  const deleteUser = (userId: string) => {
    const updated = userList.filter((u) => u.id !== userId);
    saveUserList(updated);
    if (user && user.id === userId) {
      logout();
    }
  };

  const addUser = (name: string, email: string, role: 'admin' | 'user') => {
    const newUser: ManagedUser = {
      id: 'user-' + Date.now(),
      name,
      email,
      role,
      status: 'active',
      provider: 'google',
      createdAt: new Date().toISOString().split('T')[0],
    };
    const updated = [newUser, ...userList];
    saveUserList(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        userList,
        loginWithGoogle,
        loginWithDemo,
        logout,
        isAuthModalOpen,
        setIsAuthModalOpen,
        updateUserRole,
        toggleUserBlock,
        deleteUser,
        addUser,
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
