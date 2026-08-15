import React, { useState } from 'react';
import {
  CheckCheck,
  Sparkles,
  MoreVertical,
} from 'lucide-react';
import { DesignItem, TargetApparel, MockupFolder } from '@/types/pod';
import { DesignItemMenu } from './DesignItemMenu';

interface DesignCardProps {
  design: DesignItem;
  isChecked: boolean;
  isAnalyzing: boolean;
  designFolders: MockupFolder[];
  onToggleCheck: (id: string) => void;
  onToggleProductionActive: (id: string) => void;
  onSetProductionActive: (id: string, target: TargetApparel) => void;
  onAnalyzeClick: (design: DesignItem) => void;
  onCropClick: (design: DesignItem) => void;
  onMoveToFolder: (designId: string, folderId: string | null) => void;
  onDeleteClick: (id: string) => void;
}

export const DesignCard: React.FC<DesignCardProps> = ({
  design,
  isChecked,
  isAnalyzing,
  designFolders,
  onToggleCheck,
  onToggleProductionActive,
  onSetProductionActive,
  onAnalyzeClick,
  onCropClick,
  onMoveToFolder,
  onDeleteClick,
}) => {
  const isSelected = !!design.isSelected;
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const handleOpenMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 200),
    });
  };

  return (
    <div
      onClick={() => onToggleCheck(design.id)}
      className={`relative p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
        isChecked
          ? 'bg-gradient-to-b from-indigo-50 dark:from-indigo-950/80 to-white dark:to-slate-900 border-indigo-400 dark:border-indigo-500 shadow-lg ring-1 ring-indigo-400/50 dark:ring-indigo-500/50'
          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
        <div className="flex items-center space-x-1.5 sm:space-x-2" onClick={(e) => e.stopPropagation()}>
          {/* Checkbox for Management Selection */}
          <button
            onClick={() => onToggleCheck(design.id)}
            aria-label="Tasarımı seç"
            className={`w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
              isChecked
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
            }`}
          >
            {isChecked && <CheckCheck className="w-3 sm:w-3.5 h-3 sm:h-3.5" />}
          </button>

          {/* Production Active / Passive Toggle */}
          <button
            onClick={() => onToggleProductionActive(design.id)}
            className={`text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all cursor-pointer ${
              isSelected
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-600/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Toplu üretim için Aktif/Pasif yap"
          >
            {isSelected && <CheckCheck className="w-2.5 sm:w-3 h-2.5 sm:h-3" />}
            <span>{isSelected ? 'Aktif' : 'Pasif'}</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
          {design.analysis && (
            <span
              title="Yapay Zeka Analizi Tamamlandı"
              className="p-1 text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 rounded-lg"
            >
              <Sparkles className="w-3 h-3" />
            </span>
          )}

          {isAnalyzing && (
            <span className="p-1 text-purple-500 bg-purple-50 dark:bg-purple-950 rounded-lg animate-pulse">
              <Sparkles className="w-3 h-3" />
            </span>
          )}

          {/* 3-Dots Menu Trigger */}
          <button
            onClick={handleOpenMenu}
            aria-label="Tasarım işlemleri"
            className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Thumbnail Area */}
      <div
        className={`w-full h-28 sm:h-36 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950/80 border p-2 flex items-center justify-center relative mb-2 sm:mb-3 transition-colors ${
          isSelected
            ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/20'
            : 'border-slate-200 dark:border-slate-800'
        }`}
      >
        <img
          src={design.src}
          alt={design.name}
          className="max-w-full max-h-full object-contain drop-shadow-md"
          loading="lazy"
        />
        {isSelected && (
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-slate-900/85 text-amber-300 px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold backdrop-blur-sm shadow-sm flex items-center gap-1">
            <Sparkles className="w-2.5 sm:w-3 h-2.5 sm:h-3" /> Üretimde
          </div>
        )}
      </div>

      {/* Bottom Information & Slot Buttons */}
      <div className="space-y-1 sm:space-y-1.5 mt-auto">
        <p
          className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight"
          title={design.name}
        >
          {design.name}
        </p>

        <div
          className="pt-1.5 sm:pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Kumaş Rengi
            </span>
          </div>

          <div className="grid grid-cols-3 bg-slate-100 dark:bg-slate-950 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800 gap-0.5 w-full">
            {(['dark', 'light', 'both'] as TargetApparel[]).map((target) => {
              const isActiveSlot = isSelected && design.targetApparel === target;
              const targetLabel = target === 'dark' ? 'Açık' : target === 'light' ? 'Koyu' : 'Tümü';
              const targetTooltip = target === 'dark' ? 'Açık Kumaş (Beyaz, Krem vb.)' : target === 'light' ? 'Koyu Kumaş (Siyah, Lacivert vb.)' : 'Tüm Kumaş Renkleri';

              return (
                <button
                  key={target}
                  onClick={() => onSetProductionActive(design.id, target)}
                  className={`py-1 text-center rounded-md text-[9px] sm:text-[10px] font-bold transition-all cursor-pointer truncate ${
                    isActiveSlot
                      ? target === 'dark'
                        ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
                        : target === 'light'
                        ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                        : 'bg-purple-600 text-white shadow-xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                  title={`${targetTooltip} için üretimi aktifleştir/seç`}
                >
                  {targetLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Popover Action Menu */}
      {menuPosition && (
        <DesignItemMenu
          design={design}
          isOpen={true}
          position={menuPosition}
          designFolders={designFolders}
          isAnalyzing={isAnalyzing}
          onClose={() => setMenuPosition(null)}
          onAnalyze={onAnalyzeClick}
          onCrop={onCropClick}
          onMoveToFolder={onMoveToFolder}
          onDelete={onDeleteClick}
        />
      )}
    </div>
  );
};
