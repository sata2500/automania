'use client';

import React from 'react';
import { Tag, Users, Sparkles, BookOpen, Info } from 'lucide-react';
import { PodTemplateSeoHints } from '@/types/templates';

interface SeoHintsSectionProps {
  hints: PodTemplateSeoHints;
  onChange: (hints: PodTemplateSeoHints) => void;
}

const PRODUCT_TYPES = [
  'T-Shirt', 'Hoodie', 'Sweatshirt', 'Tank Top', 'Long Sleeve',
  'Mug', 'Tote Bag', 'Phone Case', 'Poster', 'Canvas Print',
  'Baby Onesie', 'Youth Shirt', 'V-Neck', 'Crop Top',
];

const TARGET_AUDIENCES = [
  'Dog lovers', 'Cat lovers', 'Gamers', 'Mom gifts', 'Dad gifts',
  'Teachers', 'Nurses', 'Coffee lovers', 'Yoga fans', 'Hikers',
  'Book lovers', 'Music fans', 'Gym goers', 'Pet parents',
];

const POPULAR_NICHES = [
  'Funny Quotes', 'Vintage Retro', 'Cottagecore', 'Dark Academia',
  'Kawaii', 'Minimalist', 'Nature & Outdoors', 'Sports Fan',
  'Faith & Christian', 'Halloween', 'Christmas', 'Political',
  'Pride & LGBTQ+', 'Anniversary & Wedding', 'Birthday',
];

export function SeoHintsSection({ hints, onChange }: SeoHintsSectionProps) {
  const update = (field: keyof PodTemplateSeoHints, value: string) => {
    onChange({ ...hints, [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* Bilgi Baneri */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-xl text-xs text-blue-700 dark:text-blue-400">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Bu bilgiler, AI tasarım üretiminde ve SEO içerik oluşturmada kullanılacak. Ne kadar detaylı doldurursanız, çıktılar o kadar kaliteli olur.
        </span>
      </div>

      {/* Ürün Tipi */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-indigo-500" />
          Ürün Tipi
        </label>
        <input
          type="text"
          value={hints.productType}
          onChange={e => update('productType', e.target.value)}
          placeholder="Örn: T-Shirt, Hoodie, Mug..."
          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 mb-2"
        />
        <div className="flex flex-wrap gap-1">
          {PRODUCT_TYPES.filter(t => t !== hints.productType).slice(0, 10).map(t => (
            <button
              key={t}
              onClick={() => update('productType', t)}
              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-400 rounded-md text-[11px] font-semibold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Hedef Kitle */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-purple-500" />
          Hedef Kitle
        </label>
        <input
          type="text"
          value={hints.targetAudience}
          onChange={e => update('targetAudience', e.target.value)}
          placeholder="Örn: Dog lovers, Nurses, Gamers..."
          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 mb-2"
        />
        <div className="flex flex-wrap gap-1">
          {TARGET_AUDIENCES.filter(a => a !== hints.targetAudience).slice(0, 8).map(a => (
            <button
              key={a}
              onClick={() => update('targetAudience', a)}
              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-500/10 text-slate-600 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-400 rounded-md text-[11px] font-semibold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Birincil Niş */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Birincil Niş / Tema
        </label>
        <input
          type="text"
          value={hints.primaryNiche}
          onChange={e => update('primaryNiche', e.target.value)}
          placeholder="Örn: Funny Pet Quotes, Vintage Retro..."
          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 mb-2"
        />
        <div className="flex flex-wrap gap-1">
          {POPULAR_NICHES.filter(n => n !== hints.primaryNiche).slice(0, 10).map(n => (
            <button
              key={n}
              onClick={() => update('primaryNiche', n)}
              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-slate-600 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-400 rounded-md text-[11px] font-semibold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Özel Notlar */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
          Özel Notlar
          <span className="text-slate-400 font-normal">(isteğe bağlı)</span>
        </label>
        <textarea
          value={hints.customNotes}
          onChange={e => update('customNotes', e.target.value)}
          placeholder="AI'ye iletmek istediğiniz ek bilgiler, stil tercihleri, kaçınılacak konular vb."
          rows={4}
          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          {hints.customNotes.length}/500 karakter
        </p>
      </div>
    </div>
  );
}
