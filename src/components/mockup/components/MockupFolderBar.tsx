import React, { useState, useRef } from 'react';
import { Folder, Plus, MoreVertical, Video } from 'lucide-react';
import { MockupFolder, MockupItem } from '@/types/pod';
import { MockupFolderMenu } from './MockupFolderMenu';

interface MockupFolderBarProps {
  mockupFolders: MockupFolder[];
  setMockupFolders: React.Dispatch<React.SetStateAction<MockupFolder[]>>;
  mockups: MockupItem[];
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
  onOpenNewFolderModal: () => void;
  onOpenRenameFolderModal: (folder: MockupFolder) => void;
  onDuplicateFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
}

export const MockupFolderBar: React.FC<MockupFolderBarProps> = ({
  mockupFolders,
  setMockupFolders,
  mockups,
  activeFolderId,
  setActiveFolderId,
  onOpenNewFolderModal,
  onOpenRenameFolderModal,
  onDuplicateFolder,
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
    const updated = [...mockupFolders];
    const [moved] = updated.splice(draggedFolderIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setMockupFolders(updated);
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
    const pillEl = el?.closest('[data-folder-index]');
    if (pillEl) {
      const targetIdx = Number(pillEl.getAttribute('data-folder-index'));
      if (
        !isNaN(targetIdx) &&
        targetIdx >= 0 &&
        targetIdx < mockupFolders.length
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
      sourceIndex < mockupFolders.length &&
      targetIndex < mockupFolders.length
    ) {
      const updated = [...mockupFolders];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, moved);
      setMockupFolders(updated);
    }

    touchFolderStartRef.current = null;
    touchFolderOverRef.current = null;
    setTouchDragFolderIndex(null);
    setTouchOverFolderIndex(null);
  };

  const openMenuForFolder = (folder: MockupFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuState({
      folder,
      position: {
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - 180),
      },
    });
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
        {/* All Mockups Button */}
        <button
          onClick={() => setActiveFolderId(null)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
            activeFolderId === null
              ? 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/50'
          }`}
        >
          <Folder className="w-3.5 h-3.5 shrink-0" />
          <span>Tüm Mockup'lar</span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
              activeFolderId === null
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            {mockups.length}
          </span>
        </button>

        {/* Folder Pills */}
        {mockupFolders.map((folder, index) => {
          const folderMockups = mockups.filter((m) => m.folderId === folder.id);
          const count = folderMockups.length;
          const hasVideo = folderMockups.some((m) => m.isVideo);
          const isActive = activeFolderId === folder.id;

          const isBeingDragged =
            draggedFolderIndex === index || touchDragFolderIndex === index;
          const isDropTarget =
            (dragOverFolderIndex === index && draggedFolderIndex !== index) ||
            (touchOverFolderIndex === index && touchDragFolderIndex !== index);

          return (
            <div
              key={folder.id}
              data-folder-index={index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onTouchStart={(e) => handleTouchStart(index, e)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onContextMenu={(e) => openMenuForFolder(folder, e)}
              className={`group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer select-none ${
                isBeingDragged
                  ? 'opacity-30 scale-95 border-dashed border-amber-500'
                  : ''
              } ${
                isDropTarget
                  ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-500/20'
                  : ''
              } ${
                isActive && !isBeingDragged && !isDropTarget
                  ? 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : !isBeingDragged && !isDropTarget
                  ? 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  : ''
              }`}
              onClick={() => setActiveFolderId(folder.id)}
            >
              <Folder className="w-3.5 h-3.5 shrink-0" />
              <span>{folder.name}</span>

              {hasVideo && (
                <Video className="w-3 h-3 text-purple-300 dark:text-purple-400 shrink-0" />
              )}

              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {count}
              </span>

              {/* 3 dots menu button */}
              <button
                onClick={(e) => openMenuForFolder(folder, e)}
                aria-label={`${folder.name} seçenekleri`}
                className={`p-1 rounded-lg transition-colors touch-manipulation ${
                  isActive
                    ? 'hover:bg-white/20 text-white/80 hover:text-white'
                    : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {/* New Folder Button */}
        <button
          onClick={onOpenNewFolderModal}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-dashed border-slate-300 dark:border-slate-700 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-amber-500" />
          <span>Yeni Klasör</span>
        </button>
      </div>

      {/* Popover Folder Menu */}
      {menuState && (
        <MockupFolderMenu
          folder={menuState.folder}
          isOpen={true}
          position={menuState.position}
          onClose={() => setMenuState(null)}
          onRename={onOpenRenameFolderModal}
          onDuplicate={onDuplicateFolder}
          onDelete={onDeleteFolder}
        />
      )}
    </div>
  );
};
