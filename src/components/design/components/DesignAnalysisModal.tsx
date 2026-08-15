import React from 'react';
import { Sparkles, X, Clock, FileText, Hash, RefreshCw } from 'lucide-react';
import { DesignItem } from '@/types/pod';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/60 rounded-xl text-purple-600 dark:text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Tasarım Analiz Sonucu
            </h3>
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
            <div className="w-24 h-24 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center p-1">
              <img
                src={analysisModalData.src}
                alt={analysisModalData.name}
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-base">
                {analysisModalData.name}
              </h4>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Analiz Tarihi:{' '}
                {new Date(analysisModalData.analysis.analyzedAt).toLocaleString('tr-TR')}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-500" />
              <span>Detaylı Açıklama</span>
            </h4>
            <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl text-sm text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-200 dark:border-slate-800">
              {analysisModalData.analysis.description}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Hash className="w-4 h-4 text-emerald-500" />
              <span>
                Çıkarılan Anahtar Kelimeler ({analysisModalData.analysis.keywords.length})
              </span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {analysisModalData.analysis.keywords.map((kw) => (
                <span
                  key={kw}
                  className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800/80"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
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
