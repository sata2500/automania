'use client';

import React from 'react';
import { CloudUpload, CheckCircle2, RefreshCw } from 'lucide-react';
import { SyncStatus } from '@/lib/storage-service';

interface SyncStatusNotificationProps {
  syncStatus: SyncStatus;
}

export const SyncStatusNotification: React.FC<SyncStatusNotificationProps> = ({ syncStatus }) => {
  const { isMigrating, message, progress, current, total } = syncStatus;

  // Only show bottom-right notification during actual migration or briefly upon migration completion
  const isCompleted = !isMigrating && progress === 100 && Boolean(message);
  const isVisible = isMigrating || isCompleted;

  if (!isVisible) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 max-w-sm w-full pointer-events-auto px-3 sm:px-0 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div
        className={`relative overflow-hidden rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition-all duration-500 ${
          isCompleted
            ? 'border-emerald-500/40 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white shadow-emerald-500/15'
            : 'border-indigo-500/40 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white shadow-indigo-500/20'
        }`}
      >
        {/* Subtle top indicator bar */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${
            isCompleted
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse'
          }`}
        />

        <div className="flex items-start space-x-3 mt-0.5">
          {/* Animated Icon Badge */}
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
              isCompleted
                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 animate-in zoom-in-50" />
            ) : total && total > 0 ? (
              <CloudUpload className="w-5 h-5 animate-bounce" />
            ) : (
              <RefreshCw className="w-4 h-4 animate-spin" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header & Percentage */}
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {isCompleted ? 'Aktarım Tamamlandı' : 'Verileriniz Aktarılıyor'}
              </h4>
              {typeof progress === 'number' && progress > 0 && (
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                    isCompleted
                      ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                      : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                  }`}
                >
                  {total && total > 0 ? `${current || 0}/${total} • ` : ''}%{progress}
                </span>
              )}
            </div>

            {/* Message Description */}
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed line-clamp-2">
              {message || (isMigrating ? 'Yerel taslaklarınız bulut hesabınıza kaydediliyor...' : 'İşlem tamamlandı.')}
            </p>

            {/* Progress Bar */}
            {!isCompleted && typeof progress === 'number' && (
              <div className="mt-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
                />
              </div>
            )}

            {/* Subtext warning */}
            {!isCompleted && isMigrating && (
              <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1.5 font-medium">
                Lütfen bu esnada sayfayı kapatmayın veya yenilemeyin.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
