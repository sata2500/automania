'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { forceSyncFromServer } from '@/lib/storage-service';

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
  avatarUrl?: string;
  createdAt: string;
}

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
  const [userList, setUserList] = useState<ManagedUser[]>([]);
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
    const initializeSession = async () => {
      try {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Do not trust localStorage as authentication. The profile becomes
          // visible only after the server accepts the session sync below.
          
          // Background sync to verify status and update last login
          try {
            const res = await fetch('/api/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(parsed),
            });
            if (res.status === 403) {
              alert('⚠️ Hesabınız yönetici tarafından engellenmiştir.');
              setUser(null);
              localStorage.removeItem(AUTH_STORAGE_KEY);
              return;
            }
            if (!res.ok) {
              setUser(null);
              localStorage.removeItem(AUTH_STORAGE_KEY);
              return;
            }
            const data = await res.json();
            if (data.success && data.user) {
              setUser(data.user);
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
            } else {
              setUser(null);
              localStorage.removeItem(AUTH_STORAGE_KEY);
              return;
            }
            
            // DİKKAT: Kullanıcı oturumu doğrulandıktan hemen sonra sunucudaki en güncel çalışma alanını yerel tarayıcıya zorla eşitle!
            await forceSyncFromServer();
            
          } catch (err) {
            console.error('Session sync error', err);
          }
        }

        const savedUsers = localStorage.getItem(USER_LIST_STORAGE_KEY);
        if (savedUsers) {
          setUserList(JSON.parse(savedUsers));
        }
      } catch {}

      fetchUsersFromDb();
    };

    initializeSession();
  }, []);

  const saveUserSession = async (userProfile: UserProfile | null) => {
    setUser(null);
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
          localStorage.removeItem(AUTH_STORAGE_KEY);
          return;
        }

        if (!res.ok) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          return;
        }

        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } catch (err) {
        console.error('Error syncing user with server:', err);
        localStorage.removeItem(AUTH_STORAGE_KEY);
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
      // Dev fallback: simulate login via prompt when Google OAuth is not configured
      const demoEmail = prompt(
        'Google OAuth Yapılandırılmamış — Geliştirici Modu:\nTest e-posta adresinizi girin:',
        'test@example.com'
      );
      if (demoEmail) {
        const cleanEmail = demoEmail.trim().toLowerCase();
        if (isUserBlocked(cleanEmail)) {
          alert('⚠️ Bu e-posta adresi yönetici tarafından engellenmiştir.');
          return;
        }

        const name = cleanEmail.split('@')[0];
        // Role is always 'user' for new sessions — DB will correct it on first /api/users sync
        const userProfile: UserProfile = {
          id: 'user-' + btoa(cleanEmail).replace(/=/g, '').toLowerCase(),
          name: name.charAt(0).toUpperCase() + name.slice(1),
          email: cleanEmail,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
          provider: 'demo',
          role: 'user',
        };

        saveUserSession(userProfile);
        setIsAuthModalOpen(false);
      }
    }
  };

  // isAdmin is derived solely from the role field set by the server (via JWT / DB).
  // No hardcoded email fallbacks — role must be granted through the Admin Dashboard.
  const isAdmin = Boolean(user && user.role === 'admin');

  // Demo login: creates a temporary local-only session for testing
  // Role is always 'user' by default — to get admin, use seed-admin script + real login
  const loginWithDemo = (email = 'demo@automania.app', name = 'Demo Kullanıcı', role: 'admin' | 'user' = 'user') => {
    if (isUserBlocked(email)) {
      alert('⚠️ Bu hesap yönetici tarafından engellenmiştir.');
      return;
    }

    const userProfile: UserProfile = {
      id: 'user-demo-' + Date.now(),
      name,
      email,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      provider: 'demo',
      role,
    };
    saveUserSession(userProfile);
    setIsAuthModalOpen(false);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
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
