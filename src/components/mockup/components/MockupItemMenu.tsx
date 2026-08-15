import React, { useEffect, useRef } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { MockupItem } from '@/types/pod';

interface MockupItemMenuProps {
  item: MockupItem;
  isOpen: boolean;
  position: { top: number; left: number } | null;
  onClose: () => void;
  onRename: (item: MockupItem) => void;
  onDelete: (id: string) => void;
}

export const MockupItemMenu: React.FC<MockupItemMenuProps> = ({
  item,
  isOpen,
  position,
  onClose,
  onRename,
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
      className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-1.5 min-w-[160px] text-xs animate-in fade-in zoom-in-95 duration-100"
    >
      <button
        onClick={() => {
          onClose();
          onRename(item);
        }}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left font-medium"
      >
        <Edit2 className="w-3.5 h-3.5 text-amber-500" />
        <span>Yeniden Adlandır</span>
      </button>

      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />

      <button
        onClick={() => {
          onClose();
          onDelete(item.id);
        }}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left font-medium"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Mockup'ı Sil</span>
      </button>
    </div>
  );
};
