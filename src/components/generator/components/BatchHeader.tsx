'use client';

import React from 'react';
import { UserProfile } from '@/components/common/UserAuthContext';
import { Sparkles, RefreshCw, Play, FileArchive, CloudUpload, Trash2 } from 'lucide-react';
import { BatchAspectRatioSelector, AspectRatioType } from './BatchAspectRatioSelector';

interface BatchHeaderProps {
  aspectOverride: AspectRatioType;
  setAspectOverride: (val: AspectRatioType) => void;
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
  aspectOverride,
  setAspectOverride,
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
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3.5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-pink-100 dark:bg-pink-950/50 rounded-xl text-pink-600 dark:text-pink-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          Toplu Mockup Üretim Stüdyosu
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* Modern Aspect Ratio Selector Popover */}
        <BatchAspectRatioSelector value={aspectOverride} onChange={setAspectOverride} />

        {hasGenerated && (
          <button
            onClick={onGenerate}
            disabled={isGenerating || !canGenerate}
            className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-purple-600/20 cursor-pointer disabled:cursor-not-allowed"
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
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:cursor-not-allowed"
          >
            <FileArchive className="w-3.5 h-3.5" />
            <span>ZIP İndir ({renderedMatchesCount})</span>
          </button>
        )}

        {hasGenerated && user && (
          <button
            onClick={onSaveForEtsy}
            disabled={isGenerating || renderedMatchesCount === 0 || exportProgress !== null}
            className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-orange-500/20 cursor-pointer disabled:cursor-not-allowed"
            title="Görselleri Etsy Yöneticisi sayfasına gönderir"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>Etsy İçin Kaydet</span>
          </button>
        )}

        {hasGenerated && (
          <button
            onClick={onClearResults}
            disabled={isGenerating}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-500/50 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer disabled:cursor-not-allowed"
            title="Üretilen sonuçları temizle"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            <span>Temizle</span>
          </button>
        )}
      </div>
    </div>
  );
};
