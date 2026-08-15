import React, { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  CheckSquare,
  Square,
  Sparkles,
  Trash2,
  FolderInput,
  Folder,
  ChevronDown,
  FolderArchive,
  Layers,
} from 'lucide-react';
import { TargetApparel, MockupFolder, DesignItem } from '@/types/pod';
import { SLOT_LABELS } from '../hooks/useDesignSelection';

interface DesignToolbarProps {
  designs: DesignItem[];
  filteredDesigns: DesignItem[];
  selectedDesignIds: string[];
  designFolders: MockupFolder[];
  takenSlots: Record<TargetApparel, string | null>;
  activeSlotsCount: number;
  analyzingIds: string[];
  onToggleSelectAll: () => void;
  onBulkMove: (folderId: string | null) => void;
  onBulkDelete: () => void;
  onBulkAnalyze: () => void;
}

export const DesignToolbar: React.FC<DesignToolbarProps> = ({
  designs,
  filteredDesigns,
  selectedDesignIds,
  designFolders,
  takenSlots,
  activeSlotsCount,
  analyzingIds,
  onToggleSelectAll,
  onBulkMove,
  onBulkDelete,
  onBulkAnalyze,
}) => {
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  const isAllSelected =
    filteredDesigns.length > 0 &&
    selectedDesignIds.length === filteredDesigns.length;

  const colorMap: Record<TargetApparel, string> = {
    dark: 'bg-amber-50 dark:bg-amber-500/20 border-amber-300 dark:border-amber-400/50 text-amber-600 dark:text-amber-300',
    light: 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-300 dark:border-indigo-400/50 text-indigo-600 dark:text-indigo-300',
    both: 'bg-purple-50 dark:purple-600/20 border-purple-300 dark:border-purple-400/50 text-purple-600 dark:text-purple-300',
  };

  // Close folder dropdown on outside click
  useEffect(() => {
    if (!isFolderMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setIsFolderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFolderMenuOpen]);

  return (
    <div className="space-y-3 pb-3 border-b border-slate-100 dark:border-slate-800">
      {/* Top Meta Row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center flex-wrap gap-3">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-purple-500" />
            <span>Yüklü Tasarımlar ({filteredDesigns.length})</span>
          </h3>

          {/* Active Slots Summary */}
          {activeSlotsCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {(Object.entries(takenSlots) as [TargetApparel, string | null][]).map(
                ([slot, takenId]) => {
                  if (!takenId) return null;
                  const design = designs.find((d) => d.id === takenId);
                  return (
                    <span
                      key={slot}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${colorMap[slot]}`}
                      title={`${SLOT_LABELS[slot]}: ${design?.name || takenId}`}
                    >
                      <span className="shrink-0">{SLOT_LABELS[slot]}:</span>
                      <span className="max-w-[100px] sm:max-w-[140px] truncate font-bold">
                        {design?.name || takenId}
                      </span>
                    </span>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Management Action Bar */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSelectAll}
            className="flex items-center space-x-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl transition-colors cursor-pointer"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>Tümünü Seç</span>
          </button>

          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800 pl-3">
            {selectedDesignIds.length} Seçildi
          </span>
        </div>

        {/* Action Buttons for Selected Items */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Modern Move to Folder Popover */}
          {designFolders.length > 0 && selectedDesignIds.length > 0 && (
            <div className="relative" ref={folderMenuRef}>
              <button
                onClick={() => setIsFolderMenuOpen(!isFolderMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/80 shadow-xs transition-all cursor-pointer"
              >
                <FolderInput className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Klasöre Taşı</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isFolderMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isFolderMenuOpen && (
                <div className="absolute right-0 mt-1.5 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-1.5 min-w-[200px] animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Hedef Klasör Seçin
                  </div>
                  
                  {/* Option: Ana Klasör / Tüm Tasarımlar */}
                  <button
                    onClick={() => {
                      onBulkMove(null);
                      setIsFolderMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-2.5 transition-colors"
                  >
                    <Layers className="w-4 h-4 text-slate-400" />
                    <span>Ana Klasör (Tümü)</span>
                  </button>

                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />

                  {/* Individual Folders */}
                  {designFolders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        onBulkMove(f.id);
                        setIsFolderMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Folder className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bulk Analyze */}
          <button
            onClick={onBulkAnalyze}
            disabled={selectedDesignIds.length === 0 || analyzingIds.length > 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/40 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Seçili tasarımları sırayla analiz et"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Toplu Analiz</span>
          </button>

          {/* Bulk Delete */}
          <button
            onClick={onBulkDelete}
            disabled={selectedDesignIds.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Toplu Sil</span>
          </button>
        </div>
      </div>
    </div>
  );
};
