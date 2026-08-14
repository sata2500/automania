'use client';

import React, { useState } from 'react';
import { Smartphone, Monitor, Star, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

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

  const cleanTitle = title.trim() || 'Your Compelling Etsy SEO Title Will Appear Here...';
  const mobileCutoff = 42; // standard Etsy mobile search truncation limit
  const first40 = cleanTitle.slice(0, mobileCutoff);
  const remainder = cleanTitle.slice(mobileCutoff);

  const titleLength = cleanTitle.length;
  const isOptimalMobileLength = titleLength >= 30 && titleLength <= 140;

  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-xl ${className}`}>
      {/* Header & Device Switcher */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-neutral-200">Canlı Etsy Arama Önizlemesi (SERP)</h4>
            <p className="text-[10px] text-neutral-400">Alıcıların Etsy arama sonuçlarında göreceği gerçek görünüm</p>
          </div>
        </div>

        {/* Device Mode Toggle */}
        <div className="flex items-center bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
          <button
            type="button"
            onClick={() => setDeviceMode('mobile')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium ${
              deviceMode === 'mobile'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobil (%70+ Trafik)</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode('desktop')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium ${
              deviceMode === 'desktop'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Masaüstü</span>
          </button>
        </div>
      </div>

      {/* Simulated Etsy Search Listing Card */}
      <div className="flex justify-center p-3 bg-neutral-950/80 rounded-xl border border-neutral-800/80">
        {deviceMode === 'mobile' ? (
          /* Mobile Card Simulation (Compact 2-Column or Single Mobile Result) */
          <div className="w-full max-w-[340px] bg-white text-neutral-900 rounded-xl overflow-hidden shadow-2xl border border-neutral-200">
            {/* Image Box */}
            <div className="relative aspect-square w-full bg-neutral-100 flex items-center justify-center overflow-hidden group">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Listing preview"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="text-center p-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-neutral-200 flex items-center justify-center text-neutral-400 mb-2">
                    🛍️
                  </div>
                  <span className="text-xs text-neutral-400 font-medium">Tasarım Görseli</span>
                </div>
              )}
              {/* Star Seller Badge Mock */}
              <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md text-white text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                <span>Star Seller</span>
              </div>
            </div>

            {/* Listing Details */}
            <div className="p-3">
              {/* Title with Mobile First-40 Cutoff Highlight */}
              <div className="text-xs font-normal leading-snug line-clamp-2 text-neutral-800 min-h-[34px]">
                <span className="font-semibold text-neutral-950 bg-amber-100 px-0.5 rounded">
                  {first40}
                </span>
                {remainder && <span className="text-neutral-500">{remainder}</span>}
              </div>

              {/* Shop & Review Line */}
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-neutral-600">
                <span className="truncate max-w-[120px]">{shopName}</span>
                <span>·</span>
                <div className="flex items-center text-amber-500 font-medium">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-0.5" />
                  <span>4.9</span>
                  <span className="text-neutral-400 text-[10px] ml-0.5">(1.2k)</span>
                </div>
              </div>

              {/* Price & Free Delivery */}
              <div className="flex items-baseline justify-between mt-2 pt-1 border-t border-neutral-100">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-neutral-900">${price.toFixed(2)}</span>
                  <span className="text-[10px] text-neutral-400 line-through">${(price * 1.3).toFixed(2)}</span>
                </div>
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  FREE shipping
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Desktop Card Simulation (Standard Etsy Grid Result) */
          <div className="w-full max-w-[480px] flex gap-3 bg-white text-neutral-900 rounded-xl p-3 overflow-hidden shadow-2xl border border-neutral-200">
            {/* Thumbnail */}
            <div className="relative w-36 h-36 flex-shrink-0 bg-neutral-100 rounded-lg overflow-hidden flex items-center justify-center">
              {imageUrl ? (
                <img src={imageUrl} alt="Listing preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-xs text-neutral-400">Görsel</div>
              )}
              <div className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Star className="w-2 h-2 fill-amber-400 text-amber-400" />
                <span>Star Seller</span>
              </div>
            </div>

            {/* Content */}
            <div className="flex flex-col justify-between py-0.5 flex-1 min-w-0">
              <div>
                <div className="text-xs font-medium text-neutral-900 line-clamp-2 leading-relaxed">
                  <span className="bg-amber-100 px-0.5 rounded font-semibold">{first40}</span>
                  {remainder && <span className="text-neutral-600">{remainder}</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-neutral-600">
                  <span className="truncate">{shopName}</span>
                  <span>·</span>
                  <div className="flex items-center text-amber-500 font-medium">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-0.5" />
                    <span>4.9 (1,248)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-baseline justify-between mt-2 pt-1.5 border-t border-neutral-100">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-bold text-neutral-900">${price.toFixed(2)}</span>
                  <span className="text-xs text-neutral-400 line-through">${(price * 1.3).toFixed(2)}</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  FREE shipping
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SEO Analysis Bar for Title */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800">
          <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></div>
          <div className="min-w-0">
            <span className="text-neutral-400">İlk 40 Karakter (Mobil Arama): </span>
            <span className="font-semibold text-neutral-200">
              {first40.length} Karakter
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800">
          {isOptimalMobileLength ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          )}
          <div className="min-w-0">
            <span className="text-neutral-400">Toplam Başlık: </span>
            <span className={`font-semibold ${titleLength > 140 ? 'text-rose-400' : 'text-neutral-200'}`}>
              {titleLength} / 140 Karakter
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
