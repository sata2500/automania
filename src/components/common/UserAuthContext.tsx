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

  const fetchUsersFromDb = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users) && data.users.length > 0) {
          setUserList(data.users);
          try {
            localStorage.setItem(USER_LIST_STORAGE_KEY, JSON.stringify(data.users));
          } catch {}
        }
      }
    } catch (err) {
      console.error('Failed to fetch central user directory:', err);
    }
  };

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
      }
    } catch {}

    fetchUsersFromDb();
  }, []);

  const saveUserSession = async (userProfile: UserProfile | null) => {
    setUser(userProfile);
    if (userProfile) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userProfile));

      // Central PostgreSQL server database registration
      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userProfile),
        });

        if (res.status === 403) {
          alert('⚠️ Hesabınız yönetici tarafından engellenmiştir.');
          setUser(null);
          localStorage.removeItem(AUTH_STORAGE_KEY);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setUser(data.user);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
          }
        }
      } catch (err) {
        console.error('Error syncing user with server:', err);
      }

      fetchUsersFromDb();
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
        const cleanEmail = demoEmail.trim().toLowerCase();
        if (isUserBlocked(cleanEmail)) {
          alert('⚠️ Bu e-posta adresi yönetici tarafından engellenmiştir. Sisteme giriş yapamazsınız.');
          return;
        }

        const name = cleanEmail.split('@')[0];
        const role = cleanEmail === 'salihtanriseven25@gmail.com' ? 'admin' : 'user';

        const userProfile: UserProfile = {
          id: 'user-' + btoa(cleanEmail).replace(/=/g, '').toLowerCase(),
          name: name.charAt(0).toUpperCase() + name.slice(1),
          email: cleanEmail,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
          provider: 'google',
          role,
        };

        saveUserSession(userProfile);
        setIsAuthModalOpen(false);
      }
    }
  };

  // STRICT Admin security guard: ONLY salihtanriseven25@gmail.com or verified role === 'admin'
  const isAdmin = Boolean(
    user &&
    (user.role === 'admin' || user.email.toLowerCase() === 'salihtanriseven25@gmail.com')
  );

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

  const updateUserRole = async (userId: string, newRole: 'admin' | 'user') => {
    setUserList((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_role', id: userId, role: newRole }),
      });
    } catch {}
    fetchUsersFromDb();
  };

  const toggleUserBlock = async (userId: string) => {
    const target = userList.find((u) => u.id === userId);
    if (!target) return;
    const newStatus = target.status === 'blocked' ? 'active' : 'blocked';

    setUserList((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));

    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_status', id: userId, status: newStatus }),
      });
    } catch {}

    if (newStatus === 'blocked' && user && user.id === userId) {
      alert('⚠️ Hesabınız engellendi. Oturum kapatılıyor.');
      logout();
    }
    fetchUsersFromDb();
  };

  const deleteUser = async (userId: string) => {
    setUserList((prev) => prev.filter((u) => u.id !== userId));
    try {
      await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
    } catch {}
    if (user && user.id === userId) {
      logout();
    }
    fetchUsersFromDb();
  };

  const addUser = (name: string, email: string, role: 'admin' | 'user') => {
    saveUserSession({
      id: 'user-' + Date.now(),
      name,
      email,
      role,
      provider: 'google',
    });
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
