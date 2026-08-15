import React, { useEffect, useRef } from 'react';
import { Edit2, Copy, Trash2 } from 'lucide-react';
import { MockupFolder } from '@/types/pod';

interface MockupFolderMenuProps {
  folder: MockupFolder;
  isOpen: boolean;
  position: { top: number; left: number } | null;
  onClose: () => void;
  onRename: (folder: MockupFolder) => void;
  onDuplicate: (folderId: string) => void;
  onDelete: (folderId: string) => void;
}

export const MockupFolderMenu: React.FC<MockupFolderMenuProps> = ({
  folder,
  isOpen,
  position,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  return (
    <div
      ref={menuRef}
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-1.5 min-w-[170px] text-xs animate-in fade-in zoom-in-95 duration-100"
    >
      <button
        onClick={() => {
          onClose();
          onRename(folder);
        }}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left"
      >
        <Edit2 className="w-3.5 h-3.5 text-amber-500" />
        <span>Yeniden Adlandır</span>
      </button>

      <button
        onClick={() => {
          onClose();
          onDuplicate(folder.id);
        }}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left"
      >
        <Copy className="w-3.5 h-3.5 text-indigo-500" />
        <span>Klasörü Çoğalt</span>
      </button>

      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />

      <button
        onClick={() => {
          onClose();
          onDelete(folder.id);
        }}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Klasörü Sil</span>
      </button>
    </div>
  );
};
