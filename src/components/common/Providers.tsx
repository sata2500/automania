'use client';

import React from 'react';
import { UserAuthProvider } from './UserAuthContext';
import { ThemeProvider } from './ThemeProvider';
import { ToastProvider } from './ToastContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UserAuthProvider>
      <ThemeProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </ThemeProvider>
    </UserAuthProvider>
  );
}
