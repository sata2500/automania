'use client';
import React from 'react';
import { Sparkles, FileText, Layers, Send } from 'lucide-react';
import { EtsySeoProvider, useEtsySeo } from './context/EtsySeoContext';
import { AIListingStudio } from './tabs/AIListingStudio';
import { VariationMatrix } from './tabs/VariationMatrix';
import { EtsyPublisher } from './tabs/EtsyPublisher';

const EtsySeoContent = () => {
  const { activeTab, setActiveTab, isGenerating, handleGenerateAI, variations } = useEtsySeo();

  return (
    <div className="space-y-6">
{/* Studio Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Etsy Listing Studio & Varyasyon Editörü
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full uppercase font-mono">v3 Canlı</span>
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Yapay Zeka SEO Metin Yazarı ile başlık, açıklama ve 13 altın etiket üretin; Vela tarzı matris tablosunda varyasyon fiyatlarını tek tıkla Etsy'ye aktarın.
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'SEO Modeli Üretiyor...' : '🪄 AI SEO İle Yeniden Üret'}
          </button>
        </div>

        {/* Tab Navigation Header */}
        <div className="flex bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold mt-6 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex-1 py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'studio' ? 'bg-emerald-500 text-white font-bold shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <FileText className="w-4 h-4" />
            1. AI Listing Studio (Başlık, Metin & 13 Etiket)
          </button>

          <button
            onClick={() => setActiveTab('variations')}
            className={`flex-1 py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'variations' ? 'bg-emerald-500 text-white font-bold shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Layers className="w-4 h-4" />
            2. Varyasyon & Fiyat Matris Tablosu ({variations.length} Kombinasyon)
          </button>

          <button
            onClick={() => setActiveTab('publish')}
            className={`flex-1 py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'publish' ? 'bg-emerald-500 text-white font-bold shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Send className="w-4 h-4" />
            3. Etsy API v3 Mağaza Yayınlama
          </button>
        </div>
      </div>
      <AIListingStudio />
      <VariationMatrix />
      <EtsyPublisher />
    </div>
  );
};

export const EtsySeoHelper: React.FC<{ renderedMatches?: any[] }> = ({ renderedMatches = [] }) => {
  return (
    <EtsySeoProvider renderedMatches={renderedMatches}>
      <EtsySeoContent />
    </EtsySeoProvider>
  );
};