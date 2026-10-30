import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Layers,
  Pencil,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Video,
  X,
} from 'lucide-react';
import { MockupItem, PrintArea } from '@/types/pod';
import { DragMode } from '../hooks/useMockupTransform';

interface MockupCanvasWorkspaceProps {
  selectedMockup: MockupItem | null;
  draftAreas: PrintArea[];
  draftHasPrintArea: boolean;
  activeAreaIndex: number;
  setActiveAreaIndex: (idx: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeAreaRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.PointerEvent, mode: DragMode) => void;
  onTogglePrintAreaMode: () => void;
  onOpenMobileSettings: () => void;
  /** Düzenleme açık mı? Kapalıyken baskı alanları kilitlidir (sekmeler arası kaydırırken yanlışlıkla kaymaz). */
  editing: boolean;
  onStartEditing: () => void;
  isDirty: boolean;
  canUndo: boolean;
  onUndo: () => void;
  /** Kaydedip düzenlemeyi kapatır. */
  onSave: () => void;
  /** Kaydedilmemiş değişiklikleri atıp düzenlemeyi kapatır. */
  onCancel: () => void;
}

/**
 * Tuval kutusunu görselin gerçek en-boy oranıyla, alana sığacak en büyük boyutta tutar.
 * Baskı alanı yüzdeleri görsele göre hesaplandığından (önizleme ve Etsy çıktısı da böyle çizer)
 * kutu görselden geniş/uzun olursa alanlar kayık görünür.
 */
function useFittedSize(viewportRef: React.RefObject<HTMLDivElement | null>, aspect: number, active: boolean) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = viewportRef.current;
    if (!active || !el || !(aspect > 0)) return;
    const fit = () => {
      const style = getComputedStyle(el);
      const availW = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const availH = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (availW <= 0 || availH <= 0) return;
      const width = Math.min(availW, availH * aspect);
      setSize({ width: Math.floor(width), height: Math.floor(width / aspect) });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewportRef, aspect, active]);
  return size;
}

export const MockupCanvasWorkspace: React.FC<MockupCanvasWorkspaceProps> = ({
  selectedMockup,
  draftAreas,
  draftHasPrintArea,
  activeAreaIndex,
  setActiveAreaIndex,
  containerRef,
  activeAreaRef,
  onPointerDown,
  onTogglePrintAreaMode,
  onOpenMobileSettings,
  editing,
  onStartEditing,
  isDirty,
  canUndo,
  onUndo,
  onSave,
  onCancel,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  // Görselin gerçek boyutu (kayıtlı width/height kırpma vb. sonrası eski kalabilir).
  const [natural, setNatural] = useState<{ src: string; width: number; height: number } | null>(null);
  const storedAspect = selectedMockup?.width && selectedMockup?.height ? selectedMockup.width / selectedMockup.height : 1;
  const aspect = natural && natural.src === selectedMockup?.src ? natural.width / natural.height : storedAspect;
  const fitted = useFittedSize(viewportRef, aspect, Boolean(selectedMockup));

  const recordNaturalSize = (src: string, width: number, height: number) => {
    if (width > 0 && height > 0) setNatural({ src, width, height });
  };

  if (!selectedMockup) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center h-[520px] lg:h-[560px] shadow-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-500 mb-3">
          <Layers className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">
          Mockup Seçilmedi
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1">
          Düzenlemek veya baskı alanlarını ayarlamak için sol taraftaki listeden bir mockup seçin ya da yeni bir görsel yükleyin.
        </p>
      </div>
    );
  }

  const isVideo = selectedMockup.isVideo;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3.5 sm:p-4 flex flex-col h-[520px] lg:h-[560px] shadow-sm gap-2.5">
      {/* Canvas Top Bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate max-w-[160px] sm:max-w-[260px]">
            {selectedMockup.name}
          </h3>
          {isVideo ? (
            <span className="px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-semibold flex items-center gap-1 shrink-0">
              <Video className="w-3 h-3" />
              Video Mockup
            </span>
          ) : !draftHasPrintArea ? (
            <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-semibold shrink-0">
              Statik Tablo
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold flex items-center gap-1 shrink-0">
              <Sparkles className="w-3 h-3 text-emerald-500" />
              Baskı Aktif ({draftAreas.length})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Baskı alanı / tablo modu yalnızca düzenlemede değiştirilir */}
          {!isVideo && editing && (
            <button
              onClick={onTogglePrintAreaMode}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                draftHasPrintArea
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {draftHasPrintArea ? 'Chart Moduna Geç' : 'Baskı Alanı Ekle'}
              </span>
              <span className="sm:hidden">
                {draftHasPrintArea ? 'Chart' : 'Baskı Ekle'}
              </span>
            </button>
          )}

          {!isVideo && !editing && (
            <button
              onClick={onStartEditing}
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow active:scale-95"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Düzenle</span>
            </button>
          )}

          {/* Mobile Settings Button */}
          <button
            onClick={onOpenMobileSettings}
            className="lg:hidden p-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow flex items-center gap-1 text-xs font-bold active:scale-95"
            aria-label="Ayarları aç"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-[11px]">Ayarlar</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Viewport (Flex-1, perfectly fitting container) */}
      <div ref={viewportRef} className="flex-1 min-h-0 relative w-full flex items-center justify-center bg-slate-950/5 dark:bg-slate-950/40 rounded-2xl p-2 sm:p-3 overflow-hidden">
        <div
          ref={containerRef}
          className={`relative select-none rounded-xl overflow-hidden shadow-md bg-slate-900 shrink-0 ${editing ? 'touch-none' : 'touch-pan-y'}`}
          style={fitted ? { width: fitted.width, height: fitted.height } : { aspectRatio: String(aspect), maxWidth: '100%', maxHeight: '100%' }}
        >
          {/* Media Player / Image */}
          {isVideo ? (
            <video
              src={selectedMockup.src}
              controls
              autoPlay
              loop
              muted
              playsInline
              onLoadedMetadata={(e) => recordNaturalSize(selectedMockup.src, e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
              className="w-full h-full object-contain pointer-events-auto block"
            />
          ) : (
            <img
              src={selectedMockup.src}
              alt={selectedMockup.name}
              onLoad={(e) => recordNaturalSize(selectedMockup.src, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
              className="w-full h-full object-fill pointer-events-none block"
              draggable={false}
            />
          )}

          {/* Print Area Overlays (when enabled) */}
          {!isVideo &&
            draftHasPrintArea &&
            draftAreas.map((area, idx) => {
              // Kilitliyken alanlar yalnızca gösterilir: dokunuş alanı seçmez, taşımaz (sayfa kaydırması çalışır).
              const isActive = editing && idx === activeAreaIndex;
              const rotation = area.rotation || 0;

              return (
                <div
                  key={area.id || idx}
                  ref={isActive ? activeAreaRef : undefined}
                  onClick={editing ? (e) => {
                    e.stopPropagation();
                    setActiveAreaIndex(idx);
                  } : undefined}
                  onPointerDown={
                    isActive ? (e) => onPointerDown(e, 'move') : undefined
                  }
                  style={{
                    left: `${area.x}%`,
                    top: `${area.y}%`,
                    width: `${area.width}%`,
                    height: `${area.height}%`,
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                  }}
                  className={`absolute transition-[border-color,background-color,box-shadow] select-none ${
                    !editing
                      ? 'pointer-events-none border border-dashed border-white/70 bg-white/5 z-20'
                      : isActive
                      ? 'cursor-move touch-none border-2 border-amber-400 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.3)] z-30'
                      : 'touch-none border border-dashed border-indigo-400/80 bg-indigo-500/5 hover:border-indigo-400 z-20 cursor-pointer'
                  }`}
                >
                  {/* Area Label Tag */}
                  <div
                    className={`absolute -top-6 left-0 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide flex items-center gap-1 shadow-sm whitespace-nowrap overflow-hidden pointer-events-none ${
                      isActive
                        ? 'bg-amber-500 text-white'
                        : editing
                        ? 'bg-indigo-600/90 text-white'
                        : 'bg-slate-900/70 text-white'
                    }`}
                  >
                    <span className="truncate">{area.name || `Alan ${idx + 1}`}</span>
                    {rotation !== 0 && (
                      <span className="text-[9px] opacity-80 shrink-0">({rotation}°)</span>
                    )}
                  </div>

                  {/* Active Handle Controls */}
                  {isActive && (
                    <>
                      {/* Rotation Handle (sağ üst köşe: alan etiketinin üstüne binmez) with Expanded Mobile Touch Area */}
                      <div
                        onPointerDown={(e) => onPointerDown(e, 'rotate')}
                        className="absolute -top-5 -right-5 flex items-center justify-center p-2 cursor-grab active:cursor-grabbing touch-manipulation z-40 group/rot"
                        title="Döndürmek için sürükleyin"
                      >
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white dark:bg-slate-900 border-2 border-amber-500 text-amber-500 flex items-center justify-center shadow-md group-hover/rot:scale-110 transition-transform">
                          <RotateCw className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      {/* Bottom-Right Resize Handle with Expanded Mobile Touch Area */}
                      <div
                        onPointerDown={(e) => onPointerDown(e, 'resize-se')}
                        className="absolute -bottom-3 -right-3 p-2.5 cursor-nwse-resize touch-manipulation z-40 group/resize"
                        title="Boyutlandırmak için sürükleyin"
                      >
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-amber-500 border-2 border-white text-white shadow-md group-hover/resize:scale-110 transition-transform" />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Düzenleme çubuğu: adım adım geri alma, vazgeç, kaydet */}
      {(editing || isDirty) && (
        <div className="shrink-0 flex items-center gap-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
          <span className="flex items-center gap-1.5 min-w-0 flex-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isDirty ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="truncate">{isDirty ? 'Kaydedilmedi' : 'Düzenleniyor'}</span>
          </span>
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Son değişikliği geri al"
            aria-label="Son değişikliği geri al"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>{isDirty ? 'Vazgeç' : 'Kapat'}</span>
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={onSave}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow flex items-center gap-1 active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Kaydet</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
