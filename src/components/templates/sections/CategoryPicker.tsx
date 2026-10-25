'use client';

/**
 * Aranabilir Etsy kategori seçici: admin panelinde etkinleştirilen kategoriler arasında yazarak arama,
 * tam yol (Clothing › Shirts & Tees › T-shirts) ve seçili kategoriyi üstte gösterir.
 */
import React, { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';

export type TaxonomyOption = { id: number; name: string; path: string | null };

const MAX_VISIBLE = 60;

function splitPath(option: TaxonomyOption): { leaf: string; parent: string } {
  const parts = (option.path || option.name).split('>').map((p) => p.trim()).filter(Boolean);
  return { leaf: parts[parts.length - 1] || option.name, parent: parts.slice(0, -1).join(' › ') };
}

export function CategoryPicker({ id, categories, value, onChange }: {
  id: string;
  categories: TaxonomyOption[];
  value: number;
  onChange: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const selected = categories.find((c) => c.id === value);

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const list = q
      ? categories.filter((c) => `${c.path ?? ''} ${c.name} ${c.id}`.toLocaleLowerCase('tr').includes(q))
      : categories;
    return list.slice(0, MAX_VISIBLE);
  }, [categories, query]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {selected && (
        <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-500/10 border-b border-purple-100 dark:border-purple-500/20">
          <Check className="w-4 h-4 text-purple-600 shrink-0" aria-hidden="true" />
          <span className="min-w-0 text-xs">
            <span className="block font-bold text-slate-900 dark:text-white truncate">{splitPath(selected).leaf}</span>
            {splitPath(selected).parent && <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{splitPath(selected).parent}</span>}
          </span>
        </div>
      )}
      <div className="relative border-b border-slate-100 dark:border-slate-800">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
        <input
          id={id}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${categories.length} kategori içinde ara (ör. t-shirt, hoodie, mug)`}
          className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          aria-controls={`${id}-list`}
        />
      </div>
      <ul id={`${id}-list`} role="listbox" aria-label="Etsy kategorileri" className="max-h-52 overflow-y-auto bg-white dark:bg-slate-900">
        {matches.length === 0 && <li className="px-3 py-3 text-xs text-slate-500">Eşleşen kategori yok.</li>}
        {matches.map((option) => {
          const { leaf, parent } = splitPath(option);
          const isSelected = option.id === value;
          return (
            <li key={option.id} role="option" aria-selected={isSelected}>
              <button
                type="button"
                onClick={() => onChange(option.id)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-xs transition-colors ${isSelected ? 'bg-purple-50 dark:bg-purple-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-800 dark:text-slate-100 truncate">{leaf}</span>
                  {parent && <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{parent}</span>}
                </span>
                {isSelected && <Check className="w-4 h-4 text-purple-600 shrink-0" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
