import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  CheckSquare,
  Square,
  Copy,
  Trash2,
  GripVertical,
  MoreVertical,
  Video,
  Image as ImageIcon,
  Check,
  AlertCircle,
} from 'lucide-react';
import { MockupItem, PrintArea } from '@/types/pod';
import { MockupItemMenu } from './MockupItemMenu';

interface MockupSidebarListProps {
  filteredMockups: MockupItem[];
  allMockups: MockupItem[];
  selectedMockupId: string | null;
  setSelectedMockupId: (id: string | null) => void;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setMockups: React.Dispatch<React.SetStateAction<MockupItem[]>>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyConfigToSelected: () => void;
  onBatchDeleteRequest: () => void;
  onRequestDeleteMockup: (id: string) => void;
  activePrintArea?: PrintArea;
}

export const MockupSidebarList: React.FC<MockupSidebarListProps> = ({
  filteredMockups,
  selectedMockupId,
  setSelectedMockupId,
  selectedIds,
  setSelectedIds,
  setMockups,
  onFileUpload,
  onApplyConfigToSelected,
  onBatchDeleteRequest,
  onRequestDeleteMockup,
}) => {
  // Desktop Drag & Drop
  const [draggedMockupIndex, setDraggedMockupIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Mobile Touch Drag & Drop
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
  const [touchOverIndex, setTouchOverIndex] = useState<number | null>(null);
  const touchStartIndexRef = useRef<number | null>(null);
  const touchCurrentOverIndexRef = useRef<number | null>(null);

  // Inline Rename State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(() => new Set());

  // 3-Dots Context Menu State
  const [menuState, setMenuState] = useState<{
    item: MockupItem;
    position: { top: number; left: number };
  } | null>(null);

  const isAllSelected =
    filteredMockups.length > 0 &&
    filteredMockups.every((m) => selectedIds.includes(m.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !filteredMockups.some((m) => m.id === id))
      );
    } else {
      const currentIds = filteredMockups.map((m) => m.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const handleToggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // --- Desktop Drag & Drop Handlers ---
  const handleDragStart = (index: number) => {
    setDraggedMockupIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedMockupIndex === null || draggedMockupIndex === targetIndex) {
      setDraggedMockupIndex(null);
      setDragOverIndex(null);
      return;
    }
    const sourceItem = filteredMockups[draggedMockupIndex];
    const targetItem = filteredMockups[targetIndex];
    if (!sourceItem || !targetItem) return;

    setMockups((prev) => {
      const sourceGlobalIdx = prev.findIndex((m) => m.id === sourceItem.id);
      const targetGlobalIdx = prev.findIndex((m) => m.id === targetItem.id);
      if (sourceGlobalIdx === -1 || targetGlobalIdx === -1) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(sourceGlobalIdx, 1);
      updated.splice(targetGlobalIdx, 0, moved);
      return updated;
    });
    setDraggedMockupIndex(null);
    setDragOverIndex(null);
  };

  // --- Mobile Touch Drag & Drop Handlers ---
  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    e.stopPropagation();
    touchStartIndexRef.current = index;
    touchCurrentOverIndexRef.current = index;
    setTouchDragIndex(index);
    setTouchOverIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartIndexRef.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;

    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cardEl = el?.closest('[data-mockup-index]');
    if (cardEl) {
      const targetIdx = Number(cardEl.getAttribute('data-mockup-index'));
      if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx < filteredMockups.length) {
        touchCurrentOverIndexRef.current = targetIdx;
        setTouchOverIndex(targetIdx);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    const sourceIndex = touchStartIndexRef.current;
    const targetIndex = touchCurrentOverIndexRef.current;

    if (
      sourceIndex !== null &&
      targetIndex !== null &&
      sourceIndex !== targetIndex &&
      sourceIndex >= 0 &&
      targetIndex >= 0 &&
      sourceIndex < filteredMockups.length &&
      targetIndex < filteredMockups.length
    ) {
      const sourceItem = filteredMockups[sourceIndex];
      const targetItem = filteredMockups[targetIndex];
      if (sourceItem && targetItem) {
        setMockups((prev) => {
          const sourceGlobalIdx = prev.findIndex((m) => m.id === sourceItem.id);
          const targetGlobalIdx = prev.findIndex((m) => m.id === targetItem.id);
          if (sourceGlobalIdx === -1 || targetGlobalIdx === -1) return prev;

          const updated = [...prev];
          const [moved] = updated.splice(sourceGlobalIdx, 1);
          updated.splice(targetGlobalIdx, 0, moved);
          return updated;
        });
      }
    }

    touchStartIndexRef.current = null;
    touchCurrentOverIndexRef.current = null;
    setTouchDragIndex(null);
    setTouchOverIndex(null);
  };

  const handleStartRename = (item: MockupItem) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const handleSaveRename = (id: string) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    setMockups((prev) =>
      prev.map((m) => (m.id === id ? { ...m, name: editingName.trim() } : m))
    );
    setEditingId(null);
  };

  const openMenuForItem = (item: MockupItem, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuState({
      item,
      position: {
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 175),
      },
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3.5 flex flex-col h-[520px] lg:h-[560px] shadow-sm relative">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          {filteredMockups.length > 0 && (
            <button
              onClick={handleToggleSelectAll}
              title={isAllSelected ? 'Seçimi Kaldır' : 'Tümünü Seç'}
              className="text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-amber-500" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
          )}
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Mockup Listesi ({filteredMockups.length})
          </h3>
        </div>

        {/* Upload Button */}
        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow cursor-pointer transition-all active:scale-95">
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Yükle</span>
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={onFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="mt-2.5 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in duration-150 shrink-0">
          <span className="font-semibold text-amber-900 dark:text-amber-300">
            {selectedIds.length} Mockup Seçildi
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onApplyConfigToSelected}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg shadow-sm flex items-center gap-1 transition-colors text-[11px]"
              title="Aktif mockup'ın baskı ayarlarını seçilenlere uygula"
            >
              <Copy className="w-3 h-3" />
              <span>Ayarları Uygula</span>
            </button>
            <button
              onClick={onBatchDeleteRequest}
              className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg shadow-sm flex items-center gap-1 transition-colors text-[11px]"
              title="Seçilenleri Sil"
            >
              <Trash2 className="w-3 h-3" />
              <span>Sil</span>
            </button>
          </div>
        </div>
      )}

      {/* Mockup Item Cards List */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-2.5 space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
        {filteredMockups.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2">
            <ImageIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 stroke-[1.5]" />
            <p>Bu klasörde henüz mockup bulunmuyor.</p>
            <p className="text-[11px] text-slate-400">
              Yukarıdaki <strong>Yükle</strong> butonunu kullanarak görsel veya video ekleyebilirsiniz.
            </p>
          </div>
        ) : (
          filteredMockups.map((item, index) => {
            const isSelected = selectedMockupId === item.id;
            const isChecked = selectedIds.includes(item.id);

            const isBeingDragged =
              draggedMockupIndex === index || touchDragIndex === index;
            const isDropTarget =
              (dragOverIndex === index && draggedMockupIndex !== index) ||
              (touchOverIndex === index && touchDragIndex !== index);

            return (
              <div
                key={item.id}
                data-mockup-index={index}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onClick={() => setSelectedMockupId(item.id)}
                className={`group relative flex items-center gap-2 p-2 rounded-2xl border transition-all cursor-pointer ${
                  isBeingDragged
                    ? 'opacity-30 scale-95 border-dashed border-amber-500 shadow-inner'
                    : ''
                } ${
                  isDropTarget
                    ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-400/50'
                    : ''
                } ${
                  isSelected && !isBeingDragged && !isDropTarget
                    ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 shadow-sm'
                    : !isBeingDragged && !isDropTarget
                    ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-800'
                    : ''
                }`}
              >
                {/* Drag Handle (Supports Mouse Drag & Mobile Touch Drag) */}
                <div
                  onTouchStart={(e) => handleTouchStart(index, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="flex items-center text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 cursor-grab active:cursor-grabbing p-1 rounded-lg touch-none shrink-0"
                  title="Sıralamak için basılı tutup sürükleyin"
                >
                  <GripVertical className="w-4 h-4" />
                </div>

                {/* Multi-Select Checkbox */}
                <button
                  onClick={(e) => handleToggleSelectOne(item.id, e)}
                  aria-label="Mockup seç"
                  className="text-slate-400 hover:text-amber-500 transition-colors p-0.5 shrink-0"
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>

                {/* Thumbnail */}
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 relative flex items-center justify-center shadow-xs">
                  {item.isVideo ? (
                    <>
                      <video
                        src={item.src}
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Video className="w-4 h-4 text-white" />
                      </div>
                    </>
                  ) : brokenImageIds.has(item.id) ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-rose-50 dark:bg-rose-950/30 text-rose-500" role="img" aria-label={`${item.name} görseli erişilemiyor`}>
                      <AlertCircle className="w-4 h-4" aria-hidden="true" />
                      <span className="px-1 text-center text-[8px] font-semibold leading-tight">Erişilemiyor</span>
                    </div>
                  ) : (
                    <img
                      src={item.src}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={() => setBrokenImageIds((previous) => {
                        if (previous.has(item.id)) return previous;
                        const next = new Set(previous);
                        next.add(item.id);
                        return next;
                      })}
                    />
                  )}
                </div>

                {/* Content & Metadata */}
                <div className="flex-1 min-w-0 pr-1">
                  {editingId === item.id ? (
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(item.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="w-full text-xs font-semibold px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-amber-400 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                      />
                      <button
                        onClick={() => handleSaveRename(item.id)}
                        className="p-1 text-emerald-500 hover:text-emerald-600 shrink-0"
                        title="Kaydet"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p
                        className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 break-words cursor-text leading-snug"
                        onDoubleClick={() => handleStartRename(item)}
                        title={item.name}
                      >
                        {item.name}
                      </p>

                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {item.isVideo ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-[10px] font-semibold flex items-center gap-1">
                            <Video className="w-2.5 h-2.5" />
                            Video
                          </span>
                        ) : item.hasPrintArea === false ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-semibold">
                            Statik Chart
                          </span>
                        ) : (
                          <>
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                              {item.apparelType === 'light'
                                ? 'Açık'
                                : item.apparelType === 'dark'
                                ? 'Koyu'
                                : 'Tümü'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                              {(item.printAreas || []).length} Alan
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3-Dots Action Menu Button */}
                <button
                  onClick={(e) => openMenuForItem(item, e)}
                  aria-label={`${item.name} seçenekleri`}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors shrink-0 touch-manipulation"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Popover Item Menu */}
      {menuState && (
        <MockupItemMenu
          item={menuState.item}
          isOpen={true}
          position={menuState.position}
          onClose={() => setMenuState(null)}
          onRename={handleStartRename}
          onDelete={onRequestDeleteMockup}
        />
      )}
    </div>
  );
};
