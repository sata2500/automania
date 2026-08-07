'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'progress';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  progress?: number; // 0 to 100
  duration?: number; // ms, default 3500ms
  _timerId?: number; // internal: auto-dismiss timer handle
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  updateProgressToast: (id: string, progress: number, message?: string) => void;
  success: (message: string, title?: string, duration?: number) => string;
  error: (message: string, title?: string, duration?: number) => string;
  info: (message: string, title?: string, duration?: number) => string;
  warning: (message: string, title?: string, duration?: number) => string;
  progress: (message: string, initialProgress?: number, title?: string) => string;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => {
      const toast = prev.find((t) => t.id === id);
      // Clear any pending auto-dismiss timer to avoid redundant state updates
      if (toast?._timerId) clearTimeout(toast._timerId);
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, 'id'>): string => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 9);

      const newToast: ToastItem = { ...toast, id };

      setToasts((prev) => [...prev.slice(-4), newToast]); // Keep max 5 toasts visible

      const duration = toast.duration ?? (toast.type === 'progress' ? 0 : 4000);
      if (duration > 0) {
        const timerId = setTimeout(() => {
          removeToast(id);
        }, duration);
        // Store timerId on the toast so manual dismiss can cancel it
        newToast._timerId = timerId as unknown as number;
      }

      return id;
    },
    [removeToast]
  );

  const updateProgressToast = useCallback((id: string, progress: number, message?: string) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            progress: Math.min(100, Math.max(0, progress)),
            ...(message ? { message } : {}),
          };
        }
        return t;
      })
    );
  }, []);

  const success = useCallback(
    (message: string, title = 'Başarılı', duration = 3500) =>
      addToast({ type: 'success', title, message, duration }),
    [addToast]
  );

  const error = useCallback(
    (message: string, title = 'Hata', duration = 5000) =>
      addToast({ type: 'error', title, message, duration }),
    [addToast]
  );

  const info = useCallback(
    (message: string, title = 'Bilgi', duration = 3500) =>
      addToast({ type: 'info', title, message, duration }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, title = 'Uyarı', duration = 4500) =>
      addToast({ type: 'warning', title, message, duration }),
    [addToast]
  );

  const progress = useCallback(
    (message: string, initialProgress = 0, title = 'İşleniyor') =>
      addToast({ type: 'progress', title, message, progress: initialProgress, duration: 0 }),
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        updateProgressToast,
        success,
        error,
        info,
        warning,
        progress,
      }}
    >
      {children}
      {/* Toast Notification Layer — aria-live for screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />;
      case 'progress':
        return <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0 mt-0.5" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />;
    }
  };

  const getCardStyle = () => {
    switch (toast.type) {
      case 'success':
        return 'border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-slate-900/98 shadow-emerald-100 dark:shadow-emerald-950/20';
      case 'error':
        return 'border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-900/98 shadow-rose-100 dark:shadow-rose-950/20';
      case 'warning':
        return 'border-amber-200 dark:border-amber-500/30 bg-white dark:bg-slate-900/98 shadow-amber-100 dark:shadow-amber-950/20';
      case 'progress':
        return 'border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-slate-900/98 shadow-indigo-100 dark:shadow-indigo-950/20';
      case 'info':
      default:
        return 'border-sky-200 dark:border-sky-500/30 bg-white dark:bg-slate-900/98 shadow-sky-100 dark:shadow-sky-950/20';
    }
  };

  // Only error/warning toasts use role="alert" (interrupts screen reader immediately).
  // Informational toasts use role="status" (politely announced).
  const ariaRole = (toast.type === 'error' || toast.type === 'warning') ? 'alert' : 'status';

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-bottom-3 ${getCardStyle()}`}
      role={ariaRole}
    >
      {getIcon()}
      <div className="flex-1 min-w-0 pr-1">
        {toast.title && (
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
            {toast.title}
          </h4>
        )}
        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed break-words">
          {toast.message}
        </p>

        {toast.type === 'progress' && typeof toast.progress === 'number' && (
          <div className="mt-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${toast.progress}%` }}
            />
          </div>
        )}
      </div>

      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60"
        aria-label="Kapat"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
