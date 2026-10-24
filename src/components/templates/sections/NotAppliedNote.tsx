import React from 'react';
import { Info } from 'lucide-react';

/** Şablonda saklanan ama otomasyonun henüz uygulamadığı ayarları dürüstçe belirtir. */
export function NotAppliedNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-900/20 text-[11px] leading-relaxed text-sky-800 dark:text-sky-300">
      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>
        <strong className="mr-1 rounded bg-sky-200/70 dark:bg-sky-800/60 px-1 py-px text-[10px] uppercase tracking-wide">Yakında</strong>
        {children}
      </span>
    </div>
  );
}
