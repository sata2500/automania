import React from 'react';
import { Sparkles, X, Clock, FileText, Hash, RefreshCw, Trophy, Tag, Layers } from 'lucide-react';
import { DesignItem, EvaluatedKeyword } from '@/types/pod';

interface DesignAnalysisModalProps {
  analysisModalData: DesignItem | null;
  onClose: () => void;
  onReAnalyze: (designId: string) => void;
}

export const DesignAnalysisModal: React.FC<DesignAnalysisModalProps> = ({
  analysisModalData,
  onClose,
  onReAnalyze,
}) => {
  if (!analysisModalData || !analysisModalData.analysis) return null;

  const analysis = analysisModalData.analysis;
  const evaluatedMap = new Map<string, EvaluatedKeyword>();
  if (analysis.evaluatedKeywords && Array.isArray(analysis.evaluatedKeywords)) {
    for (const item of analysis.evaluatedKeywords) {
      if (item && item.keyword) {
        evaluatedMap.set(item.keyword.toLowerCase(), item);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/60 rounded-xl text-purple-600 dark:text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Tasarım Analizi & Etsy Puanları
              </h3>
              <p className="text-[11px] text-slate-500">
                Yapay zeka çıkarımları ve Etsy resmi API pazar metrikleri
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Header Card */}
          <div className="flex items-start gap-4 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-20 h-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center p-1">
              <img
                src={analysisModalData.src}
                alt={analysisModalData.name}
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-900 dark:text-white text-base truncate">
                {analysisModalData.name}
              </h4>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Analiz Tarihi:{' '}
                {new Date(analysis.analyzedAt).toLocaleString('tr-TR')}
              </p>
              {analysis.niche && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[11px] font-semibold rounded-lg border border-purple-200 dark:border-purple-800/60 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Niş: {analysis.niche}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-500" />
              <span>Görsel Analiz Açıklaması</span>
            </h4>
            <div className="bg-slate-50 dark:bg-slate-950/50 p-3.5 rounded-2xl text-sm text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-200 dark:border-slate-800">
              {analysis.description}
            </div>
          </div>

          {/* Primary Keywords */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-emerald-500" />
                <span>Çıkarılan Anahtar Kelimeler ({analysis.keywords.length})</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Etsy Kelime Havuzuna Kaydedildi</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {analysis.keywords.map((kw) => {
                const evalData = evaluatedMap.get(kw.toLowerCase());
                const score = evalData?.opportunity_score ?? evalData?.etsy_score;
                const competition = evalData?.competition_level;
                const totalListings = evalData?.total_listings;

                return (
                  <div
                    key={kw}
                    className="group px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs font-medium rounded-xl border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-2 transition-colors"
                  >
                    <span>{kw}</span>
                    {score != null && score > 0 ? (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
                          score >= 70
                            ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                            : score >= 50
                            ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                        title={competition ? `Rekabet: ${competition}${totalListings ? ` (${totalListings} İlan)` : ''}` : undefined}
                      >
                        <Trophy className="w-2.5 h-2.5" />
                        {score}p
                      </span>
                    ) : competition && competition !== 'Henüz Taranmadı' ? (
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded">
                        {competition}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Discovered Competitor Tags */}
          {analysis.discoveredCompetitorTags && analysis.discoveredCompetitorTags.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-500" />
                  <span>Rakip İlanlarda Birlikte Kullanılan Etiketler ({analysis.discoveredCompetitorTags.length})</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Etsy Arama & Havuz</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {analysis.discoveredCompetitorTags.map((tag) => {
                  const evalData = evaluatedMap.get(tag.toLowerCase());
                  const score = evalData?.opportunity_score ?? evalData?.etsy_score;

                  return (
                    <div
                      key={tag}
                      className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-medium rounded-xl border border-amber-200 dark:border-amber-800/80 flex items-center gap-1.5"
                    >
                      <Tag className="w-3 h-3 text-amber-500 shrink-0" />
                      <span>{tag}</span>
                      {score != null && score > 0 && (
                        <span className="text-[10px] font-bold px-1 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                          {score}p
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-end gap-2.5 shrink-0">
          <button
            onClick={() => {
              onReAnalyze(analysisModalData.id);
              onClose();
            }}
            className="px-4 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Yeniden Analiz Et</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
