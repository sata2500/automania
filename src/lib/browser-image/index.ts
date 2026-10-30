/**
 * Misafirin tasarım işlemleri tarayıcıda: görsel tarayıcıda açılır, pikseller Web Worker'da işlenir
 * (`pixel-ops`), sonuç kayıpsız PNG data URL'si olarak döner. Sunucuya hiçbir şey gönderilmez. Worker
 * kullanılamazsa (eski tarayıcı) aynı işlem ana iş parçacığında yapılır.
 */
import type { PixelOp, PixelOpResult } from './pixel-ops';

/** Baskı dosyasının en uzun kenarı (sunucudaki 'design' sınırıyla aynı). */
export const MAX_DESIGN_SIDE = 4500;

export type BrowserImageResult = Omit<PixelOpResult, 'png'> & { dataUrl: string | null; size: number };

type Job = { op: PixelOp; data: Uint8ClampedArray; width: number; height: number };
type Pending = Job & { resolve: (r: PixelOpResult) => void; reject: (e: Error) => void };

let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./image-tools.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; result?: PixelOpResult; error?: string }>) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      if (event.data.ok && event.data.result) entry.resolve(event.data.result);
      else entry.reject(new Error(event.data.error || 'Görsel işlenemedi.'));
    };
    worker.onerror = () => {
      // Worker yüklenemedi: bekleyen işler ana iş parçacığında tamamlanır.
      worker?.terminate();
      worker = null;
      for (const [id, job] of pending) {
        pending.delete(id);
        runOnMainThread(job).then(job.resolve, job.reject);
      }
    };
  } catch {
    worker = null;
  }
  return worker;
}

async function runOnMainThread(job: Job): Promise<PixelOpResult> {
  const { runPixelOp } = await import('./pixel-ops');
  return runPixelOp(job.op, job.data, job.width, job.height);
}

function runOp(job: Job): Promise<PixelOpResult> {
  const w = getWorker();
  if (!w) return runOnMainThread(job);
  const id = nextId++;
  return new Promise<PixelOpResult>((resolve, reject) => {
    pending.set(id, { ...job, resolve, reject });
    // Tampon kopyalanır (aktarılmaz): worker yüklenemezse aynı veriyle ana iş parçacığında devam edilir.
    w.postMessage({ id, ...job });
  });
}

function loadImage(source: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source);
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); resolve(img); };
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const heic = source instanceof File && (/\.(heic|heif)$/i.test(source.name) || /heic|heif/i.test(source.type));
      reject(new Error(heic
        ? 'HEIC/HEIF biçimi tarayıcıda açılamıyor; görseli JPG veya PNG olarak kaydedip tekrar yükleyin.'
        : 'Görsel açılamadı (bozuk dosya veya desteklenmeyen biçim). JPG, PNG veya WebP olarak tekrar deneyin.'));
    };
    img.src = objectUrl ?? (source as string);
  });
}

function bytesToDataUrl(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Görsel okunamadı.'));
    reader.readAsDataURL(new Blob([bytes as BlobPart], { type: 'image/png' }));
  });
}

/** Görseli tarayıcıda işler (en uzun kenar 4500 px'e indirilir); sonuç kırpılmış, sıkıştırılmış PNG'dir. */
export async function processImageInBrowser(source: string | Blob, op: PixelOp): Promise<BrowserImageResult> {
  const img = await loadImage(source);
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  const scale = Math.min(1, MAX_DESIGN_SIDE / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Tarayıcı görseli işleyemedi (canvas desteklenmiyor).');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  canvas.width = 0;
  canvas.height = 0;

  const { png, ...rest } = await runOp({ op, data, width, height });
  return { ...rest, dataUrl: png ? await bytesToDataUrl(png) : null, size: png?.byteLength ?? 0 };
}
