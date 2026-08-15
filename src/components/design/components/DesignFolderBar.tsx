import React, { useState, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  Plus,
  FolderTree,
  MoreVertical,
  GripVertical,
} from 'lucide-react';
import { MockupFolder, DesignItem } from '@/types/pod';
import { DesignFolderMenu } from './DesignFolderMenu';

interface DesignFolderBarProps {
  designFolders: MockupFolder[];
  setDesignFolders: React.Dispatch<React.SetStateAction<MockupFolder[]>>;
  designs: DesignItem[];
  activeDesignFolderId: string | null;
  setActiveDesignFolderId: (id: string | null) => void;
  onOpenNewFolderModal: () => void;
  onOpenRenameFolderModal: (folder: MockupFolder) => void;
  onDeleteFolder: (folderId: string, name: string) => void;
}

export const DesignFolderBar: React.FC<DesignFolderBarProps> = ({
  designFolders,
  setDesignFolders,
  designs,
  activeDesignFolderId,
  setActiveDesignFolderId,
  onOpenNewFolderModal,
  onOpenRenameFolderModal,
  onDeleteFolder,
}) => {
  // Desktop Drag & Drop
  const [draggedFolderIndex, setDraggedFolderIndex] = useState<number | null>(null);
  const [dragOverFolderIndex, setDragOverFolderIndex] = useState<number | null>(null);

  // Mobile Touch Drag & Drop
  const [touchDragFolderIndex, setTouchDragFolderIndex] = useState<number | null>(null);
  const [touchOverFolderIndex, setTouchOverFolderIndex] = useState<number | null>(null);
  const touchFolderStartRef = useRef<number | null>(null);
  const touchFolderOverRef = useRef<number | null>(null);

  const [menuState, setMenuState] = useState<{
    folder: MockupFolder;
    position: { top: number; left: number };
  } | null>(null);

  // --- Desktop Handlers ---
  const handleDragStart = (index: number) => {
    setDraggedFolderIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverFolderIndex !== index) {
      setDragOverFolderIndex(index);
    }
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedFolderIndex === null || draggedFolderIndex === targetIndex) {
      setDraggedFolderIndex(null);
      setDragOverFolderIndex(null);
      return;
    }
    const updated = [...designFolders];
    const [moved] = updated.splice(draggedFolderIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setDesignFolders(updated);
    setDraggedFolderIndex(null);
    setDragOverFolderIndex(null);
  };

  // --- Mobile Touch Handlers ---
  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    touchFolderStartRef.current = index;
    touchFolderOverRef.current = index;
    setTouchDragFolderIndex(index);
    setTouchOverFolderIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchFolderStartRef.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;

    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const pillEl = el?.closest('[data-design-folder-index]');
    if (pillEl) {
      const targetIdx = Number(pillEl.getAttribute('data-design-folder-index'));
      if (
        !isNaN(targetIdx) &&
        targetIdx >= 0 &&
        targetIdx < designFolders.length
      ) {
        touchFolderOverRef.current = targetIdx;
        setTouchOverFolderIndex(targetIdx);
      }
    }
  };

  const handleTouchEnd = () => {
    const sourceIndex = touchFolderStartRef.current;
    const targetIndex = touchFolderOverRef.current;

    if (
      sourceIndex !== null &&
      targetIndex !== null &&
      sourceIndex !== targetIndex &&
      sourceIndex >= 0 &&
      targetIndex >= 0 &&
      sourceIndex < designFolders.length &&
      targetIndex < designFolders.length
    ) {
      const updated = [...designFolders];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, moved);
      setDesignFolders(updated);
    }

    touchFolderStartRef.current = null;
    touchFolderOverRef.current = null;
    setTouchDragFolderIndex(null);
    setTouchOverFolderIndex(null);
  };

  const openFolderMenu = (folder: MockupFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuState({
      folder,
      position: {
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 180),
      },
    });
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/90 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Tasarım Klasörleri
          </label>
          <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
            (Sıralamak için sürükleyip bırakabilirsiniz)
          </span>
        </div>
        <button
          onClick={onOpenNewFolderModal}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Yeni Klasör</span>
        </button>
      </div>

      {/* Horizontal Scrollable Tabs */}
      <div className="grid grid-rows-1 grid-flow-col auto-cols-max gap-2 overflow-x-auto custom-scrollbar pb-2.5 items-center">
        {/* All Designs Tab */}
        <button
          onClick={() => setActiveDesignFolderId(null)}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer max-w-[210px] min-w-0 ${
            activeDesignFolderId === null
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FolderTree
            className={`w-4 h-4 shrink-0 ${
              activeDesignFolderId === null
                ? 'text-amber-300'
                : 'text-indigo-500 dark:text-indigo-400'
            }`}
          />
          <span className="truncate">Tüm Tasarımlar</span>
          <span
            className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold shrink-0 ${
              activeDesignFolderId === null
                ? 'bg-slate-950/80 text-amber-300'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            {designs.length}
          </span>
        </button>

        {/* Custom Design Folders */}
        {designFolders.map((folder, index) => {
          const isActive = activeDesignFolderId === folder.id;
          const folderDesignsCount = designs.filter((d) => d.folderId === folder.id).length;
          const isBeingDragged =
            draggedFolderIndex === index || touchDragFolderIndex === index;
          const isDropTarget =
            (dragOverFolderIndex === index && draggedFolderIndex !== index) ||
            (touchOverFolderIndex === index && touchDragFolderIndex !== index);

          return (
            <div
              key={folder.id}
              data-design-folder-index={index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onClick={() => setActiveDesignFolderId(folder.id)}
              className={`relative flex items-center space-x-1.5 pl-2.5 pr-2 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer max-w-[240px] min-w-0 ${
                isBeingDragged
                  ? 'opacity-30 scale-95 border-dashed border-indigo-400'
                  : 'opacity-100'
              } ${
                isDropTarget
                  ? 'border-indigo-400 bg-indigo-500/20 ring-2 ring-indigo-400/50'
                  : ''
              } ${
                isActive && !isBeingDragged && !isDropTarget
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                  : !isBeingDragged && !isDropTarget
                  ? 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  : ''
              }`}
              title={`${folder.name} (${folderDesignsCount} Tasarım)`}
            >
              {/* Drag Handle (Touch & Mouse) */}
              <div
                onTouchStart={(e) => handleTouchStart(index, e)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="opacity-40 hover:opacity-100 shrink-0 cursor-grab active:cursor-grabbing p-0.5 touch-none"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>

              {isActive ? (
                <FolderOpen className="w-4 h-4 text-amber-300 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-slate-400 shrink-0" />
              )}

              <span className="truncate max-w-[110px]">{folder.name}</span>

              <span
                className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold shrink-0 ${
                  isActive
                    ? 'bg-slate-950/80 text-amber-300'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {folderDesignsCount}
              </span>

              {/* 3-Dots Menu Button */}
              <button
                onClick={(e) => openFolderMenu(folder, e)}
                className={`p-1 rounded-lg transition-colors ml-1 ${
                  isActive
                    ? 'text-white/70 hover:text-white hover:bg-white/10'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
                title="Klasör Seçenekleri"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Popover Menu */}
      {menuState && (
        <DesignFolderMenu
          folder={menuState.folder}
          isOpen={true}
          position={menuState.position}
          onClose={() => setMenuState(null)}
          onRename={onOpenRenameFolderModal}
          onDelete={onDeleteFolder}
        />
      )}
    </div>
  );
};
