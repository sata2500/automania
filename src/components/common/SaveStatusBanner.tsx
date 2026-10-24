'use client';

import React, { useState } from 'react';
import { AlertTriangle, CloudOff, RefreshCw, Download, Upload } from 'lucide-react';
import type { SaveStatus } from '@/lib/storage-service';

interface SaveStatusBannerProps {
  saveStatus: SaveStatus;
  hasConflict: boolean;
  onResolveConflict: (choice: 'server' | 'local') => Promise<boolean>;
  onRetry: () => void;
}

/**
 * Bulut kaydı başarısız olduğunda veya başka bir cihazla sürüm çakışması oluştuğunda
 * kullanıcıyı bilgilendirir ve çözüm seçenekleri sunar. Her şey yolundaysa görünmez.
 */
export const SaveStatusBanner: React.FC<SaveStatusBannerProps> = ({ saveStatus, hasConflict, onResolveConflict, onRetry }) => {
  const [busy, setBusy] = useState<'server' | 'local' | null>(null);
  const [confirmLocal, setConfirmLocal] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const isError = saveStatus.state === 'error';
  if (!hasConflict && !isError) return null;

  const resolve = async (choice: 'server' | 'local') => {
    setBusy(choice);
    setResolveError(null);
    const ok = await onResolveConflict(choice).catch(() => false);
    setBusy(null);
    setConfirmLocal(false);
    if (!ok) setResolveError('İşlem tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.');
  };

  if (hasConflict) {
    return (
      <div role="alert" className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 pt-2 pb-2">
        <div className="rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Çalışma alanınız başka bir yerde değiştirildi</p>
                <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                  Başka bir cihazda, sekmede ya da bir otomasyon tarafından daha yeni değişiklikler kaydedildi. Verilerin
                  birbirinin üzerine yazılmaması için bu cihazdaki değişiklikler buluta gönderilmedi (bu cihazda saklanıyor).
                  Hangi sürümle devam etmek istediğinizi seçin.
                </p>
                {resolveError && <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1">{resolveError}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => resolve('server')}
                disabled={busy !== null}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {busy === 'server' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Buluttaki sürümü yükle
              </button>
              {confirmLocal ? (
                <button
                  type="button"
                  onClick={() => resolve('local')}
                  disabled={busy !== null}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-sm disabled:opacity-60 cursor-pointer"
                >
                  {busy === 'local' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Evet, buluttakinin üzerine yaz
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmLocal(true)}
                  disabled={busy !== null}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs font-bold disabled:opacity-60 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Bu cihazdakini kaydet
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const canRetry = saveStatus.reason === 'network' || saveStatus.reason === 'server';
  return (
    <div role="alert" className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 pt-2 pb-2">
      <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/30 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <CloudOff className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-red-900 dark:text-red-200">Değişiklikler buluta kaydedilemedi</p>
              <p className="text-xs text-red-800 dark:text-red-300/90 mt-0.5 leading-relaxed">{saveStatus.message}</p>
            </div>
          </div>
          {canRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-sm self-start md:self-center shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tekrar dene
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
