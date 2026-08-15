import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Crop, Trash2, FolderInput, Folder, Check, Layers, ChevronRight } from 'lucide-react';
import { DesignItem, MockupFolder } from '@/types/pod';

interface DesignItemMenuProps {
  design: DesignItem;
  isOpen: boolean;
  position: { top: number; left: number } | null;
  designFolders: MockupFolder[];
  isAnalyzing: boolean;
  onClose: () => void;
  onAnalyze: (design: DesignItem) => void;
  onCrop: (design: DesignItem) => void;
  onMoveToFolder: (designId: string, folderId: string | null) => void;
  onDelete: (id: string) => void;
}

export const DesignItemMenu: React.FC<DesignItemMenuProps> = ({
  design,
  isOpen,
  position,
  designFolders,
  isAnalyzing,
  onClose,
  onAnalyze,
  onCrop,
  onMoveToFolder,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showFolderSubmenu, setShowFolderSubmenu] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  return (
    <div
      ref={menuRef}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-1.5 min-w-[210px] text-xs animate-in fade-in zoom-in-95 duration-100"
    >
      {/* AI Analysis */}
      <button
        onClick={() => {
          onClose();
          onAnalyze(design);
        }}
        disabled={isAnalyzing}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left font-medium disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
        <span>{design.analysis ? 'Analiz Sonucunu Gör' : 'Yapay Zeka ile Analiz Et'}</span>
      </button>

      {/* Crop */}
      <button
        onClick={() => {
          onClose();
          onCrop(design);
        }}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left font-medium"
      >
        <Crop className="w-4 h-4 text-amber-500 shrink-0" />
        <span>Tasarımı Kırp</span>
      </button>

      {/* Move to Folder Toggle / Submenu */}
      {designFolders.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-700/60 my-1 pt-1">
          <button
            onClick={() => setShowFolderSubmenu(!showFolderSubmenu)}
            className="w-full px-3.5 py-2 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left font-medium"
          >
            <div className="flex items-center gap-2.5">
              <FolderInput className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Klasöre Taşı</span>
            </div>
            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showFolderSubmenu ? 'rotate-90' : ''}`} />
          </button>

          {showFolderSubmenu && (
            <div className="px-2 py-1 bg-slate-50 dark:bg-slate-900/60 rounded-xl mx-2 my-1 space-y-0.5 max-h-48 overflow-y-auto">
              <button
                onClick={() => {
                  onMoveToFolder(design.id, null);
                  onClose();
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition-colors ${
                  !design.folderId
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">Ana Klasör (Tümü)</span>
                </div>
                {!design.folderId && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
              </button>

              {designFolders.map((f) => {
                const isCurrent = design.folderId === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      onMoveToFolder(design.id, f.id);
                      onClose();
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition-colors ${
                      isCurrent
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </div>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />

      {/* Delete */}
      <button
        onClick={() => {
          onClose();
          onDelete(design.id);
        }}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left font-medium"
      >
        <Trash2 className="w-4 h-4 shrink-0" />
        <span>Tasarımı Sil</span>
      </button>
    </div>
  );
};
