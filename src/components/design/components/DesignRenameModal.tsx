import React, { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { DesignItem } from '@/types/pod';
import { DialogPanel } from '@/components/common/DialogPanel';

interface DesignRenameModalProps {
  design: DesignItem;
  onClose: () => void;
  onSave: (name: string) => void;
}

/** Tasarımı yeniden adlandırır (ör. siparişteki SKU ile; arama ada ve SKU'lara bakar). */
export const DesignRenameModal: React.FC<DesignRenameModalProps> = ({ design, onClose, onSave }) => {
  const [name, setName] = useState(design.name);
  const trimmed = name.replace(/\s+/g, ' ').trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
      <DialogPanel aria-labelledby="design-rename-title" onClose={onClose} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 id="design-rename-title" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Pencil className="w-4 h-4 text-indigo-500" /> Tasarımı yeniden adlandır
          </h3>
          <button type="button" onClick={onClose} aria-label="Kapat" className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) onSave(trimmed.slice(0, 120));
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Ör. TSH-261029-K7QD · Kedi Annesi"
            className="w-full px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {(design.skus?.length ?? 0) > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Bu tasarımın ilan SKU&apos;ları: <span className="font-mono">{design.skus!.join(', ')}</span> (adı değişse de SKU ile bulunur)
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">Vazgeç</button>
            <button type="submit" disabled={!trimmed} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50">Kaydet</button>
          </div>
        </form>
      </DialogPanel>
    </div>
  );
};
