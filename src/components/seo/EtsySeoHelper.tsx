'use client';

import React, { useState } from 'react';
import { Tag, Copy, Sparkles, Check, FileText } from 'lucide-react';

export const EtsySeoHelper: React.FC = () => {
  const [niche, setNiche] = useState('Retro Cat Lover');
  const [productType, setProductType] = useState('Comfort Colors T-Shirt');
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Generate 13 Etsy Tags (strictly <= 20 chars per tag for Etsy rules!)
  const generatedTags = [
    `${niche.slice(0, 15)} Shirt`,
    'Vintage Graphic Tee',
    'Cat Mom Gift',
    'Retro T-Shirt',
    'Aesthetic Apparel',
    'Cute Oversized Tee',
    'Trendy Shirt',
    'Gift For Her',
    'Comfort Colors 1717',
    'Unisex Graphic Tee',
    'Cat Lover Gift',
    'Streetwear Shirt',
    'Summer T-Shirt',
  ].map((tag) => tag.slice(0, 20));

  const generatedTitle = `${niche} Shirt, Vintage Graphic Tee, Aesthetic ${productType}, Cute Cat Mom Gift, Retro Unisex Shirt, Oversized Streetwear Tee`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTag(key);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-100 dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/60">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Etsy SEO & 13 Etiket Oluşturucu</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Etsy listeleriniz için 13 adet etiket (maksimum 20 karakter) ve başlık şablonu oluşturun.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              Tasarım Nişi / Teması:
            </label>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Örn: Vintage Book Lover, Dog Mom, Retro Sunset"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2.5 text-xs focus:border-emerald-500 dark:focus:border-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              Ürün Tipi / Markası:
            </label>
            <input
              type="text"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              placeholder="Örn: Gildan 18000, Bella Canvas 3001, Hoodie"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2.5 text-xs focus:border-emerald-500 dark:focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* Title Generator Output */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 mb-6 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Önerilen Etsy Ürün Başlığı:
            </span>
            <button
              onClick={() => copyToClipboard(generatedTitle, 'title')}
              className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copiedTag === 'title' ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedTag === 'title' ? 'Kopyalandı' : 'Kopyala'}</span>
            </button>
          </div>
          <p className="text-xs font-mono text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            {generatedTitle}
          </p>
        </div>

        {/* 13 Tags Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              13 Adet Etsy Etiketi (Virgülle Ayrılmış veya Tekil):
            </span>
            <button
              onClick={() => copyToClipboard(generatedTags.join(', '), 'all-tags')}
              className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer"
            >
              {copiedTag === 'all-tags' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Tüm 13 Etiketi Kopyala</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {generatedTags.map((tag, idx) => (
              <div
                key={idx}
                onClick={() => copyToClipboard(tag, `tag-${idx}`)}
                className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-all group shadow-sm"
              >
                <span className="font-mono text-slate-700 dark:text-slate-300 truncate">{tag}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 font-bold shrink-0 ml-1">
                  {tag.length}/20
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
