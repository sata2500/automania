'use client';

/**
 * İlanlar merkezi iki bölümdür: Hazır İlanlar ve Etsy'deki İlanlarım. Yeni ilan hazırlamak (ilan stüdyosu:
 * AI metin, varyasyon, mağaza ayarları) Hazır İlanlar'ın içinden açılır ve bitince ilan kuyruğa eklenir.
 * Stüdyo bir kez açıldıktan sonra gizlenerek bağlı tutulur; geri dönüldüğünde yazılanlar kaybolmaz.
 */
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, ClipboardCheck, ShoppingBag } from 'lucide-react';
import { TabSkeleton } from '@/components/common/LoadingScreens';
import { STORAGE_KEYS } from '@/config/constants';
import { LISTINGS_OPEN_EVENT, isListingsView, readSavedListingsView, type ListingsView } from './listings-view';

const ListingReviewQueue = dynamic(() => import('@/components/review/ListingReviewQueue').then(mod => mod.ListingReviewQueue), { ssr: false, loading: () => <TabSkeleton label="Hazır ilanlar yükleniyor" layout="list" /> });
const EtsySeoHelper = dynamic(() => import('@/components/seo/EtsySeoHelper').then(mod => mod.EtsySeoHelper), { ssr: false, loading: () => <TabSkeleton label="İlan stüdyosu yükleniyor" layout="list" /> });
const EtsyListingManager = dynamic(() => import('@/components/listings/EtsyListingManager').then(mod => mod.EtsyListingManager), { ssr: false, loading: () => <TabSkeleton label="Etsy ilanları yükleniyor" layout="list" /> });

const TABS: { key: 'review' | 'etsy'; label: string; icon: React.ElementType }[] = [
  { key: 'review', label: 'Hazır İlanlar', icon: ClipboardCheck },
  { key: 'etsy', label: "Etsy'deki İlanlarım", icon: ShoppingBag },
];

export function ListingsHub() {
  const [view, setViewState] = useState<ListingsView>(readSavedListingsView);
  const [studioMounted, setStudioMounted] = useState(view === 'studio');

  const setView = (next: ListingsView) => {
    setViewState(next);
    if (next === 'studio') setStudioMounted(true);
    try { localStorage.setItem(STORAGE_KEYS.LISTINGS_VIEW, next); } catch {}
  };

  useEffect(() => {
    const onOpen = (event: Event) => {
      const next = (event as CustomEvent).detail;
      if (!isListingsView(next)) return;
      setViewState(next);
      if (next === 'studio') setStudioMounted(true);
    };
    window.addEventListener(LISTINGS_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(LISTINGS_OPEN_EVENT, onOpen);
  }, []);

  return (
    <div>
      <div role="tablist" aria-label="İlan görünümü" className="flex w-full sm:w-auto sm:inline-flex items-center gap-1 mb-5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60">
        {TABS.map(({ key, label, icon: Icon }) => {
          // Yeni ilan (stüdyo) Hazır İlanlar'ın parçasıdır.
          const isActive = key === 'review' ? view !== 'etsy' : view === key;
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

      {view === 'review' && <ListingReviewQueue onCreate={() => setView('studio')} />}
      {view === 'studio' && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={() => setView('review')}
            className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Hazır İlanlar
          </button>
          <span className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 text-right">Hazırladığınız ilan Hazır İlanlar&apos;a eklenir; oradan yayınlar veya zamanlarsınız.</span>
        </div>
      )}
      {studioMounted && <div hidden={view !== 'studio'}><EtsySeoHelper /></div>}
      {view === 'etsy' && <EtsyListingManager />}
    </div>
  );
}
