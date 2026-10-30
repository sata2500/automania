import React from 'react';
import { Power } from 'lucide-react';
import type { DesignItem, TargetApparel } from '@/types/pod';
import { SLOT_LABELS } from '../hooks/useDesignSelection';

const SLOT_ORDER: TargetApparel[] = ['both', 'dark', 'light'];

const SLOT_STYLES: Record<TargetApparel, string> = {
  both: 'border-purple-300 dark:border-purple-400/50 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300',
  dark: 'border-amber-300 dark:border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
  light: 'border-indigo-300 dark:border-indigo-400/50 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
};

interface ActiveDesignSlotsProps {
  designs: DesignItem[];
  takenSlots: Record<TargetApparel, string | null>;
  /** Tasarımın kartına gider (bölümü açar, kartı vurgular). */
  onFocusDesign: (id: string) => void;
  onDeactivate: (id: string) => void;
}

/**
 * Üretimdeki tasarımlar: her kumaş slotu (Tüm / Açık / Koyu) için aktif tasarım. Slota dokununca tasarımın
 * kartına gidilir; güç düğmesi tasarımı üretimden çıkarır. Boş slot, kartlardaki kumaş düğmeleriyle doldurulur.
 */
export const ActiveDesignSlots: React.FC<ActiveDesignSlotsProps> = ({ designs, takenSlots, onFocusDesign, onDeactivate }) => (
  <div className="grid grid-cols-3 gap-1.5 sm:gap-2" aria-label="Üretimdeki tasarımlar">
    {SLOT_ORDER.map((slot) => {
      const design = takenSlots[slot] ? designs.find((d) => d.id === takenSlots[slot]) : undefined;
      return (
        <div
          key={slot}
          className={`relative min-w-0 rounded-xl border p-1.5 sm:p-2 ${design ? SLOT_STYLES[slot] : 'border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'}`}
        >
          <button
            type="button"
            disabled={!design}
            onClick={() => design && onFocusDesign(design.id)}
            title={design ? `${SLOT_LABELS[slot]}: ${design.name} (tasarıma git)` : `${SLOT_LABELS[slot]}: aktif tasarım yok`}
            className="w-full min-w-0 text-left disabled:cursor-default"
          >
            <span className="block pr-5 text-[10px] sm:text-[11px] font-bold truncate">{SLOT_LABELS[slot]}</span>
            <span className="mt-1 flex items-center gap-1.5 min-w-0">
              <span className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 rounded-md overflow-hidden bg-[conic-gradient(#e2e8f0_25%,#fff_0_50%,#e2e8f0_0_75%,#fff_0)] bg-[length:8px_8px] dark:bg-[conic-gradient(#334155_25%,#1e293b_0_50%,#334155_0_75%,#1e293b_0)]">
                {design && <img src={design.src} alt="" className="w-full h-full object-contain" loading="lazy" />}
              </span>
              <span className={`min-w-0 text-[10px] sm:text-xs leading-tight line-clamp-2 break-all ${design ? 'font-semibold text-slate-800 dark:text-slate-100' : ''}`}>
                {design ? design.name : 'Boş'}
              </span>
            </span>
          </button>
          {design && (
            <button
              type="button"
              onClick={() => onDeactivate(design.id)}
              aria-label={`${design.name} tasarımını üretimden çıkar`}
              title="Üretimden çıkar"
              className="absolute top-0.5 right-0.5 p-1 rounded-md hover:bg-white/70 dark:hover:bg-slate-900/60"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      );
    })}
  </div>
);
