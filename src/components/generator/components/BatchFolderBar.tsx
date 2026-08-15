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
    <div className="bg-slate-50 dark:bg-slate-900/90 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
          Üretim İçin Klasör Seçin:
        </label>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
          Etsy Kuralı: Maksimum 22 medya (20 görsel + 2 video)
        </span>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {/* "Tüm Klasörler" Button with 22 limit validation */}
        <button
          onClick={() => onFolderClick(null)}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer shrink-0 ${
            isAllOverLimit
              ? isAllActive
                ? 'bg-rose-500 border-rose-600 text-white shadow-md shadow-rose-500/30'
                : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100/60'
              : isAllActive
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30'
              : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={
            isAllOverLimit
              ? `Tüm klasörlerde ${allFoldersStats.itemCount} öğe / ${allFoldersStats.pairCount} varyasyon var. Etsy en fazla 22 öğe kabul eder.`
              : `Tüm Klasörler (${allFoldersStats.itemCount} Öğe - ${allFoldersStats.pairCount} Varyasyon)`
          }
        >
          {isAllOverLimit ? (
            <AlertTriangle className={`w-4 h-4 shrink-0 ${isAllActive ? 'text-white' : 'text-rose-500'}`} />
          ) : isAllActive ? (
            <FolderOpen className="w-4 h-4 text-amber-300 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <span>Tüm Klasörler</span>
          <span
            className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold shrink-0 ${
              isAllOverLimit
                ? isAllActive
                  ? 'bg-slate-950/80 text-rose-300'
                  : 'bg-rose-200 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200'
                : isAllActive
                ? 'bg-slate-950/80 text-amber-300'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {isAllOverLimit ? `>22 (${allFoldersStats.pairCount})` : `${allFoldersStats.pairCount} Var.`}
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
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer max-w-[240px] min-w-0 ${
                isOverLimit
                  ? isActive
                    ? 'bg-rose-500 border-rose-600 text-white shadow-md shadow-rose-500/30'
                    : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100/60'
                  : isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={
                isOverLimit
                  ? `Bu klasörde ${stats.itemCount} öğe ve ${stats.pairCount} varyasyon var. Etsy en fazla 22 öğe kabul eder.`
                  : `${folder.name} (${stats.itemCount} Öğe - ${stats.pairCount} Varyasyon)`
              }
            >
              {isOverLimit ? (
                <AlertTriangle className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-rose-500'}`} />
              ) : isActive ? (
                <FolderOpen className="w-4 h-4 text-amber-300 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className="truncate">{folder.name}</span>
              <span
                className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold shrink-0 ${
                  isOverLimit
                    ? isActive
                      ? 'bg-slate-950/80 text-rose-300'
                      : 'bg-rose-200 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200'
                    : isActive
                    ? 'bg-slate-950/80 text-amber-300'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {isOverLimit ? `>22 (${stats.itemCount})` : stats.pairCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Warning banner */}
      {isAllOverLimit && isAllActive && (
        <div className="flex items-center gap-2 pt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
          <Info className="w-3.5 h-3.5 shrink-0 text-rose-500" />
          <span>
            Tüm klasörlerde toplam {allFoldersStats.itemCount} öğe ve {allFoldersStats.pairCount} varyasyon bulunuyor. Etsy en fazla 22 medya kabul ettiği için toplu üretim yapabilmek için lütfen en fazla 22 öğe barındıran tek bir klasör seçin.
          </span>
        </div>
      )}

      {overLimitFolders.length > 0 && !isAllActive && (
        <div className="flex items-center gap-2 pt-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>
            {overLimitFolders.length} adet klasör 22 medya limitini aştığı için toplu üretime uygun değildir (
            {overLimitFolders.map((f) => f.name).join(', ')}).
          </span>
        </div>
      )}
    </div>
  );
};
