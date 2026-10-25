'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from './UserAuthContext';
import { useToast } from './ToastContext';
import { getGuestWorkspace, migrateGuestWorkspaceToUser, clearGuestWorkspace, AppDataPayload } from '@/lib/storage-service';
import { Sparkles, ArrowRight, X } from 'lucide-react';

import { MockupItem, DesignItem } from '@/types/pod';

interface GuestMigrationBannerProps {
  currentMockups?: MockupItem[];
  currentDesigns?: DesignItem[];
  onMigrationComplete?: (payload: AppDataPayload) => void;
}

export const GuestMigrationBanner: React.FC<GuestMigrationBannerProps> = ({
  currentMockups = [],
  currentDesigns = [],
  onMigrationComplete,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  // Misafir verisi, okunduğu kullanıcıya bağlı tutulur; oturum değişince eski kayıt gösterilmez.
  const [guestState, setGuestState] = useState<{ userId: string; data: AppDataPayload } | null>(null);
  const guestData = user && guestState?.userId === user.id ? guestState.data : null;
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!user) return;

    const userId = user.id;
    let isMounted = true;
    getGuestWorkspace().then((data) => {
      if (!isMounted) return;
      if (
        data &&
        ((data.mockups && data.mockups.length > 0) ||
          (data.designs && data.designs.length > 0) ||
          (data.etsyGeneratedMockups && data.etsyGeneratedMockups.length > 0))
      ) {
        setGuestState({ userId, data });
      } else {
        setGuestState(null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user, currentMockups.length, currentDesigns.length]);

  const hasAccountData = currentMockups.length > 0 || currentDesigns.length > 0;

  // Do not show merge banner if user is logged out, no guest data, dismissed, or if account is completely empty (auto-migrated)
  if (!user || !guestData || isDismissed || !hasAccountData) return null;

  const guestMockupCount = guestData.mockups?.length || 0;
  const guestDesignCount = guestData.designs?.length || 0;
  const guestBatchCount = guestData.etsyGeneratedMockups?.length || 0;
  const accountMockupCount = currentMockups.length;

  const parts: string[] = [];
  if (guestMockupCount > 0) parts.push(`+${guestMockupCount} Mockup`);
  if (guestDesignCount > 0) parts.push(`+${guestDesignCount} Tasarım`);
  if (guestBatchCount > 0) parts.push(`+${guestBatchCount} Toplu Üretim`);
  const badgeText = parts.join(' • ') || 'Yerel Taslak';

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      // Hesabın mevcut verisi birleştirme sırasında sunucudan okunur.
      const merged = await migrateGuestWorkspaceToUser();
      if (merged) {
        if (onMigrationComplete) {
          onMigrationComplete(merged);
        }
        setGuestState(null);
      }
    } catch (err) {
      console.error('Migration failed:', err);
      const detail = err instanceof Error ? err.message : '';
      toast.error(`${detail ? `${detail} ` : ''}Yerel taslaklarınız silinmedi; tekrar deneyebilirsiniz.`, 'Birleştirme Başarısız');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const handleClearGuest = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    await clearGuestWorkspace();
    setGuestState(null);
    setConfirmClear(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 pt-2 pb-2 animate-fadeIn">
      <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-slate-900/90 border border-indigo-200 dark:border-indigo-500/30 p-4 sm:p-5 shadow-lg text-slate-800 dark:text-slate-100 backdrop-blur-md">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center shrink-0 shadow-sm text-indigo-600 dark:text-indigo-400 mt-0.5 sm:mt-0">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Yerel Çalışmalarınız Bulut Hesabınızla Birleştirilsin mi?
                </span>
                <span className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                  {badgeText}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                Bulut hesabınızda <b className="text-slate-900 dark:text-white">{accountMockupCount} Mockup</b> bulunuyor. Giriş yapmadan önce hazırladığınız yerel çalışmaları bulut hesabınıza dahil edebilirsiniz.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end items-center gap-2 self-end sm:self-center shrink-0">
            <button
              onClick={handleMigrate}
              disabled={isMigrating}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{isMigrating ? 'Aktarılıyor...' : 'Yerel Çalışmalarımla Birleştir'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleClearGuest}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                confirmClear
                  ? 'bg-red-600 hover:bg-red-500 text-white border-red-600'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title="Yalnızca bulut hesabındaki verileri kullan (yerel taslaklar bu cihazdan silinir)"
            >
              {confirmClear ? 'Yerel taslaklar silinsin mi? Evet' : 'Yalnızca Bulutu Kullan'}
            </button>

            <button
              onClick={handleDismiss}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer ml-0.5"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
