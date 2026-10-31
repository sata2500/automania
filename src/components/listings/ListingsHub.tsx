'use client';

/**
 * İlanlar merkezi iki bölümdür: Hazır İlanlar (otomasyonların ve Üretim'deki "İlan Oluştur"un hazırladığı
 * ilanlar) ve Etsy'deki İlanlarım. İlan ayarları mockup klasöründe (Klasör ayarları), varyasyon şablonları Ayarlar'da yönetilir.
 */
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ClipboardCheck, ShoppingBag } from 'lucide-react';
import { TabSkeleton } from '@/components/common/LoadingScreens';
import { STORAGE_KEYS } from '@/config/constants';
import { LISTINGS_OPEN_EVENT, isListingsView, readSavedListingsView, type ListingsView } from './listings-view';

const ListingReviewQueue = dynamic(() => import('@/components/review/ListingReviewQueue').then(mod => mod.ListingReviewQueue), { ssr: false, loading: () => <TabSkeleton label="Hazır ilanlar yükleniyor" layout="list" /> });
const EtsyListingManager = dynamic(() => import('@/components/listings/EtsyListingManager').then(mod => mod.EtsyListingManager), { ssr: false, loading: () => <TabSkeleton label="Etsy ilanları yükleniyor" layout="list" /> });

const TABS: { key: ListingsView; label: string; icon: React.ElementType }[] = [
  { key: 'review', label: 'Hazır İlanlar', icon: ClipboardCheck },
  { key: 'etsy', label: "Etsy'deki İlanlarım", icon: ShoppingBag },
];

export function ListingsHub() {
  const [view, setViewState] = useState<ListingsView>(readSavedListingsView);

  const setView = (next: ListingsView) => {
    setViewState(next);
    try { localStorage.setItem(STORAGE_KEYS.LISTINGS_VIEW, next); } catch {}
  };

  useEffect(() => {
    const onOpen = (event: Event) => {
      const next = (event as CustomEvent).detail;
      if (!isListingsView(next)) return;
      setViewState(next);
    };
    window.addEventListener(LISTINGS_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(LISTINGS_OPEN_EVENT, onOpen);
  }, []);

  return (
    <div>
      <div role="tablist" aria-label="İlan görünümü" className="flex w-full sm:w-auto sm:inline-flex items-center gap-1 mb-5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = view === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setView(key)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          );
        })}
      </div>

      {view === 'review' && <ListingReviewQueue />}
      {view === 'etsy' && <EtsyListingManager />}
    </div>
  );
}
