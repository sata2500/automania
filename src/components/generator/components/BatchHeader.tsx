'use client';

import React from 'react';
import { UserProfile } from '@/components/common/UserAuthContext';
import { Sparkles, RefreshCw, Play, FileArchive, CloudUpload, Trash2 } from 'lucide-react';

interface BatchHeaderProps {
  hasGenerated: boolean;
  isGenerating: boolean;
  canGenerate: boolean;
  renderedMatchesCount: number;
  exportProgress: number | null;
  user: UserProfile | null;
  onGenerate: () => void;
  onDownloadZip: () => void;
  onSaveForEtsy: () => void;
  onClearResults: () => void;
}

export const BatchHeader: React.FC<BatchHeaderProps> = ({
  hasGenerated,
  isGenerating,
  canGenerate,
  renderedMatchesCount,
  exportProgress,
  user,
  onGenerate,
  onDownloadZip,
  onSaveForEtsy,
  onClearResults,
}) => {
  return (
    <div className="relative z-30 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      {/* Title & Icon */}
      <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-gradient-to-tr from-pink-500/10 to-purple-500/10 dark:from-pink-950/40 dark:to-purple-950/40 border border-pink-200/50 dark:border-pink-800/40 rounded-xl text-pink-600 dark:text-pink-400 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              Toplu Mockup Stüdyosu
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block">
              Mockup ve tasarım eşleştirmelerini tek tıkla üretin
            </p>
          </div>
        </div>

      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center gap-2">

        {hasGenerated && (
          <button
            onClick={onGenerate}
            disabled={isGenerating || !canGenerate}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-purple-600/20 cursor-pointer disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            )}
            <span>Yeniden Üret</span>
          </button>
        )}

        {hasGenerated && (
          <button
            onClick={onDownloadZip}
            disabled={renderedMatchesCount === 0 || exportProgress !== null}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:cursor-not-allowed"
          >
            <FileArchive className="w-3.5 h-3.5" />
            <span>ZIP ({renderedMatchesCount})</span>
          </button>
        )}

        {hasGenerated && user && (
          <button
            onClick={onSaveForEtsy}
            disabled={isGenerating || renderedMatchesCount === 0 || exportProgress !== null}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-orange-500/20 cursor-pointer disabled:cursor-not-allowed"
            title="Görselleri Etsy Yöneticisi sayfasına gönderir"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>Etsy'ye Gönder</span>
          </button>
        )}

        {hasGenerated && (
          <button
            onClick={onClearResults}
            disabled={isGenerating}
            className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-500/50 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
            title="Üretilen sonuçları temizle"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            <span className="hidden xs:inline">Temizle</span>
          </button>
        )}
      </div>
    </div>
  );
};
