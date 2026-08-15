'use client';
import React, { useState } from 'react';
import { Layers, RefreshCw, CheckCircle, ShoppingBag, Send, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useEtsySeo } from '../context/EtsySeoContext';

export const VariationControlsBar: React.FC = () => {
  const [showAllColors, setShowAllColors] = useState(false);
  const {
    openLoadTemplateModal,
    setIsSaveTemplateModalOpen,
    isSavingTemplate,
    handleFetchListings,
    isFetchingListings,
    isFetchingInventory,
    handleOpenBulkSync,
    genProduct,
    setGenProduct,
    genSizes,
    defaultSizes,
    setGenSizes,
    savedCustomSizes,
    handleDeleteCustomSize,
    newGenSizeInput,
    setNewGenSizeInput,
    handleAddCustomSize,
    genColors,
    defaultColors,
    setGenColors,
    savedCustomColors,
    handleDeleteCustomColor,
    newGenColorInput,
    setNewGenColorInput,
    handleAddCustomColor,
    genPrice,
    setGenPrice,
    genQuantity,
    setGenQuantity,
    handleGenerateToTable,
  } = useEtsySeo();

  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
      {/* Action Buttons Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-500" />
          Beden & Renk Varyasyon Ayarları
        </h3>
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={openLoadTemplateModal}
            className="flex-1 sm:flex-none text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Kayıtlı Şablonu Yükle
          </button>
          <button
            onClick={() => setIsSaveTemplateModalOpen(true)}
            disabled={isSavingTemplate}
            className="flex-1 sm:flex-none text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Şablon Olarak Kaydet
          </button>
          <button
            onClick={handleFetchListings}
            disabled={isFetchingListings || isFetchingInventory}
            className="flex-1 sm:flex-none text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
          >
            {isFetchingListings || isFetchingInventory ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5" />}
            Etsy'den Şablon İlan Çek
          </button>
          <button
            onClick={handleOpenBulkSync}
            className="w-full sm:w-auto text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            Etsy İlanlarına Uygula
          </button>
        </div>
      </div>

      {/* New Variation Generator UI */}
      <div className="bg-slate-50 dark:bg-slate-950/40 p-4 sm:p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/30 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">Kombinasyon Ekleme ve Düzenleme Menüsü</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* 1. Ürün Adı */}
          <div className="md:col-span-12">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">1. Ürün / Marka Adı</label>
            <input
              type="text"
              value={genProduct}
              onChange={e => setGenProduct(e.target.value)}
              placeholder="Örn: Bella Canvas 3001, Comfort Colors 1717"
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
            />
          </div>

          {/* 2. Bedenler */}
          <div className="md:col-span-6 flex flex-col">
            <div className="flex items-center justify-between mb-1.5 h-5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">2. Bedenleri Seçin</label>
              <span className="text-[10px] text-slate-400 font-semibold">{defaultSizes.length + savedCustomSizes.length} Beden</span>
            </div>
            <div className="h-[105px] overflow-y-auto custom-scrollbar flex flex-wrap gap-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 content-start shadow-xs transition-all">
              {defaultSizes.map((size: string) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setGenSizes((prev: string[]) => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size])}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${genSizes.includes(size) ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  {size}
                </button>
              ))}
              {savedCustomSizes.map((size: string) => (
                <div key={size} className="relative group flex">
                  <button
                    type="button"
                    onClick={() => setGenSizes((prev: string[]) => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size])}
                    className={`px-2.5 py-1 pr-6 rounded-lg text-xs font-bold transition-all border ${genSizes.includes(size) ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900'}`}
                  >
                    {size}
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleDeleteCustomSize(size)} 
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-red-500 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Kalıcı Sil"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex items-center ml-auto mt-1 sm:mt-0 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="+ Özel"
                  value={newGenSizeInput}
                  onChange={e => setNewGenSizeInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddCustomSize();
                  }}
                  className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-l-lg text-xs font-semibold flex-1 sm:w-20 outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomSize}
                  title="Kalıcı Kaydet ve Seç"
                  className="px-2.5 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400 border border-l-0 border-indigo-200 dark:border-indigo-800 rounded-r-lg text-xs font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors shrink-0"
                >
                  Ekle
                </button>
              </div>
            </div>
          </div>

          {/* 3. Renkler */}
          <div className="md:col-span-6 flex flex-col">
            <div className="flex items-center justify-between mb-1.5 h-5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">3. Renkleri Seçin</label>
              {defaultColors.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllColors(!showAllColors)}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors"
                >
                  {showAllColors ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      Daha Az Göster
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      Tümünü Göster ({defaultColors.length})
                    </>
                  )}
                </button>
              )}
            </div>
            <div className={`${showAllColors ? 'min-h-[105px] max-h-[260px]' : 'h-[105px]'} overflow-y-auto custom-scrollbar flex flex-wrap gap-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 content-start shadow-xs transition-all`}>
              {(() => {
                const initialCount = 8;
                const visibleDefaultColors = showAllColors 
                  ? defaultColors 
                  : defaultColors.filter((color: string, idx: number) => idx < initialCount || genColors.includes(color));
                const hiddenCount = defaultColors.length - visibleDefaultColors.length;

                return (
                  <>
                    {visibleDefaultColors.map((color: string) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setGenColors((prev: string[]) => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color])}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${genColors.includes(color) ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        {color}
                      </button>
                    ))}
                    {!showAllColors && hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllColors(true)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 flex items-center gap-1 transition-all"
                      >
                        <ChevronDown className="w-3 h-3" />
                        +{hiddenCount} Renk Daha
                      </button>
                    )}
                  </>
                );
              })()}
              {savedCustomColors.map((color: string) => (
                <div key={color} className="relative group flex">
                  <button
                    type="button"
                    onClick={() => setGenColors((prev: string[]) => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color])}
                    className={`px-2.5 py-1 pr-6 rounded-lg text-xs font-bold transition-all border ${genColors.includes(color) ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs' : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900'}`}
                  >
                    {color}
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleDeleteCustomColor(color)} 
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-red-500 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Kalıcı Sil"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex items-center ml-auto mt-1 sm:mt-0 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="+ Özel"
                  value={newGenColorInput}
                  onChange={e => setNewGenColorInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddCustomColor();
                  }}
                  className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-l-lg text-xs font-semibold flex-1 sm:w-24 outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomColor}
                  title="Kalıcı Kaydet ve Seç"
                  className="px-2.5 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border border-l-0 border-emerald-200 dark:border-emerald-800 rounded-r-lg text-xs font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors shrink-0"
                >
                  Ekle
                </button>
              </div>
            </div>
          </div>

          {/* 4 & 5. Fiyat, Stok ve Ekle Butonu */}
          <div className="md:col-span-12 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 mt-2">
            <div className="flex gap-3">
              <div className="space-y-1 flex-1 sm:flex-none">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Fiyat ($)</label>
                <input
                  type="number" 
                  step="0.01"
                  value={genPrice} 
                  onChange={e => setGenPrice(e.target.value)}
                  className="w-full sm:w-28 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-bold outline-none focus:border-indigo-500 shadow-xs"
                />
              </div>
              <div className="space-y-1 flex-1 sm:flex-none">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Stok</label>
                <input
                  type="number"
                  value={genQuantity} 
                  onChange={e => setGenQuantity(e.target.value)}
                  className="w-full sm:w-28 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-bold outline-none focus:border-indigo-500 shadow-xs"
                />
              </div>
            </div>
            
            <button
              onClick={handleGenerateToTable}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md text-xs sm:text-sm"
            >
              <Send className="w-4 h-4" />
              Kombinasyonları Tabloya Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
