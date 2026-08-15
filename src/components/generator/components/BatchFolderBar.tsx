'use client';

import React from 'react';
import { MockupFolder } from '@/types/pod';
import { Folder, FolderOpen, AlertTriangle, Info } from 'lucide-react';

interface BatchFolderBarProps {
  mockupFolders: MockupFolder[];
  activeFolderId: string | null;
  folderStatsMap: Map<string, { itemCount: number; isEligible: boolean; pairCount: number }>;
  overLimitFolders: MockupFolder[];
  allFoldersStats: { itemCount: number; pairCount: number; isEligible: boolean };
  onFolderClick: (folderId: string | null) => void;
}

export const BatchFolderBar: React.FC<BatchFolderBarProps> = ({
  mockupFolders,
  activeFolderId,
  folderStatsMap,
  overLimitFolders,
  allFoldersStats,
  onFolderClick,
}) => {
  const isAllOverLimit = !allFoldersStats.isEligible;
  const isAllActive = activeFolderId === null;

  return (
    <div className="relative z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs">
      {/* Bar Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
            Üretim Klasörü Seçin:
          </label>
        </div>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
          Etsy Limiti: <strong className="font-semibold text-slate-600 dark:text-slate-400">Maks. 22 Medya</strong>
        </span>
      </div>

      {/* Horizontal Scrollable Folder Pills Row on Mobile, Wrap on Desktop */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap pb-1 pt-0.5">
        {/* "Tüm Klasörler" Pill */}
        <button
          onClick={() => onFolderClick(null)}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer shrink-0 whitespace-nowrap ${
            isAllOverLimit
              ? isAllActive
                ? 'bg-slate-800 dark:bg-slate-850 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/40 shadow-sm'
                : 'bg-slate-100/90 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/70 text-slate-700 dark:text-slate-300 hover:border-amber-500/40'
              : isAllActive
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-500 text-white shadow-md shadow-indigo-600/25'
              : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={
            isAllOverLimit
              ? `Tüm klasörlerde ${allFoldersStats.itemCount} öğe ve ${allFoldersStats.pairCount} varyasyon var. Etsy en fazla 22 öğe kabul eder.`
              : `Tüm Klasörler (${allFoldersStats.itemCount} Öğe - ${allFoldersStats.pairCount} Varyasyon)`
          }
        >
          {isAllOverLimit ? (
            <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${isAllActive ? 'text-amber-400' : 'text-amber-500'}`} />
          ) : isAllActive ? (
            <FolderOpen className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          <span>Tüm Klasörler</span>
          <span
            className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold shrink-0 ${
              isAllOverLimit
                ? 'bg-amber-500/15 dark:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                : isAllActive
                ? 'bg-black/25 text-white'
                : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300'
            }`}
          >
            {isAllOverLimit ? `>22 (${allFoldersStats.pairCount})` : allFoldersStats.pairCount}
          </span>
        </button>

        {/* Individual Folder Pills */}
        {mockupFolders.map((folder) => {
          const isActive = activeFolderId === folder.id;
          const stats = folderStatsMap.get(folder.id) || { itemCount: 0, isEligible: true, pairCount: 0 };
          const isOverLimit = !stats.isEligible;

          return (
            <button
              key={folder.id}
              onClick={() => onFolderClick(folder.id)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer max-w-[220px] whitespace-nowrap ${
                isOverLimit
                  ? isActive
                    ? 'bg-slate-800 dark:bg-slate-850 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/40 shadow-sm'
                    : 'bg-slate-100/90 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/70 text-slate-700 dark:text-slate-300 hover:border-amber-500/40'
                  : isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-500 text-white shadow-md shadow-indigo-600/25'
                  : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={
                isOverLimit
                  ? `Bu klasörde ${stats.itemCount} öğe ve ${stats.pairCount} varyasyon var. Etsy en fazla 22 öğe kabul eder.`
                  : `${folder.name} (${stats.itemCount} Öğe - ${stats.pairCount} Varyasyon)`
              }
            >
              {isOverLimit ? (
                <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-400' : 'text-amber-500'}`} />
              ) : isActive ? (
                <FolderOpen className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span className="truncate">{folder.name}</span>
              <span
                className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold shrink-0 ${
                  isOverLimit
                    ? 'bg-amber-500/15 dark:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                    : isActive
                    ? 'bg-black/25 text-white'
                    : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300'
                }`}
              >
                {isOverLimit ? `>22 (${stats.itemCount})` : stats.pairCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Subtle Helper/Warning line */}
      {isAllOverLimit && isAllActive && (
        <div className="flex items-center gap-2 pt-0.5 text-[11px] text-amber-600 dark:text-amber-400/90 font-medium">
          <Info className="w-3.5 h-3.5 shrink-0 text-amber-500" />
          <span className="leading-tight">
            Tüm klasörlerde toplam {allFoldersStats.itemCount} öğe / {allFoldersStats.pairCount} varyasyon bulunuyor. Etsy en fazla 22 medya kabul ettiği için lütfen yukarıdan tek bir klasör seçin.
          </span>
        </div>
      )}

      {overLimitFolders.length > 0 && !isAllActive && (
        <div className="flex items-center gap-2 pt-0.5 text-[11px] text-amber-600 dark:text-amber-400/90 font-medium">
          <Info className="w-3.5 h-3.5 shrink-0 text-amber-500" />
          <span className="leading-tight">
            {overLimitFolders.length} adet klasör 22 medya limitini aştığı için toplu üretime uygun değildir (
            {overLimitFolders.map((f) => f.name).join(', ')}).
          </span>
        </div>
      )}
    </div>
  );
};
