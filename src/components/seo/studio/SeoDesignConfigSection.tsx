'use client';
import React from 'react';
import { Sparkles, ShoppingBag, FileText, Save, RefreshCw } from 'lucide-react';
import { useEtsySeo } from '../context/EtsySeoContext';

export const SeoDesignConfigSection: React.FC = () => {
  const {
    selectedDesign,
    niche,
    setNiche,
    productType,
    setProductType,
    userNotes,
    setUserNotes,
    isSavingSettings,
    handleSaveEtsySettings,
  } = useEtsySeo();

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">1</span>
            Tasarım & Ürün Yapılandırması
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Yapay zekanın analiz ettiği odak nişi kontrol edin; hedef kumaş/kalıp ve özel ürün talimatlarınızı belirleyin.
          </p>
        </div>

        <button
          onClick={handleSaveEtsySettings}
          disabled={isSavingSettings}
          className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
        >
          {isSavingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Ayarları Veritabanına Kaydet
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Niche auto-detection box */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              Odak Niş / Tasarım Teması:
            </label>
            {selectedDesign?.analysis && (
              <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> AI Vision Analizi
              </span>
            )}
          </div>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Örn: Cottagecore Rabbit, Vintage Botanical..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
          />
          <p className="text-[10px] text-slate-500">
            Klasör seçildiğinde yapay zekanın tespit ettiği gerçek tema/niş otomatik doldurulur.
          </p>
        </div>

        {/* Product type */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
            Hedef Ürün / Kumaş / Kalıp Tipi:
          </label>
          <input
            type="text"
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            placeholder="Örn: Comfort Colors 1717 Garment-Dyed Tee, Bella Canvas 3001..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
          />
          <p className="text-[10px] text-slate-500">
            İlanda yer alacak tekstil markası ve ürün tipi açıklamaya ve SEO eşleşmesine dahil edilir.
          </p>
        </div>
      </div>

      {/* User Notes & Instructions */}
      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-emerald-500" />
          Kullanıcı Notları / Özel Ürün Talimatları (Yapay Zekanın Açıklamada Kullanacağı Bilgiler):
        </label>
        <textarea
          rows={2}
          value={userNotes}
          onChange={(e) => setUserNotes(e.target.value)}
          placeholder="Örn: Beden tablosuna göre 1 beden büyük tercih ediniz. %100 pamuk, 1-2 iş gününde kargoya verilir."
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
        />
      </div>
    </div>
  );
};
