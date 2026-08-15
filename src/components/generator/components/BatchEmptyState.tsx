'use client';

import React from 'react';
import { Sparkles, Layers, Play, RefreshCw, AlertTriangle } from 'lucide-react';

interface BatchEmptyStateProps {
  selectedFolderName: string;
  currentPairsCount: number;
  currentItemCount: number;
  isEligible: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
}

export const BatchEmptyState: React.FC<BatchEmptyStateProps> = ({
  selectedFolderName,
  currentPairsCount,
  currentItemCount,
  isEligible,
  isGenerating,
  onGenerate,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 text-center space-y-5 shadow-sm">
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg ${
          !isEligible
            ? 'bg-rose-500 shadow-rose-500/30'
            : 'bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-indigo-600/30'
        }`}
      >
        {!isEligible ? (
          <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
        ) : (
          <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
        )}
      </div>

      <div className="max-w-md mx-auto space-y-1.5">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          {selectedFolderName} İçin Mockup Üretimi
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Seçili klasördeki mockup'lar ile aktif tasarım görselleri eşleştirilerek Etsy için yüksek çözünürlüklü çıktılar oluşturulur.
        </p>
      </div>

      {/* Limit Warning Alert or Ready Variations Badge */}
      {!isEligible ? (
        <div className="max-w-lg mx-auto bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/80 rounded-2xl p-4 text-left flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-rose-800 dark:text-rose-300">
              Etsy 22 Medya Limiti Aşıldı
            </h4>
            <p className="text-rose-700 dark:text-rose-400/90 leading-relaxed">
              Seçili alanda <strong className="font-bold">{currentItemCount} adet medya öğesi</strong> ve{' '}
              <strong className="font-bold">{currentPairsCount} adet varyasyon</strong> bulunmaktadır. Etsy bir listelemede en fazla <strong>22 medya öğesi (20 görsel + 2 video)</strong> kabul eder.
            </p>
            <p className="text-rose-600 dark:text-rose-400 text-[11px] font-medium pt-0.5">
              👉 Üretim yapabilmek için lütfen en fazla 22 öğe içeren bir klasör seçin veya klasördeki öğe sayısını azaltın.
            </p>
          </div>
        </div>
      ) : (
        <div className="inline-flex items-center gap-2.5 bg-slate-100 dark:bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          <span>
            Hazır Eşleşme:{' '}
            <strong className="text-indigo-600 dark:text-indigo-400 font-mono text-sm">
              {currentPairsCount} Varyasyon
            </strong>{' '}
            <span className="text-slate-400 text-[11px]">({currentItemCount} Öğe)</span>
          </span>
        </div>
      )}

      <div>
        <button
          onClick={onGenerate}
          disabled={isGenerating || currentPairsCount === 0 || !isEligible}
          className={`px-7 sm:px-9 py-3 sm:py-3.5 font-extrabold rounded-2xl text-xs sm:text-sm transition-all shadow-lg inline-flex items-center gap-2 ${
            !isEligible || currentPairsCount === 0
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-purple-600/30 hover:scale-[1.02] active:scale-95 cursor-pointer'
          }`}
          title={
            !isEligible
              ? 'Etsy 22 medya limitini aştığı için üretim yapılamaz.'
              : `Toplu Görselleri Üret (${currentPairsCount})`
          }
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play
              className={`w-4 h-4 ${
                !isEligible ? 'text-slate-400 fill-slate-400' : 'text-amber-300 fill-amber-300'
              }`}
            />
          )}
          <span>
            {!isEligible
              ? `Etsy Limiti Aşıldı (${currentPairsCount} > 22)`
              : `Toplu Görselleri Üret (${currentPairsCount})`}
          </span>
        </button>
      </div>
    </div>
  );
};
