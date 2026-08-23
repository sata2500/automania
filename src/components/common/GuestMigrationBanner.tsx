'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from './UserAuthContext';
import { useToast } from './ToastContext';
import { getGuestWorkspace, migrateGuestWorkspaceToUser, clearGuestWorkspace, AppDataPayload } from '@/lib/storage-service';
import { Sparkles, ArrowRight, X } from 'lucide-react';

import { MockupItem, DesignItem, MockupFolder } from '@/types/pod';

interface GuestMigrationBannerProps {
  currentMockups?: MockupItem[];
  currentDesigns?: DesignItem[];
  currentFolders?: MockupFolder[];
  onMigrationComplete?: (payload: AppDataPayload) => void;
}

export const GuestMigrationBanner: React.FC<GuestMigrationBannerProps> = ({
  currentMockups = [],
  currentDesigns = [],
  currentFolders = [],
  onMigrationComplete,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const [guestData, setGuestData] = useState<AppDataPayload | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    if (!user) {
      setGuestData(null);
      return;
    }

    let isMounted = true;
    getGuestWorkspace().then((data) => {
      if (!isMounted) return;
      if (data && ((data.mockups && data.mockups.length > 0) || (data.designs && data.designs.length > 0))) {
        setGuestData(data);
      } else {
        setGuestData(null);
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
  const accountMockupCount = currentMockups.length;

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      const merged = await migrateGuestWorkspaceToUser({
        mockups: currentMockups,
        designs: currentDesigns,
        folders: currentFolders,
      });
      if (merged) {
        if (onMigrationComplete) {
          onMigrationComplete(merged);
        }
        setGuestData(null);
        toast.success(
          `Yerel çalışmalarınız (${guestMockupCount} Mockup) bulut hesabınızla başarıyla birleştirildi!`,
          'Birleştirme Tamamlandı'
        );
      }
    } catch (err) {
      console.error('Migration failed:', err);
      toast.error('Taslaklar birleştirilirken bir sorun oluştu.', 'Hata');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const handleClearGuest = async () => {
    await clearGuestWorkspace();
    setGuestData(null);
    toast.info('Misafir taslakları temizlendi.', 'Bilgi');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-3 pb-1 animate-fadeIn">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-slate-900/95 border border-indigo-500/30 p-4 shadow-xl text-white backdrop-blur-md">
        {/* Glow effect */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">Yerel Çalışmalarınız Bulut Hesabınızla Birleştirilsin mi?</span>
                <span className="bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  +{guestMockupCount} Mockup • +{guestDesignCount} Tasarım
                </span>
              </div>
              <p className="text-xs text-indigo-200/90 mt-0.5">
                Bulut hesabınızda <b className="text-white">{accountMockupCount} Mockup</b> var. Giriş yapmadan önce hazırladığınız yerel taslakları bulut hesabınıza ekleyip birleştirebilirsiniz.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              onClick={handleMigrate}
              disabled={isMigrating}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isMigrating ? 'Birleştiriliyor...' : 'Yerel Çalışmalarımla Birleştir'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleClearGuest}
              className="px-3 py-2 bg-white/10 hover:bg-white/15 text-indigo-100 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              title="Yalnızca bulut hesabındaki verileri kullan"
            >
              Yalnızca Bulutu Kullan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
