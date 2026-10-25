'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';

/** Marka logosu (başlıktakiyle aynı): yükleme ekranlarında kullanılır. */
function BrandMark({ className = 'w-14 h-14' }: { className?: string }) {
  return (
    <div className={`${className} rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-xl shadow-indigo-500/30`}>
      <Layers className="w-1/2 h-1/2 text-white" />
    </div>
  );
}

/**
 * Uygulama açılırken (çalışma alanı tarayıcıdan/buluttan yüklenirken) tam ekran gösterilen karşılama.
 * `visible` false olunca yumuşakça kaybolur.
 */
export function AppSplash({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center gap-5 bg-slate-50 dark:bg-slate-950 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <div className="relative">
        <span className="absolute inset-0 rounded-2xl bg-indigo-500/30 blur-xl animate-pulse [animation-duration:2s]" aria-hidden="true" />
        <div className="relative animate-in zoom-in-90 fade-in duration-500">
          <BrandMark />
        </div>
      </div>
      <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-500 [animation-delay:120ms] [animation-fill-mode:both]">
        <p className="text-lg font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 dark:from-white dark:via-slate-200 dark:to-indigo-300 bg-clip-text text-transparent">Automania POD</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Etsy Print-on-Demand Studio</p>
      </div>
      <div role="status" className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Spinner className="w-4 h-4 text-indigo-500" />
        Çalışma alanınız hazırlanıyor…
      </div>
    </div>
  );
}

/** Sekme kodu indirilirken gösterilen, sayfa düzenine benzeyen iskelet. */
export function TabSkeleton({ label, layout = 'grid' }: { label: string; layout?: 'grid' | 'editor' | 'list' }) {
  return (
    <div role="status" aria-label={label} className="space-y-4 animate-in fade-in duration-300">
      <span className="sr-only">{label}</span>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-5 w-48" />
          <div className="skeleton h-3 w-72 max-w-[60vw]" />
        </div>
        <div className="skeleton h-9 w-28 hidden sm:block" />
      </div>
      {layout === 'editor' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-4">
          <div className="skeleton h-64 hidden lg:block" />
          <div className="skeleton h-80 sm:h-[28rem]" />
          <div className="skeleton h-64 hidden lg:block" />
        </div>
      ) : layout === 'list' ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-16" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton aspect-square" />)}
        </div>
      )}
    </div>
  );
}
