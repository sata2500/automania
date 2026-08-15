'use client';

import React, { useState } from 'react';
import { Smartphone, Monitor, Star, Sparkles, CheckCircle2, AlertCircle, Heart } from 'lucide-react';

interface EtsySerpPreviewProps {
  title: string;
  price?: number;
  imageUrl?: string | null;
  shopName?: string;
  className?: string;
}

export function EtsySerpPreview({
  title = '',
  price = 24.99,
  imageUrl,
  shopName = 'YourEtsyShop',
  className = '',
}: EtsySerpPreviewProps) {
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'desktop'>('mobile');

  const cleanTitle = title.trim() || 'Örnek Etsy SEO Başlığınız Burada Canlı Olarak Görünecektir...';
  
  // Mobile cutoff is ~40-42 chars, desktop cutoff is ~65-70 chars
  const mobileCutoff = 42;
  const desktopCutoff = 65;

  const first40 = cleanTitle.slice(0, mobileCutoff);
  const remainderMobile = cleanTitle.slice(mobileCutoff);

  const first65 = cleanTitle.slice(0, desktopCutoff);
  const remainderDesktop = cleanTitle.slice(desktopCutoff);

  const titleLength = cleanTitle.length;
  const isOptimalMobileLength = titleLength >= 30 && titleLength <= 140;

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 ${className}`}>
      {/* Header & Device Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Canlı Etsy Arama Önizlemesi (SERP)</h4>
            <p className="text-[10px] text-slate-500">Alıcıların Etsy arama sonuçlarında göreceği gerçek görünüm</p>
          </div>
        </div>

        {/* Device Mode Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setDeviceMode('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-semibold ${
              deviceMode === 'mobile'
                ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobil (%70+ Trafik)</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-semibold ${
              deviceMode === 'desktop'
                ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Masaüstü (Grid Kartı)</span>
          </button>
        </div>
      </div>

      {/* Simulated Etsy Search Listing Card Area */}
      <div className="flex justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
        {deviceMode === 'mobile' ? (
          /* Mobile Card Simulation */
          <div className="w-full max-w-[300px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 transition-all">
            {/* Image Box (Square Aspect) */}
            <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden group">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Listing preview"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="text-center p-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                    🛍️
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Tasarım Görseli</span>
                </div>
              )}
              {/* Star Seller Badge */}
              <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-xs text-white text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                <span>Star Seller</span>
              </div>
            </div>

            {/* Listing Details */}
            <div className="p-3.5 space-y-2">
              {/* Title with Mobile First-40 Cutoff Highlight */}
              <div className="text-xs font-medium leading-snug line-clamp-2 min-h-[34px]">
                <span className="font-bold text-slate-900 dark:text-white bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 px-1 py-0.5 rounded">
                  {first40}
                </span>
                {remainderMobile && <span className="text-slate-500 dark:text-slate-400 ml-0.5">{remainderMobile}</span>}
              </div>

              {/* Shop & Review Line */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="truncate max-w-[120px] font-medium">{shopName}</span>
                <span>·</span>
                <div className="flex items-center text-amber-500 font-semibold">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-0.5" />
                  <span>4.9</span>
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] ml-0.5">(1.2k)</span>
                </div>
              </div>

              {/* Price & Free Delivery */}
              <div className="flex items-baseline justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">${price.toFixed(2)}</span>
                  <span className="text-[10px] text-slate-400 line-through">${(price * 1.3).toFixed(2)}</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  FREE shipping
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Desktop Card Simulation (Authentic Etsy Desktop Search Grid Card) */
          <div className="w-full max-w-[310px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 transition-all">
            {/* Image Box (Authentic 4:3 Aspect with Heart Button) */}
            <div className="relative aspect-[4/3] w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden group">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Listing preview"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="text-center p-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                    🛍️
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Tasarım Görseli</span>
                </div>
              )}

              {/* Top Left: Star Seller Badge */}
              <div className="absolute top-2.5 left-2.5 bg-black/80 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                <span>Star Seller</span>
              </div>

              {/* Top Right: Favorite Heart Icon (Standard on Etsy Desktop) */}
              <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/90 dark:bg-slate-900/90 shadow-sm flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-rose-500 transition-colors">
                <Heart className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Listing Details */}
            <div className="p-3.5 space-y-2">
              {/* Title with Desktop First-65 Cutoff Highlight */}
              <div className="text-xs font-medium leading-snug line-clamp-2 min-h-[34px]">
                <span className="font-bold text-slate-900 dark:text-white bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 px-1 py-0.5 rounded">
                  {first65}
                </span>
                {remainderDesktop && <span className="text-slate-500 dark:text-slate-400 ml-0.5">{remainderDesktop}</span>}
              </div>

              {/* Shop & Review Line */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="truncate max-w-[130px] font-medium">{shopName}</span>
                <span>·</span>
                <div className="flex items-center text-amber-500 font-semibold">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-0.5" />
                  <span>4.9</span>
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] ml-0.5">(1,248)</span>
                </div>
              </div>

              {/* Price, Discount & Free Delivery */}
              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-slate-900 dark:text-white">USD ${price.toFixed(2)}</span>
                  <span className="text-xs text-slate-400 line-through">${(price * 1.3).toFixed(2)}</span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">(23% off)</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    FREE shipping
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">Ad by {shopName}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SEO Analysis Bar for Title */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></div>
          <div className="min-w-0">
            <span className="text-slate-500 dark:text-slate-400">
              {deviceMode === 'mobile' ? 'İlk 40 Karakter (Mobil Arama): ' : 'İlk 65 Karakter (Masaüstü Arama): '}
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {deviceMode === 'mobile' ? first40.length : first65.length} Karakter
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          {isOptimalMobileLength ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <div className="min-w-0">
            <span className="text-slate-500 dark:text-slate-400">Toplam Başlık: </span>
            <span className={`font-bold ${titleLength > 140 ? 'text-rose-500' : 'text-slate-800 dark:text-slate-200'}`}>
              {titleLength} / 140 Karakter
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

