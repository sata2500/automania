'use client';

import React from 'react';
import { UserProfile } from '@/components/common/UserAuthContext';
import { Sparkles, Play, FileArchive, ListPlus, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';

interface BatchHeaderProps {
  hasGenerated: boolean;
  isGenerating: boolean;
  canGenerate: boolean;
  renderedMatchesCount: number;
  exportProgress: number | null;
  user: UserProfile | null;
  onGenerate: () => void;
  onDownloadZip: () => void;
  /** Görselleri yükleyip ilanı Hazır İlanlar'a gönderir (metin arka planda hazırlanır). */
  onCreateListing: () => void;
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
  onCreateListing,
  onClearResults,
}) => {
  return (
    <div className="relative z-30 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
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
            className="btn btn-primary flex-1 sm:flex-initial"
          >
            {isGenerating ? (
              <Spinner className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span><span className="sm:hidden">Üret</span><span className="hidden sm:inline">Yeniden Üret</span></span>
          </button>
        )}

        {hasGenerated && (
          <button
            onClick={onDownloadZip}
            disabled={renderedMatchesCount === 0 || exportProgress !== null}
            className="btn btn-secondary flex-1 sm:flex-initial"
          >
            <FileArchive className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>ZIP ({renderedMatchesCount})</span>
          </button>
        )}

        {hasGenerated && user && (
          <button
            onClick={onCreateListing}
            disabled={isGenerating || renderedMatchesCount === 0 || exportProgress !== null}
            className="btn btn-success flex-1 sm:flex-initial"
            title="Görselleri yükler ve ilanı Hazır İlanlar'a ekler; başlık, etiket ve açıklama otomatik hazırlanır."
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>İlan Oluştur</span>
          </button>
        )}

        {hasGenerated && (
          <button
            onClick={onClearResults}
            disabled={isGenerating}
            className="btn btn-ghost-danger px-3 shrink-0"
            aria-label="Üretilen sonuçları temizle"
            title="Üretilen sonuçları temizle"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Temizle</span>
          </button>
        )}
      </div>
    </div>
  );
};
