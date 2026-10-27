'use client';

import React from 'react';
import { BrandGlyph } from '@/components/common/BrandLogo';

/**
 * Uygulama açılırken (çalışma alanı tarayıcıdan/buluttan yüklenirken) tam ekran gösterilen karşılama.
 * Tarayıcıda temaya uyar; ana ekrandan açılan uygulamada (PWA) telefonun açılış ekranının devamıdır:
 * aynı zemin, aynı simge ve konum (bkz. globals.css `.app-splash`). `visible` false olunca yumuşakça kaybolur.
 */
export function AppSplash({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={`app-splash fixed inset-0 z-[80] transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Simge tam ortada: telefonun açılış ekranındaki simgeyle üst üste gelir. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-40 h-40 flex items-center justify-center">
          <span className="app-splash-glow absolute inset-0 rounded-full" aria-hidden="true" />
          <BrandGlyph className="relative w-[4.75rem] h-[4.75rem]" sparkleClassName="app-splash-sparkle" />
        </div>
      </div>
      <div className="absolute inset-x-0 top-1/2 mt-24 flex justify-center">
        <div role="status" aria-label="Çalışma alanınız hazırlanıyor" className="app-splash-track h-1 w-28 rounded-full overflow-hidden">
          <span className="app-splash-bar block h-full w-1/3 rounded-full" />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-[max(3rem,calc(env(safe-area-inset-bottom)+2rem))] text-center px-6">
        <p className="app-splash-title text-xl font-semibold tracking-tight">Automania POD</p>
        <p className="app-splash-muted text-xs mt-1">Etsy Print-on-Demand Studio</p>
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
