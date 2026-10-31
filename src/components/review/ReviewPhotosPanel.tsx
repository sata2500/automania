'use client';

/**
 * Hazır İlanlar › ilan penceresi › Görseller: fotoğrafları sürükle-bırak ile sıralama (farede sürükle, dokunmatikte
 * basılı tutup sürükle), seçip indirme (tek dosya veya ZIP), seçili fotoğrafın ayrıntıları ve tanıtım videosu.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Download, Eye, EyeOff, Film, GripVertical, Star, X } from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';
import { useToast } from '@/components/common/ToastContext';
import { downloadBlob } from '@/lib/download';

export type PhotoRow = { url: string; included: boolean; alt: string };

type Props = {
  photos: PhotoRow[];
  editable: boolean;
  activeIndex: number;
  onActivate: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onUpdate: (index: number, patch: Partial<PhotoRow>) => void;
  videoUrl?: string | null;
  includeVideo: boolean;
  onIncludeVideo: (value: boolean) => void;
  /** İndirilen dosyaların adı (ör. SKU) */
  fileBase: string;
};

const inputClass = 'w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30';
const smallButton = 'px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1 text-slate-700 dark:text-slate-200 disabled:opacity-30';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const safeName = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'ilan';

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Dosya indirilemedi.');
  return res.blob();
}

/** Dosyaları indirir: tek dosya doğrudan, birden fazlası ZIP olarak. */
async function downloadFiles(files: Array<{ url: string; name: string }>, zipName: string): Promise<void> {
  const blobs = await Promise.all(files.map(async (f) => ({ name: f.name, blob: await fetchBlob(f.url) })));
  const named = blobs.map(({ name, blob }) => ({ name: `${name}.${EXT[blob.type] ?? 'jpg'}`, blob }));
  if (named.length === 1) {
    downloadBlob(named[0]!.blob, named[0]!.name);
    return;
  }
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const file of named) zip.file(file.name, file.blob);
  downloadBlob(await zip.generateAsync({ type: 'blob' }), `${zipName}.zip`);
}

type DragState = { index: number; pointerId: number; x: number; y: number; active: boolean; timer?: number };

export function ReviewPhotosPanel({ photos, editable, activeIndex, onActivate, onMove, onUpdate, videoUrl, includeVideo, onIncludeVideo, fileBase }: Props) {
  const toast = useToast();
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [video, setVideo] = useState<{ vertical: boolean; seconds: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const base = safeName(fileBase);

  const current = photos[Math.min(activeIndex, photos.length - 1)];
  const currentIndex = Math.min(activeIndex, photos.length - 1);

  // Dokunmatikte basılı tutup sürüklerken sayfa kaymasın (pasif olmayan dinleyici gerekir).
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const onTouchMove = (e: TouchEvent) => { if (drag.current?.active) e.preventDefault(); };
    grid.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => grid.removeEventListener('touchmove', onTouchMove);
  }, []);

  // Videonun yönü ve süresi (meta veri sayfa hazır olmadan yüklendiyse olay kaçmasın diye hemen de okunur).
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const read = () => { if (el.videoWidth > 0) setVideo({ vertical: el.videoHeight > el.videoWidth, seconds: el.duration }); };
    read();
    el.addEventListener('loadedmetadata', read);
    return () => el.removeEventListener('loadedmetadata', read);
  }, [videoUrl]);

  const resetDrag = () => {
    if (drag.current?.timer) window.clearTimeout(drag.current.timer);
    drag.current = null;
    setDragIndex(null);
    setOverIndex(null);
  };
  const activate = () => {
    if (!drag.current) return;
    drag.current.active = true;
    // Sürükleme başlayınca işaretçi ızgarada tutulur (fare dışarı çıksa da bırakma yakalanır). Basışta değil
    // burada yakalanır: aksi hâlde normal dokunuşun tıklaması düğmeye ulaşmaz.
    try { gridRef.current?.setPointerCapture(drag.current.pointerId); } catch { /* işaretçi kalkmış */ }
    setDragIndex(drag.current.index);
    setOverIndex(drag.current.index);
    navigator.vibrate?.(10);
  };
  const canDrag = editable && !selectMode && photos.length > 1;

  const onPointerDown = (e: React.PointerEvent, index: number) => {
    if (!canDrag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { index, pointerId: e.pointerId, x: e.clientX, y: e.clientY, active: false };
    // Dokunmatikte basılı tutunca (kaydırmayla karışmasın), farede hafif hareketle başlar.
    if (e.pointerType !== 'mouse') drag.current.timer = window.setTimeout(activate, 280);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const distance = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (!d.active) {
      if (e.pointerType === 'mouse' && distance > 5) activate();
      else if (e.pointerType !== 'mouse' && distance > 8) resetDrag(); // kaydırma
      return;
    }
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-photo-index]');
    if (target && gridRef.current?.contains(target)) setOverIndex(Number(target.dataset.photoIndex));
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (d?.active) {
      // Sürüklemenin ardından gelen tıklama yok sayılır (tıklama gelmezse bayrak hemen sonra kalkar).
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
      if (overIndex !== null && overIndex !== d.index) onMove(d.index, overIndex);
    }
    resetDrag();
  };

  const onThumbClick = (index: number, url: string) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (selectMode) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(url)) next.delete(url); else next.add(url);
        return next;
      });
      return;
    }
    onActivate(index);
  };

  const download = async (urls: string[]) => {
    if (urls.length === 0) return;
    setDownloading(true);
    try {
      await downloadFiles(urls.map((url) => ({ url, name: `${base}-${photos.findIndex((p) => p.url === url) + 1}` })), `${base}-fotograflar`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İndirilemedi.');
    } finally {
      setDownloading(false);
    }
  };
  const downloadVideo = async () => {
    if (!videoUrl) return;
    setDownloading(true);
    try { await downloadFiles([{ url: videoUrl, name: `${base}-video` }], `${base}-video`); } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İndirilemedi.');
    } finally { setDownloading(false); }
  };

  const selectedUrls = photos.filter((p) => selected.has(p.url)).map((p) => p.url);
  const videoDurationOk = !video || (video.seconds >= 5 && video.seconds <= 15.5);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="flex-1 min-w-[12rem] text-[11px] text-slate-500 dark:text-slate-400">
          {selectMode
            ? 'İndirmek istediğiniz fotoğraflara dokunun.'
            : editable
              ? 'Sırayı değiştirmek için fotoğrafı sürükleyin (telefonda basılı tutup sürükleyin); ilki ilanın kapağıdır. Ayrıntılar için dokunun.'
              : 'Fotoğraflar bu sırayla gönderilir; ilki ilanın kapağıdır.'}
        </p>
        {selectMode ? (
          <>
            <button type="button" className={smallButton} onClick={() => setSelected(selected.size === photos.length ? new Set() : new Set(photos.map((p) => p.url)))}>
              {selected.size === photos.length ? 'Seçimi kaldır' : 'Tümünü seç'}
            </button>
            <button type="button" disabled={selectedUrls.length === 0 || downloading} onClick={() => void download(selectedUrls)} className="px-2.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1 disabled:opacity-40">
              {downloading ? <Spinner className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />} İndir ({selectedUrls.length})
            </button>
            <button type="button" aria-label="Seçimden çık" className={smallButton} onClick={() => { setSelectMode(false); setSelected(new Set()); }}><X className="w-3.5 h-3.5" /></button>
          </>
        ) : (
          <>
            <button type="button" className={smallButton} onClick={() => setSelectMode(true)}><CheckCircle2 className="w-3.5 h-3.5" /> Seç</button>
            <button type="button" disabled={downloading} className={smallButton} onClick={() => void download(photos.map((p) => p.url))}>
              {downloading ? <Spinner className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />} Tümünü indir
            </button>
          </>
        )}
      </div>

      <div ref={gridRef} className="grid grid-cols-4 sm:grid-cols-6 gap-2 select-none" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={resetDrag} onPointerLeave={() => { if (!drag.current?.active) resetDrag(); }}>
        {photos.map((photo, index) => {
          const isDragged = dragIndex === index;
          const isTarget = dragIndex !== null && overIndex === index && overIndex !== dragIndex;
          const isSelected = selected.has(photo.url);
          return (
            <button
              key={photo.url}
              type="button"
              data-photo-index={index}
              onPointerDown={(e) => onPointerDown(e, index)}
              onClick={() => onThumbClick(index, photo.url)}
              onContextMenu={(e) => { if (canDrag) e.preventDefault(); }}
              aria-label={`Fotoğraf ${index + 1}${photo.included ? '' : ' (ilana eklenmiyor)'}`}
              aria-pressed={selectMode ? isSelected : undefined}
              style={{ WebkitTouchCallout: 'none' }}
              className={`relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 transition-transform ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''} ${
                isDragged ? 'opacity-40 scale-95' : ''} ${isTarget ? 'ring-2 ring-amber-400 scale-105' : !selectMode && index === currentIndex ? 'ring-2 ring-indigo-500' : ''} ${selectMode && isSelected ? 'ring-2 ring-indigo-500' : ''}`}
            >
              <img src={photo.url} alt="" loading="lazy" draggable={false} className={`w-full h-full object-cover pointer-events-none ${photo.included ? '' : 'opacity-35 grayscale'}`} />
              <span className="absolute top-1 left-1 min-w-5 h-5 px-1 rounded-md bg-slate-900/75 text-white text-[10px] font-bold flex items-center justify-center">{index + 1}</span>
              {canDrag && <GripVertical className="absolute top-1 right-1 w-4 h-4 text-white drop-shadow hidden sm:block" aria-hidden="true" />}
              {selectMode && (
                <span className="absolute top-1 right-1">
                  {isSelected ? <CheckCircle2 className="w-5 h-5 text-white fill-indigo-600" /> : <Circle className="w-5 h-5 text-white drop-shadow" />}
                </span>
              )}
              {index === 0 && photo.included && <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[9px] font-bold flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-current" />Kapak</span>}
              {!photo.included && <span className="absolute inset-0 flex items-center justify-center"><EyeOff className="w-5 h-5 text-slate-700 dark:text-slate-200" /></span>}
            </button>
          );
        })}
      </div>

      {current && !selectMode && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col sm:flex-row gap-3">
          <img src={current.url} alt={current.alt || `Fotoğraf ${currentIndex + 1}`} className="w-full sm:w-44 aspect-square object-cover rounded-xl bg-slate-100 dark:bg-slate-800" />
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 mr-auto">Fotoğraf {currentIndex + 1}</span>
              <button type="button" aria-label="Fotoğrafı indir" disabled={downloading} onClick={() => void download([current.url])} className={smallButton}><Download className="w-3.5 h-3.5" /></button>
              {editable && (
                <>
                  <button type="button" aria-label="Sola taşı" disabled={currentIndex === 0} onClick={() => onMove(currentIndex, currentIndex - 1)} className={smallButton}><ArrowLeft className="w-3.5 h-3.5" /></button>
                  <button type="button" aria-label="Sağa taşı" disabled={currentIndex === photos.length - 1} onClick={() => onMove(currentIndex, currentIndex + 1)} className={smallButton}><ArrowRight className="w-3.5 h-3.5" /></button>
                  <button type="button" disabled={currentIndex === 0} onClick={() => onMove(currentIndex, 0)} className={smallButton}><Star className="w-3.5 h-3.5" /> Kapak yap</button>
                  <button
                    type="button"
                    onClick={() => onUpdate(currentIndex, { included: !current.included })}
                    className={`px-2.5 py-2 rounded-lg text-[11px] font-bold flex items-center gap-1 ${current.included ? 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200' : 'bg-indigo-600 text-white'}`}
                  >
                    {current.included ? <><EyeOff className="w-3.5 h-3.5" /> Çıkar</> : <><Eye className="w-3.5 h-3.5" /> Ekle</>}
                  </button>
                </>
              )}
            </div>
            <label className="block">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Alt metin <span className="font-normal text-slate-400">({current.alt.length}/250)</span></span>
              <textarea
                value={current.alt}
                disabled={!editable}
                maxLength={250}
                rows={3}
                placeholder="Görselin kısa tarifi (görmeyen alıcılar ve arama için)"
                onChange={(e) => onUpdate(currentIndex, { alt: e.target.value })}
                className={`${inputClass} resize-none`}
              />
            </label>
          </div>
        </div>
      )}

      {videoUrl && (
        <section aria-label="Tanıtım videosu" className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex flex-col sm:flex-row">
            <div className="bg-slate-950 flex items-center justify-center p-3 sm:p-4 sm:w-72 shrink-0">
              <video
                ref={videoRef}
                // #t ile ilk kare önizleme olarak görünür (poster yok).
                src={`${videoUrl}#t=0.1`}
                controls
                muted
                loop
                playsInline
                preload="metadata"
                className={`rounded-xl bg-black shadow-lg ${video?.vertical === false ? 'w-full aspect-video' : 'h-[min(52vh,380px)] aspect-[9/16]'} ${includeVideo ? '' : 'opacity-50'}`}
              />
            </div>
            <div className="flex-1 p-4 space-y-3">
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><Film className="w-4 h-4 text-indigo-500" /> Tanıtım videosu</p>
                {video && (
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {video.vertical ? 'Dikey (9:16)' : 'Yatay (16:9)'} · {Math.round(video.seconds)} sn
                  </p>
                )}
              </div>
              <label className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer ${includeVideo ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Videoyu ilana ekle</span>
                <input type="checkbox" role="switch" className="w-4 h-4 accent-indigo-600" checked={includeVideo} disabled={!editable} onChange={(e) => onIncludeVideo(e.target.checked)} />
              </label>
              {!videoDurationOk && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">Etsy 5–15 saniyelik videoları kabul eder; bu video yayında reddedilebilir.</p>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Etsy videoyu ilan galerisinde fotoğrafların yanında sessiz oynatır (ilan başına bir video).</p>
              <button type="button" disabled={downloading} onClick={() => void downloadVideo()} className={smallButton}>
                {downloading ? <Spinner className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />} Videoyu indir
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
