import React, { useEffect, useRef, useState } from 'react';
import { Edit2, Trash2, FolderInput, Folder, Layers, Check, ChevronRight } from 'lucide-react';
import { MockupItem, MockupFolder } from '@/types/pod';

interface MockupItemMenuProps {
  item: MockupItem;
  mockupFolders: MockupFolder[];
  isOpen: boolean;
  position: { top: number; left: number } | null;
  onClose: () => void;
  onRename: (item: MockupItem) => void;
  onDelete: (id: string) => void;
  onMoveToFolder: (id: string, folderId: string | null) => void;
}

export const MockupItemMenu: React.FC<MockupItemMenuProps> = ({
  item,
  mockupFolders,
  isOpen,
  position,
  onClose,
  onRename,
  onDelete,
  onMoveToFolder,
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
      className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-1.5 min-w-[180px] text-xs animate-in fade-in zoom-in-95 duration-100"
    >
      <button
        onClick={() => {
          onClose();
          onRename(item);
        }}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left font-medium cursor-pointer"
      >
        <Edit2 className="w-3.5 h-3.5 text-amber-500" />
        <span>Yeniden Adlandır</span>
      </button>

      {/* Klasöre Taşı Button / Toggle */}
      <button
        onClick={() => setShowFolderSubmenu(!showFolderSubmenu)}
        className="w-full px-3.5 py-2 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left font-medium cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <FolderInput className="w-3.5 h-3.5 text-indigo-500" />
          <span>Klasöre Taşı</span>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showFolderSubmenu ? 'rotate-90' : ''}`} />
      </button>

      {/* Folder Submenu List */}
      {showFolderSubmenu && (
        <div className="bg-slate-50 dark:bg-slate-900/80 border-y border-slate-100 dark:border-slate-700/80 py-1 my-0.5 max-h-48 overflow-y-auto">
          <button
            onClick={() => {
              onClose();
              onMoveToFolder(item.id, null);
            }}
            className="w-full px-4 py-1.5 flex items-center justify-between text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 text-left transition-colors cursor-pointer text-[11px]"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Ana Klasör (Tümü)</span>
            </div>
            {!item.folderId && <Check className="w-3 h-3 text-indigo-500 shrink-0" />}
          </button>

          {mockupFolders.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                onClose();
                onMoveToFolder(item.id, f.id);
              }}
              className="w-full px-4 py-1.5 flex items-center justify-between text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 text-left transition-colors cursor-pointer text-[11px]"
            >
              <div className="flex items-center gap-2 truncate">
                <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">{f.name}</span>
              </div>
              {item.folderId === f.id && <Check className="w-3 h-3 text-indigo-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}

      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />

      <button
        onClick={() => {
          onClose();
          onDelete(item.id);
        }}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left font-medium cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Mockup'ı Sil</span>
      </button>
    </div>
  );
};
