'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'progress';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  progress?: number; // 0 to 100
  duration?: number; // ms; 0 = kullanıcı kapatana kadar
}

const MAX_VISIBLE_TOASTS = 3;

interface ToastContextType {
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
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, 'id'>): string => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 9);
      const duration = toast.duration ?? (toast.type === 'progress' ? 0 : 4000);
      // Aynı anda en fazla 3 bildirim: en eskisi düşer. Otomatik kapanma kartın kendisinde yönetilir
      // (fareyle üzerine gelince duraklar).
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE_TOASTS - 1)), { ...toast, id, duration }]);
      return id;
    },
    []
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

  // Değer sabit tutulur: aksi halde her bildirim tüm tüketicileri yeniden render eder
  // (ör. açık modalların durumunu sıfırlayan efektleri tetikler).
  // Bildirim listesi (`toasts`) yalnızca bu sağlayıcının kendi katmanında kullanılır; bağlama
  // konmaz ki yeni bir bildirim, bildirimi kullanan her bileşeni yeniden çizmesin.
  const value = useMemo(
    () => ({ addToast, removeToast, updateProgressToast, success, error, info, warning, progress }),
    [addToast, removeToast, updateProgressToast, success, error, info, warning, progress],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Bildirim katmanı: masaüstünde sağ alt köşe; mobil ve tablette alt gezinme çubuğunun üstünde ortalı */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed z-[60] flex flex-col gap-2 pointer-events-none bottom-[calc(env(safe-area-inset-bottom)+88px)] left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-sm lg:bottom-5 lg:right-5 lg:left-auto lg:translate-x-0 lg:w-80"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TOAST_STYLES: Record<ToastType, { icon: React.ReactNode; accent: string; bar: string }> = {
  success: { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, accent: 'bg-emerald-500', bar: 'bg-emerald-500/70' },
  error: { icon: <AlertCircle className="w-4 h-4 text-rose-500" />, accent: 'bg-rose-500', bar: 'bg-rose-500/70' },
  warning: { icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, accent: 'bg-amber-500', bar: 'bg-amber-500/70' },
  info: { icon: <Info className="w-4 h-4 text-sky-500" />, accent: 'bg-sky-500', bar: 'bg-sky-500/70' },
  progress: { icon: <Spinner className="w-4 h-4 text-indigo-500" />, accent: 'bg-indigo-500', bar: 'bg-indigo-500' },
};

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const duration = toast.duration ?? 0;
  const [isPaused, setIsPaused] = useState(false);
  const remainingRef = useRef(duration);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Otomatik kapanma: fare kartın üzerindeyken (veya odak içindeyken) süre durur, kalan süreden devam eder.
  useEffect(() => {
    if (duration <= 0 || isPaused) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => onCloseRef.current(), remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
    };
  }, [duration, isPaused]);

  const style = TOAST_STYLES[toast.type] ?? TOAST_STYLES.info;
  // Yalnızca hata/uyarı ekran okuyucuyu hemen keser; diğerleri sırayla duyurulur.
  const ariaRole = (toast.type === 'error' || toast.type === 'warning') ? 'alert' : 'status';

  return (
    <div
      role={ariaRole}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className="group pointer-events-auto relative overflow-hidden flex items-start gap-2.5 pl-3.5 pr-2 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-lg shadow-slate-900/10 dark:shadow-black/40 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${style.accent}`} aria-hidden="true" />
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-[12px] font-semibold text-slate-900 dark:text-white leading-tight">{toast.title}</p>
        )}
        <p className={`text-[12px] text-slate-600 dark:text-slate-300 leading-snug break-words ${toast.title ? 'mt-0.5' : ''}`}>
          {toast.message}
        </p>
        {toast.type === 'progress' && typeof toast.progress === 'number' && (
          <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 overflow-hidden" role="progressbar" aria-valuenow={Math.round(toast.progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`${style.bar} h-1 rounded-full transition-all duration-300 ease-out`} style={{ width: `${toast.progress}%` }} />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Bildirimi kapat"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {duration > 0 && (
        <span
          aria-hidden="true"
          className={`absolute bottom-0 left-0 h-0.5 ${style.bar} origin-left`}
          style={{ width: '100%', animation: `toast-countdown ${duration}ms linear forwards`, animationPlayState: isPaused ? 'paused' : 'running' }}
        />
      )}
    </div>
  );
}
