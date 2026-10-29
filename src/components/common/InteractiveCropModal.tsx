'use client';

/**
 * Görsel kırpma penceresi: görselin tamamı üzerinde sürüklenip köşelerinden boyutlandırılan kırpma çerçevesi,
 * oran seçenekleri (serbest, 1:1, 4:5, 3:4). Çıktı, seçilen bölgenin orijinal çözünürlüğündedir (küçültülmez);
 * tasarımlar kayıpsız PNG olarak kaydedilir (saydam kenar boşlukları sunucuda zaten otomatik kırpılır).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Crop, Maximize, RotateCcw, X } from 'lucide-react';
import { loadImage } from '@/lib/canvas-renderer';
import { DialogPanel } from '@/components/common/DialogPanel';
import { Spinner } from '@/components/common/Spinner';

interface InteractiveCropModalProps {
  imageSrc: string;
  imageTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void | Promise<void>;
  /** 'design': varsayılan serbest oran, otomatik kenar kırpma ve PNG; 'photo': varsayılan 1:1 ve WebP (mockup fotoğrafları) */
  variant?: 'design' | 'photo';
}

type Rect = { x: number; y: number; w: number; h: number };
type Aspect = 'free' | '1:1' | '4:5' | '3:4';
type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

const ASPECTS: Array<{ id: Aspect; label: string; ratio: number | null }> = [
  { id: 'free', label: 'Serbest', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
];
/** Fotoğraflarda (mockup) çıktının en uzun kenarı; tasarımlar orijinal çözünürlükte kalır. */
const PHOTO_MAX_SIDE = 3000;
const MIN_SIZE = 16;
/** Parçalı yükleme sınırının (60 MB) altı; sunucu kaydederken ayrıca sıkıştırır. */
const MAX_OUTPUT_BYTES = 55 * 1024 * 1024;

/** Oranı koruyarak görselin içine sığan en büyük, ortalanmış dikdörtgen. */
function fitAspect(width: number, height: number, ratio: number | null, around?: Rect): Rect {
  if (!ratio) return around ?? { x: 0, y: 0, w: width, h: height };
  const base = around ?? { x: 0, y: 0, w: width, h: height };
  let w = base.w;
  let h = w / ratio;
  if (h > base.h) { h = base.h; w = h * ratio; }
  // Çerçeve oranı bozmadan görsel sınırları içinde kalsın.
  if (w > width) { w = width; h = w / ratio; }
  if (h > height) { h = height; w = h * ratio; }
  const cx = base.x + base.w / 2;
  const cy = base.y + base.h / 2;
  return clampRect({ x: cx - w / 2, y: cy - h / 2, w, h }, width, height);
}

function clampRect(rect: Rect, width: number, height: number): Rect {
  const w = Math.min(Math.max(rect.w, MIN_SIZE), width);
  const h = Math.min(Math.max(rect.h, MIN_SIZE), height);
  return { x: Math.min(Math.max(rect.x, 0), width - w), y: Math.min(Math.max(rect.y, 0), height - h), w, h };
}

export const InteractiveCropModal: React.FC<InteractiveCropModalProps> = ({
  imageSrc,
  imageTitle,
  isOpen,
  onClose,
  onCropComplete,
  variant = 'photo',
}) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aspect, setAspect] = useState<Aspect>(variant === 'design' ? 'free' : '1:1');
  const [rect, setRect] = useState<Rect | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; start: Rect } | null>(null);
  const [displayScale, setDisplayScale] = useState(1);

  const ratio = ASPECTS.find((a) => a.id === aspect)?.ratio ?? null;

  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    let mounted = true;
    loadImage(imageSrc)
      .then((loaded) => {
        if (!mounted) return;
        setImg(loaded);
        setRect(fitAspect(loaded.naturalWidth, loaded.naturalHeight, variant === 'design' ? null : 1));
      })
      .catch(() => { if (mounted) setLoadError('Görsel yüklenemedi.'); });
    return () => { mounted = false; };
  }, [isOpen, imageSrc, variant]);

  // Ekrandaki görsel boyutu değiştikçe (pencere/telefon döndürme) ölçek güncellenir.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !img) return;
    const update = () => setDisplayScale(stage.clientWidth / img.naturalWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [img]);

  const changeAspect = (next: Aspect) => {
    setAspect(next);
    if (!img || !rect) return;
    const nextRatio = ASPECTS.find((a) => a.id === next)?.ratio ?? null;
    setRect(fitAspect(img.naturalWidth, img.naturalHeight, nextRatio, rect));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const mode = e.currentTarget.dataset.mode as DragMode | undefined;
    if (!rect || !mode) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: rect };
  };

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !img) return;
    const dx = (e.clientX - drag.startX) / displayScale;
    const dy = (e.clientY - drag.startY) / displayScale;
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const s = drag.start;
    if (drag.mode === 'move') {
      setRect(clampRect({ ...s, x: s.x + dx, y: s.y + dy }, W, H));
      return;
    }
    // Köşe tutamakları: karşı köşe sabit kalır.
    const right = s.x + s.w;
    const bottom = s.y + s.h;
    let x0 = drag.mode.includes('w') ? Math.min(Math.max(0, s.x + dx), right - MIN_SIZE) : s.x;
    let y0 = drag.mode.includes('n') ? Math.min(Math.max(0, s.y + dy), bottom - MIN_SIZE) : s.y;
    let x1 = drag.mode.includes('e') ? Math.max(Math.min(W, right + dx), s.x + MIN_SIZE) : right;
    let y1 = drag.mode.includes('s') ? Math.max(Math.min(H, bottom + dy), s.y + MIN_SIZE) : bottom;
    if (ratio) {
      let w = x1 - x0;
      let h = y1 - y0;
      if (w / h > ratio) w = h * ratio; else h = w / ratio;
      if (drag.mode.includes('w')) x0 = x1 - w; else x1 = x0 + w;
      if (drag.mode.includes('n')) y0 = y1 - h; else y1 = y0 + h;
      if (x0 < 0 || y0 < 0 || x1 > W || y1 > H) return;
    }
    setRect({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }, [img, displayScale, ratio]);

  const onPointerUp = () => { dragRef.current = null; };

  const outputSize = useMemo(() => {
    if (!rect) return null;
    const w = Math.round(rect.w);
    const h = Math.round(rect.h);
    if (variant === 'design') return { w, h };
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(w, h));
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
  }, [rect, variant]);

  const handleSave = async () => {
    if (!img || !rect || !outputSize) return;
    setIsSaving(true);
    try {
      const render = (w: number, h: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Tuval oluşturulamadı.');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
        return variant === 'design' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/webp', 0.92);
      };
      let { w, h } = outputSize;
      let dataUrl = render(w, h);
      // Yükleme sınırı aşılırsa PNG kayıpsız kalır, çözünürlük kademeli düşürülür.
      while (dataUrl.length * 0.75 > MAX_OUTPUT_BYTES && Math.max(w, h) > 1200) {
        w = Math.round(w * 0.85);
        h = Math.round(h * 0.85);
        dataUrl = render(w, h);
      }
      await onCropComplete(dataUrl);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const s = displayScale;
  const handle = 'absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full shadow touch-none';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget && !isSaving) onClose(); }}>
      <DialogPanel aria-labelledby="crop-modal-title" onClose={isSaving ? undefined : onClose} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-3xl p-4 sm:p-6 space-y-4 shadow-2xl my-4">
        <div className="flex items-center justify-between gap-3">
          <h3 id="crop-modal-title" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
            <Crop className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="truncate">Kırp — {imageTitle}</span>
          </h3>
          <button type="button" onClick={onClose} disabled={isSaving} aria-label="Kapat" className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Kırpma oranı" className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={aspect === a.id}
                onClick={() => changeAspect(a.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${aspect === a.id ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => img && setRect(fitAspect(img.naturalWidth, img.naturalHeight, ratio))} disabled={!img} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 disabled:opacity-50">
            <Maximize className="w-3.5 h-3.5" /> Tümü
          </button>
          <button type="button" onClick={() => img && setRect(fitAspect(img.naturalWidth, img.naturalHeight, ratio, { x: img.naturalWidth * 0.1, y: img.naturalHeight * 0.1, w: img.naturalWidth * 0.8, h: img.naturalHeight * 0.8 }))} disabled={!img} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 disabled:opacity-50">
            <RotateCcw className="w-3.5 h-3.5" /> Sıfırla
          </button>
        </div>

        <div className="flex justify-center rounded-2xl p-2 sm:p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          {loadError ? (
            <p className="text-xs text-red-600 p-8">{loadError}</p>
          ) : !img || !rect ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 p-10"><Spinner className="w-4 h-4" /> Görsel yükleniyor…</div>
          ) : (
            <div
              ref={stageRef}
              className="relative select-none touch-none checkerboard"
              style={{ width: `min(100%, calc(60vh * ${img.naturalWidth / img.naturalHeight}))`, aspectRatio: `${img.naturalWidth} / ${img.naturalHeight}` }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt="" draggable={false} className="absolute inset-0 w-full h-full pointer-events-none" />
              <div
                role="presentation"
                className="absolute border-2 border-white outline outline-1 outline-indigo-600 cursor-move"
                style={{ left: rect.x * s, top: rect.y * s, width: rect.w * s, height: rect.h * s, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)' }}
                data-mode="move" onPointerDown={onPointerDown}
              >
                {/* Üçler kuralı kılavuzu */}
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }, (_, i) => <div key={i} className="border border-white/25" />)}
                </div>
                <span className={`${handle} -left-2 -top-2 cursor-nwse-resize`} data-mode="nw" onPointerDown={onPointerDown} />
                <span className={`${handle} -right-2 -top-2 cursor-nesw-resize`} data-mode="ne" onPointerDown={onPointerDown} />
                <span className={`${handle} -left-2 -bottom-2 cursor-nesw-resize`} data-mode="sw" onPointerDown={onPointerDown} />
                <span className={`${handle} -right-2 -bottom-2 cursor-nwse-resize`} data-mode="se" onPointerDown={onPointerDown} />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Çerçeveyi sürükleyin, köşelerinden boyutlandırın.
            {outputSize && <> Çıktı: <strong className="font-mono">{outputSize.w}×{outputSize.h}px</strong> {variant === 'design' ? '(kayıpsız kalitede)' : '(WebP)'}</>}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-xl">
              İptal
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={isSaving || !rect} className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 disabled:opacity-60">
              {isSaving ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              {isSaving ? 'Kaydediliyor…' : 'Kırp ve kaydet'}
            </button>
          </div>
        </div>
      </DialogPanel>
    </div>
  );
};
