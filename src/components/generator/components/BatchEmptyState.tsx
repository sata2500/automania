'use client';

import React from 'react';
import { Sparkles, Layers, Play, RefreshCw, AlertTriangle, Lightbulb } from 'lucide-react';

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
    <div className="relative z-10 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-8 md:p-10 text-center space-y-4 sm:space-y-5 shadow-xs">
      {/* Icon */}
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
        <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
      </div>

      {/* Title & Subtitle */}
      <div className="max-w-md mx-auto space-y-1">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          {selectedFolderName} Mockup Üretimi
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Seçili klasördeki mockup şablonları ile aktif tasarım görselleri eşleştirilerek Etsy için yüksek çözünürlüklü çıktılar oluşturulur.
        </p>
      </div>

      {/* Etsy Limit Warning Box or Ready Variations Badge */}
      {!isEligible ? (
        <div className="max-w-md mx-auto bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/20 dark:border-amber-500/30 rounded-2xl p-3.5 sm:p-4 text-left flex items-start gap-3 shadow-xs">
          <div className="p-1.5 bg-amber-500/20 dark:bg-amber-500/20 rounded-xl shrink-0 mt-0.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-amber-800 dark:text-amber-300">
                Etsy 22 Medya Sınırı
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                {currentItemCount} / 22 Öğe
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
              Seçili alanda <strong className="font-semibold text-slate-900 dark:text-white">{currentItemCount} adet medya</strong> ve <strong className="font-semibold text-slate-900 dark:text-white">{currentPairsCount} varyasyon</strong> bulunmaktadır. Etsy bir listelemede en fazla <strong>22 medya öğesine (20 görsel + 2 video)</strong> izin verir.
            </p>
            <p className="text-amber-700 dark:text-amber-400 text-[11px] font-medium pt-0.5 flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 shrink-0" />
              <span>Üretim yapabilmek için lütfen yukarıdan en fazla 22 öğe içeren bir klasör seçin.</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="inline-flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-300">
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

      {/* Action Button */}
      <div className="pt-1">
        <button
          onClick={onGenerate}
          disabled={isGenerating || currentPairsCount === 0 || !isEligible}
          className={`w-full sm:w-auto px-7 sm:px-9 py-3 sm:py-3.5 font-extrabold rounded-2xl text-xs sm:text-sm transition-all inline-flex items-center justify-center gap-2 ${
            !isEligible || currentPairsCount === 0
              ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/60 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-lg shadow-purple-600/30 hover:scale-[1.02] active:scale-95 cursor-pointer'
          }`}
          title={
            !isEligible
              ? 'Etsy 22 medya limitini aştığı için üretim yapılamaz.'
              : `Toplu Görselleri Üret (${currentPairsCount})`
          }
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : !isEligible ? (
            <AlertTriangle className="w-4 h-4 text-amber-500/70" />
          ) : (
            <Play className="w-4 h-4 text-amber-300 fill-amber-300" />
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
