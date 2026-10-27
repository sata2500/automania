'use client';
import React from 'react';
import { Sparkles, FileText, Layers } from 'lucide-react';
import { EtsySeoProvider, useEtsySeo } from './context/EtsySeoContext';
import { AIListingStudio } from './tabs/AIListingStudio';
import { VariationMatrix } from './tabs/VariationMatrix';
import { Spinner } from '@/components/common/Spinner';

const EtsySeoContent = () => {
  const { activeTab, setActiveTab, isGenerating, handleGenerateAI, variations, regenerateConfirmOpen, setRegenerateConfirmOpen } = useEtsySeo();

  return (
    <div className="space-y-6">
      {/* Studio Banner */}
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="p-2.5 sm:p-3 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/30 shrink-0 mt-0.5 sm:mt-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                <span>İlan Stüdyosu</span>
              </h2>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                AI ile başlık, açıklama ve 13 etiket üretin, varyasyon fiyatlarını ayarlayın; ilanı Hazır İlanlar&apos;a ekleyin veya doğrudan Etsy&apos;ye gönderin.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleGenerateAI()}
            disabled={isGenerating}
            className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
          >
            {isGenerating ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? 'Üretiliyor…' : 'AI ile Yeniden Üret'}
          </button>
        </div>

        {regenerateConfirmOpen && (
          <div role="alertdialog" aria-label="Yeniden üretim onayı" className="relative z-10 mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
            <span className="flex-1">Yeniden üretim mevcut başlık, açıklama ve etiketlerin üzerine yazacak (yaptığınız düzenlemeler dahil). Devam edilsin mi?</span>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={() => setRegenerateConfirmOpen(false)} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold">Vazgeç</button>
              <button type="button" onClick={() => handleGenerateAI({ confirmed: true })} className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold">Evet, yeniden üret</button>
            </div>
          </div>
        )}

        {/* Tab Navigation Header */}
        <div className="flex bg-slate-50/80 dark:bg-slate-950/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold mt-5 sm:mt-6 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex-1 py-2.5 px-3 sm:px-4 rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'studio' || activeTab === 'publish' ? 'bg-emerald-500 text-white font-bold shadow-md' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>İlan Metni & Yayın</span>
          </button>

          <button
            onClick={() => setActiveTab('variations')}
            className={`flex-1 py-2.5 px-3 sm:px-4 rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'variations' ? 'bg-emerald-500 text-white font-bold shadow-md' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>Varyasyon & Fiyat ({variations.length})</span>
          </button>
        </div>
      </div>

      <AIListingStudio />
      <VariationMatrix />
    </div>
  );
};

export const EtsySeoHelper: React.FC = () => {
  return (
    <EtsySeoProvider>
      <EtsySeoContent />
    </EtsySeoProvider>
  );
};