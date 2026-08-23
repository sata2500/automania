'use client';

import React from 'react';
import { CloudUpload, RefreshCw, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import { SyncStatus } from '@/lib/storage-service';

interface SyncStatusBannerProps {
  syncStatus: SyncStatus;
}

export const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({ syncStatus }) => {
  const { isSyncing, isMigrating, message, progress, current, total } = syncStatus;

  // Show banner if actively migrating, actively syncing with message, or if just completed at 100%
  const isVisible = isMigrating || (isSyncing && message) || (!isSyncing && !isMigrating && progress === 100 && message);

  if (!isVisible) return null;

  const isCompleted = !isSyncing && !isMigrating && progress === 100;

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 pt-2 pb-2 animate-fadeIn">
      <div
        role="status"
        aria-live="polite"
        className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-2xl backdrop-blur-xl transition-all duration-500 ${
          isCompleted
            ? 'border-emerald-500/40 bg-gradient-to-r from-emerald-900/90 via-teal-900/90 to-slate-900/95 text-white shadow-emerald-500/10'
            : 'border-indigo-500/40 bg-gradient-to-r from-indigo-950/95 via-purple-950/95 to-slate-950/98 text-white shadow-indigo-500/20'
        }`}
      >
        {/* Ambient Glows */}
        <div
          className={`absolute -top-10 -right-10 w-44 h-44 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
            isCompleted ? 'bg-emerald-500/20' : 'bg-indigo-500/25 animate-pulse'
          }`}
        />
        <div
          className={`absolute -bottom-10 -left-10 w-44 h-44 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
            isCompleted ? 'bg-teal-500/20' : 'bg-purple-500/25 animate-pulse'
          }`}
        />

        <div className="relative z-10 space-y-3.5">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform duration-500 ${
                  isCompleted
                    ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-emerald-500/30 scale-105'
                    : 'bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-indigo-500/30'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 text-white animate-in zoom-in-50" />
                ) : isMigrating ? (
                  <CloudUpload className="w-6 h-6 text-white animate-bounce" />
                ) : (
                  <RefreshCw className="w-5 h-5 text-white animate-spin" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                    <span>
                      {isCompleted
                        ? 'Senkronizasyon Başarıyla Tamamlandı'
                        : isMigrating
                        ? 'Yerel Verileriniz Bulut Hesabınıza Senkronize Ediliyor'
                        : 'Bulut Senkronizasyonu Devam Ediyor'}
                    </span>
                  </h4>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      isCompleted
                        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                        : 'bg-indigo-500/30 border-indigo-400/40 text-indigo-200'
                    }`}
                  >
                    {isCompleted ? '✓ Tamamlandı' : isMigrating ? '⚡ Aktarım Yapılıyor' : '☁️ Eşitleniyor'}
                  </span>
                </div>

                <p className="text-xs text-slate-200/90 mt-0.5 leading-relaxed font-medium">
                  {message || (isMigrating
                    ? 'Giriş yapmadan önce hazırladığınız yerel çalışmalarınız güvenle kişisel bulut hesabınıza kaydediliyor.'
                    : 'Bulut verileriniz güncelleniyor.')}
                </p>
              </div>
            </div>

            {/* Progress Badge */}
            {typeof progress === 'number' && progress > 0 && (
              <div className="self-end sm:self-center shrink-0 flex items-center gap-2 bg-white/10 dark:bg-slate-900/60 border border-white/15 px-3 py-1.5 rounded-xl text-xs font-bold font-mono">
                {total && total > 0 ? (
                  <span className="text-indigo-200">
                    {current || 0} / {total} Görsel
                  </span>
                ) : null}
                <span className={isCompleted ? 'text-emerald-300 font-extrabold' : 'text-white'}>
                  %{progress}
                </span>
              </div>
            )}
          </div>

          {/* Animated Progress Bar */}
          {typeof progress === 'number' && (
            <div className="w-full bg-slate-900/60 rounded-full h-2 overflow-hidden border border-white/10 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  isCompleted
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-300'
                    : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-400 animate-pulse'
                }`}
                style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
              />
            </div>
          )}

          {/* Warning / Safety Notice */}
          {!isCompleted && isMigrating && (
            <div className="flex items-center gap-2 pt-1 text-[11px] text-amber-200/95 font-medium bg-amber-500/10 border border-amber-400/20 rounded-xl px-3 py-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <b>Önemli:</b> Veri kaybı yaşamamak için lütfen işlem tamamlanana kadar sayfayı <u>kapatmayın</u> veya <u>yenilemeyin</u>.
              </span>
            </div>
          )}

          {isCompleted && (
            <div className="flex items-center gap-2 pt-0.5 text-[11px] text-emerald-200 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Tüm mockup, tasarım ve toplu üretimleriniz kişisel hesabınıza aktarıldı ve kullanıma hazır!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
