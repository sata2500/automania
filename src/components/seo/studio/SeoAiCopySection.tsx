'use client';
import React, { useState } from 'react';
import { Tag, Copy, Sparkles, Check, FileText, Hash, Plus, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useEtsySeo } from '../context/EtsySeoContext';

export const SeoAiCopySection: React.FC = () => {
  const [showAllTagsMobile, setShowAllTagsMobile] = useState(false);
  const {
    generatedTitle,
    setGeneratedTitle,
    copyToClipboard,
    copiedKey,
    generatedDescription,
    setGeneratedDescription,
    selectedTags,
    setSelectedTags,
    enrichedKeywords,
    coOccurringTags,
  } = useEtsySeo();

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">2</span>
            AI SEO Başlık, Açıklama ve 13 Altın Etiket
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Etsy algoritması için optimize edilmiş başlık, açıklama ve yüksek fırsat puanlı 13 etiketi yönetin.
          </p>
        </div>
      </div>

      {/* Title Editor */}
      <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <Tag className="w-4 h-4" />
            Etsy SEO Ürün Başlığı ({generatedTitle.length}/140 Karakter):
          </label>
          <button
            onClick={() => copyToClipboard(generatedTitle, 'title')}
            className="text-xs bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors font-medium border border-slate-200 dark:border-slate-800 self-end sm:self-auto shadow-xs"
          >
            {copiedKey === 'title' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            Başlığı Kopyala
          </button>
        </div>
        <input
          type="text"
          value={generatedTitle}
          maxLength={140}
          onChange={(e) => setGeneratedTitle(e.target.value)}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Description Editor */}
      <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            Etsy Ürün Açıklaması (Dönüşüm Odaklı Metin):
          </label>
          <button
            onClick={() => copyToClipboard(generatedDescription, 'desc')}
            className="text-xs bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors font-medium border border-slate-200 dark:border-slate-800 self-end sm:self-auto shadow-xs"
          >
            {copiedKey === 'desc' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            Açıklamayı Kopyala
          </button>
        </div>
        <textarea
          rows={7}
          value={generatedDescription}
          onChange={(e) => setGeneratedDescription(e.target.value)}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
        />
      </div>

      {/* 13 Selected Tags Display */}
      <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              🎯 Seçilmiş 13 Etsy Etiketi ({selectedTags.length}/13)
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">≤20 Karakter Uyumlu</span>
            </h3>
            <p className="text-xs text-slate-500">Canlı matematiksel fırsat puanları en yüksek olan 13 etiket seçilmiştir.</p>
          </div>

          <button
            onClick={() => copyToClipboard(selectedTags.join(', '), 'tags')}
            className="w-full sm:w-auto text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-sm"
          >
            {copiedKey === 'tags' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            Tümünü Virgülle Kopyala
          </button>
        </div>

        {/* Desktop View: Full Grid */}
        <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {selectedTags.map((tag: string, idx: number) => {
            const len = tag.length;
            const isOk = len <= 20;
            return (
              <div key={idx} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs shadow-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px] sm:max-w-[150px]">
                  {idx + 1}. {tag}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${isOk ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'}`}>
                    {len}/20
                  </span>
                  <button 
                    onClick={() => setSelectedTags((prev: string[]) => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                    title="Etiketi Kaldır"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile View: First 3 Tags + Expand Toggle */}
        <div className="sm:hidden space-y-2">
          <div className="flex flex-col gap-2">
            {(showAllTagsMobile ? selectedTags : selectedTags.slice(0, 3)).map((tag: string, idx: number) => {
              const len = tag.length;
              const isOk = len <= 20;
              return (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs shadow-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                    {idx + 1}. {tag}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${isOk ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'}`}>
                      {len}/20
                    </span>
                    <button 
                      onClick={() => setSelectedTags((prev: string[]) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                      title="Etiketi Kaldır"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedTags.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllTagsMobile(!showAllTagsMobile)}
              className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              {showAllTagsMobile ? (
                <>
                  <ChevronUp className="w-4 h-4 text-emerald-500" />
                  Daha Az Göster (İlk 3 Etiket)
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 text-emerald-500" />
                  Tüm 13 Etiketi Göster (+{selectedTags.length - 3} Daha)
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Candidate Keywords & Co-Occurring Competitor Tags Panel */}
      {((enrichedKeywords && enrichedKeywords.length > 0) || (coOccurringTags && coOccurringTags.length > 0)) && (
        <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Kelime Havuzu & Birlikte Kullanılan Popüler Rakip Etiketler
              </h3>
              <p className="text-xs text-slate-500">
                Aşağıdaki gerçek Etsy arama puanları, ilan sayıları ve rakip etiketleri arasından listenize kolayca etiket ekleyebilirsiniz.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. Candidate Keywords */}
            {enrichedKeywords && enrichedKeywords.length > 0 && (
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-emerald-500" />
                    Tasarım Anahtar Kelimeleri & Puanları ({enrichedKeywords.length})
                  </span>
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {enrichedKeywords.map((kw: any, i: number) => {
                    const isSelected = selectedTags.includes(kw.keyword);
                    return (
                      <div key={i} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate mr-2">
                          {kw.keyword}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {kw.total_listings > 0 && (
                            <span className="text-[10px] text-slate-500">
                              {kw.total_listings.toLocaleString('tr-TR')} İlan
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                            kw.opportunity_score >= 85 ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300' :
                            kw.opportunity_score >= 70 ? 'bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}>
                            {kw.opportunity_score}/100
                          </span>
                          <button
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTags((prev: string[]) => prev.filter((t: string) => t !== kw.keyword));
                              } else if (selectedTags.length < 13) {
                                setSelectedTags((prev: string[]) => [...prev, kw.keyword]);
                              }
                            }}
                            disabled={!isSelected && selectedTags.length >= 13}
                            className={`p-1 rounded-md text-xs font-bold transition-all ${
                              isSelected 
                                ? 'bg-emerald-500 text-white' 
                                : selectedTags.length >= 13 
                                ? 'opacity-40 bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                : 'bg-slate-200 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-300 hover:text-emerald-600'
                            }`}
                            title={isSelected ? 'Kaldır' : '13 Etikete Ekle'}
                          >
                            {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Co-Occurring Competitor Tags with Opportunity Score & Total Listings */}
            {coOccurringTags && coOccurringTags.length > 0 && (
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Birlikte Kullanılan Popüler Rakip Etiketler ({coOccurringTags.length})
                  </span>
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {coOccurringTags.map((item: any, i: number) => {
                    const tagStr = typeof item === 'string' ? item : (item?.keyword || '');
                    const tagScore = typeof item === 'object' ? item.opportunity_score : (enrichedKeywords?.find((k: any) => k.keyword?.toLowerCase() === tagStr.toLowerCase())?.opportunity_score || null);
                    const tagListings = typeof item === 'object' ? item.total_listings : (enrichedKeywords?.find((k: any) => k.keyword?.toLowerCase() === tagStr.toLowerCase())?.total_listings || null);
                    const isAlreadySelected = selectedTags.includes(tagStr);
                    const isEligible = tagStr.length <= 20;

                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium border transition-all ${
                          isAlreadySelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/50 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={tagStr}>
                              {tagStr}
                            </span>
                            <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold ${
                              isEligible ? 'text-slate-500 dark:text-slate-400' : 'text-rose-600 bg-rose-100 dark:bg-rose-950'
                            }`}>
                              {tagStr.length}/20
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                            {tagListings !== null && tagListings !== undefined && Number(tagListings) > 0 && (
                              <span>
                                {Number(tagListings).toLocaleString('tr-TR')} İlan
                              </span>
                            )}
                            {tagScore && tagScore > 0 && (
                              <span className={`font-bold px-1 rounded font-mono ${
                                tagScore >= 85 
                                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300' 
                                  : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              }`}>
                                {tagScore}p
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (isAlreadySelected) {
                              setSelectedTags((prev: string[]) => prev.filter((t: string) => t !== tagStr));
                            } else if (selectedTags.length < 13) {
                              setSelectedTags((prev: string[]) => [...prev, tagStr]);
                            }
                          }}
                          disabled={!isAlreadySelected && selectedTags.length >= 13}
                          className={`shrink-0 p-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                            isAlreadySelected
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : selectedTags.length >= 13
                              ? 'opacity-40 bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                              : 'bg-slate-100 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-300 hover:text-emerald-600'
                          }`}
                          title={isAlreadySelected ? 'Etiketi Kaldır' : selectedTags.length >= 13 ? 'Maksimum 13 etiket seçilebilir' : '13 Etikete Ekle'}
                        >
                          {isAlreadySelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
