/**
 * Tasarımlar sekmesindeki "Arka planı kaldır": görselin zeminine göre doğru yöntemi seçer.
 *  - Zemin zaten saydamsa görsel değiştirilmez.
 *  - Zemin doygun bir perde rengiyse (yeşil, magenta, mavi…) renklilik tabanlı chroma key (`chroma-key`).
 *  - Zemin düz ama nötr/açık bir renkse (beyaz, siyah, gri, krem…) renk uzaklığına dayalı düz zemin
 *    ayıklayıcı: yalnızca kenarlardan erişilen zemin silinir, tasarımın içindeki aynı renkli alanlar
 *    (beyaz harf içi, göz akı) korunur; kenar pikselleri yarı saydam yapılıp zemin rengi arındırılır.
 *  - Zemin düz bir renk değilse (fotoğraf, desen) tasarım bozulmasın diye işlem yapılmaz.
 */
import sharp from 'sharp';
import { keyOutBackground } from '@/lib/chroma-key';

type Rgb = { r: number; g: number; b: number };

export type BackgroundKind = 'transparent' | 'chroma' | 'solid' | 'complex';

export type BackgroundAnalysis = { kind: BackgroundKind; color?: Rgb; uniformity: number };

export class BackgroundRemovalError extends Error {
  constructor(message: string, readonly kind: BackgroundKind) {
    super(message);
    this.name = 'BackgroundRemovalError';
  }
}

/** Düz zeminde kesin arka plan sayılan renk uzaklığı (RGB, 0-441). */
const SOLID_CORE = 28;
/** Bu uzaklıktan sonrası tasarımdır; aradaki kenar pikselleri yarı saydam olur. */
const SOLID_EDGE = 90;
/** Kenar yumuşatması yalnızca zemine bu kadar yakın (piksel) piksellerde uygulanır. */
const EDGE_BAND = 2;
/** Kenar pikselinin saf tasarım rengi bu uzaklık (piksel) içinde aranır. */
const SEARCH = 3;

const colorDistance = (r: number, g: number, b: number, c: Rgb) => Math.hypot(r - c.r, g - c.g, b - c.b);
const isSaturated = (c: Rgb) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) > 80;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Görselin dış kenar şeridine bakarak zemin türünü belirler. Saf fonksiyon (RGBA). */
export function analyzeBackground(data: Uint8Array | Buffer, width: number, height: number): BackgroundAnalysis {
  const ring = Math.max(1, Math.min(4, Math.floor(Math.min(width, height) / 100)));
  const pixels: number[] = [];
  const push = (x: number, y: number) => pixels.push((y * width + x) * 4);
  for (let d = 0; d < ring; d++) {
    for (let x = 0; x < width; x++) { push(x, d); push(x, height - 1 - d); }
    for (let y = ring; y < height - ring; y++) { push(d, y); push(width - 1 - d, y); }
  }
  const transparent = pixels.filter((i) => data[i + 3]! < 16).length;
  if (transparent >= pixels.length * 0.6) return { kind: 'transparent', uniformity: transparent / pixels.length };

  const opaque = pixels.filter((i) => data[i + 3]! >= 16);
  const color = {
    r: median(opaque.map((i) => data[i]!)),
    g: median(opaque.map((i) => data[i + 1]!)),
    b: median(opaque.map((i) => data[i + 2]!)),
  };
  const close = opaque.filter((i) => colorDistance(data[i]!, data[i + 1]!, data[i + 2]!, color) < 40).length;
  const uniformity = close / pixels.length;
  // Kenarların en az %70'i aynı renkte değilse zemin düz sayılmaz (fotoğraf, desen, tasarım kenara taşmış).
  if (uniformity < 0.7) return { kind: 'complex', color, uniformity };
  return { kind: isSaturated(color) ? 'chroma' : 'solid', color, uniformity };
}

/**
 * Düz renkli zemini kaldırır (yerinde değiştirir). Kenarlardan taşma doldurma ile yalnızca dışarıya
 * bağlı zemin pikselleri silinir; zemine komşu kenar pikselleri için alfa, zemin rengiyle karışım
 * oranından hesaplanır (C = a·F + (1−a)·K) ve renk zeminden arındırılır. Saydam yapılan piksel sayısını döner.
 */
export function keyOutSolidBackground(data: Uint8Array | Buffer, width: number, height: number, bg: Rgb): number {
  const total = width * height;
  const dist = new Float32Array(total);
  for (let p = 0, i = 0; p < total; p++, i += 4) {
    dist[p] = data[i + 3]! < 16 ? 0 : colorDistance(data[i]!, data[i + 1]!, data[i + 2]!, bg);
  }

  // 1) Kenarlardan erişilen zemin (kesin arka plan)
  const state = new Uint8Array(total); // 1: zemin
  const queue = new Int32Array(total);
  let head = 0, tail = 0;
  const seed = (p: number) => {
    if (state[p] === 0 && dist[p]! < SOLID_CORE) { state[p] = 1; queue[tail++] = p; }
  };
  for (let x = 0; x < width; x++) { seed(x); seed((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { seed(y * width); seed(y * width + width - 1); }
  while (head < tail) {
    const p = queue[head++]!;
    const x = p % width;
    if (x > 0) seed(p - 1);
    if (x < width - 1) seed(p + 1);
    if (p >= width) seed(p - width);
    if (p < total - width) seed(p + width);
  }

  // 2) Zemine en fazla EDGE_BAND piksel uzaklıktaki tasarım pikselleri: kenar bandı
  const near = new Uint8Array(total);
  let frontier: number[] = [];
  for (let p = 0; p < total; p++) if (state[p] === 1) frontier.push(p);
  for (let step = 0; step < EDGE_BAND; step++) {
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % width;
      const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p >= width ? p - width : -1, p < total - width ? p + width : -1];
      for (const q of neighbours) {
        if (q >= 0 && state[q] === 0 && !near[q]) { near[q] = 1; next.push(q); }
      }
    }
    frontier = next;
  }

  /** Kenar bandının dışındaki (karışmamış) en yakın tasarım pikselleri arasında zemine en uzak renk. */
  const purestNeighbour = (p: number): Rgb | null => {
    const px = p % width, py = (p - px) / width;
    let best: Rgb | null = null, bestDist = SOLID_CORE;
    for (let dy = -SEARCH; dy <= SEARCH; dy++) {
      const y = py + dy;
      if (y < 0 || y >= height) continue;
      for (let dx = -SEARCH; dx <= SEARCH; dx++) {
        const x = px + dx;
        if (x < 0 || x >= width) continue;
        const q = y * width + x;
        if (state[q] === 1 || near[q] || dist[q]! <= bestDist) continue;
        const j = q * 4;
        best = { r: data[j]!, g: data[j + 1]!, b: data[j + 2]! };
        bestDist = dist[q]!;
      }
    }
    return best;
  };

  let removed = 0;
  for (let p = 0, i = 0; p < total; p++, i += 4) {
    if (state[p] === 1) {
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
      removed++;
      continue;
    }
    if (!near[p]) continue;
    // Kenar pikseli: yakındaki en saf tasarım rengi (F) ile zemin (K) arasındaki karışım oranı alfadır.
    const F = purestNeighbour(p);
    let alpha: number;
    if (F) {
      const fx = F.r - bg.r, fy = F.g - bg.g, fz = F.b - bg.b;
      const len2 = fx * fx + fy * fy + fz * fz;
      alpha = len2 > 0 ? ((data[i]! - bg.r) * fx + (data[i + 1]! - bg.g) * fy + (data[i + 2]! - bg.b) * fz) / len2 : 1;
    } else {
      alpha = dist[p]! / SOLID_EDGE;
    }
    alpha = Math.min(1, Math.max(0.04, alpha));
    if (alpha >= 0.98) continue;
    const unmix = (c: number, k: number) => Math.round(Math.min(255, Math.max(0, (c - (1 - alpha) * k) / alpha)));
    data[i] = unmix(data[i]!, bg.r);
    data[i + 1] = unmix(data[i + 1]!, bg.g);
    data[i + 2] = unmix(data[i + 2]!, bg.b);
    data[i + 3] = Math.round(data[i + 3]! * alpha);
  }
  return removed;
}

export type BackgroundRemovalResult = {
  pngBuffer: Buffer;
  method: 'chroma' | 'solid';
  removedRatio: number;
  width: number;
  height: number;
};

/** Zemin türünü belirleyip uygun yöntemle kaldırır; uygun değilse açıklayıcı bir hata fırlatır. */
export async function removeBackgroundAuto(input: Buffer): Promise<BackgroundRemovalResult> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const analysis = analyzeBackground(data, width, height);
  if (analysis.kind === 'transparent') {
    // Zemin saydam ama tasarım dolu bir plakanın (ör. siyah kare) üzerindeyse plaka kaldırılır.
    const removed = removeBackdropPlate(data, width, height);
    if (removed === 0) throw new BackgroundRemovalError('Bu tasarımın arka planı zaten saydam.', 'transparent');
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; }
    }
    const pngBuffer = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
    return { pngBuffer, method: 'solid', removedRatio: removed / (width * height), width, height };
  }
  if (analysis.kind === 'complex' || !analysis.color) {
    throw new BackgroundRemovalError(
      'Arka plan düz bir renk değil (fotoğraf veya desenli zemin). Tasarım bozulmasın diye işlem yapılmadı; düz zeminli bir görsel kullanın.',
      'complex',
    );
  }
  const removedCount = analysis.kind === 'chroma'
    ? keyOutBackground(data, width, height, analysis.color)
    : keyOutSolidBackground(data, width, height, analysis.color);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; }
  }
  const removedRatio = removedCount / (width * height);
  if (removedRatio < 0.01) {
    throw new BackgroundRemovalError('Kaldırılacak bir arka plan bulunamadı.', analysis.kind);
  }
  const pngBuffer = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { pngBuffer, method: analysis.kind, removedRatio, width, height };
}

/** Saydam zemin üzerindeki opak alanın sınır kutusu ve bu kutunun ne kadarının dolu olduğu. */
function opaqueBounds(data: Uint8Array | Buffer, width: number, height: number) {
  let minX = width, minY = height, maxX = -1, maxY = -1, opaque = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! < 128) continue;
      opaque++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  return { x: minX, y: minY, w, h, fill: opaque / (w * h) };
}

/** Bir kutunun piksellerini ayrı bir RGBA tamponuna kopyalar (geri yazmak için `pasteRegion`). */
function copyRegion(data: Uint8Array | Buffer, width: number, box: { x: number; y: number; w: number; h: number }) {
  const out = Buffer.alloc(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    const from = ((box.y + y) * width + box.x) * 4;
    out.set(data.subarray(from, from + box.w * 4), y * box.w * 4);
  }
  return out;
}

function pasteRegion(data: Uint8Array | Buffer, width: number, box: { x: number; y: number; w: number; h: number }, region: Buffer) {
  for (let y = 0; y < box.h; y++) {
    data.set(region.subarray(y * box.w * 4, (y + 1) * box.w * 4), ((box.y + y) * width + box.x) * 4);
  }
}

/**
 * Yapay zekânın ürettiği kumaş versiyonunun zeminini kaldırır (yerinde değiştirir). Görsel modelleri koyu
 * kumaş versiyonunu sık sık perde rengi yerine siyah zemine ya da tasarımın arkasına dolu bir dikdörtgen
 * plakaya çizer; bu zemin baskıda siyah bir kare olarak görünür.
 *  - Kenarlar perde rengindeyse chroma key, düz nötr bir renkteyse (siyah, beyaz…) düz zemin ayıklayıcı.
 *  - Ardından opak alan neredeyse dolu bir dikdörtgense ve çevresi düz bir renkse bu plaka da kendi
 *    kenarlarından ayıklanır. Yuvarlak amblemler (dolu oranı düşük) ve desenli kenarlar korunur.
 * Zemin desenliyse hata fırlatır; çağıran otomatik renk dönüşümüne geçer.
 */
export function cleanupVariantBackground(data: Uint8Array | Buffer, width: number, height: number, keyColor?: Rgb): void {
  const analysis = analyzeBackground(data, width, height);
  if (analysis.kind === 'complex' || (analysis.kind !== 'transparent' && !analysis.color)) {
    throw new BackgroundRemovalError('Versiyonun arka planı düz bir renk değil.', analysis.kind);
  }
  if (analysis.kind === 'chroma') keyOutBackground(data, width, height, keyColor ?? analysis.color);
  if (analysis.kind === 'solid') keyOutSolidBackground(data, width, height, analysis.color!);

  removeBackdropPlate(data, width, height);
}

/**
 * Saydam zemin üzerinde tasarımın arkasında kalmış dolu, düz renkli dikdörtgen plakayı kaldırır.
 * Opak alan sınır kutusunun en az %92'sini doldurmuyorsa (amblem, serbest biçimli tasarım) veya
 * kutunun çevresi düz bir renk değilse dokunulmaz. Kaldırılan piksel sayısını döner.
 */
function removeBackdropPlate(data: Uint8Array | Buffer, width: number, height: number): number {
  const box = opaqueBounds(data, width, height);
  if (!box || box.fill < 0.92 || box.w < width * 0.2 || box.h < height * 0.2) return 0;
  const region = copyRegion(data, width, box);
  const plate = analyzeBackground(region, box.w, box.h);
  if (plate.kind !== 'solid' || !plate.color || plate.uniformity < 0.8) return 0;
  const removed = keyOutSolidBackground(region, box.w, box.h, plate.color);
  if (removed < box.w * box.h * 0.05) return 0;
  pasteRegion(data, width, box, region);
  return removed;
}

/** `cleanupVariantBackground` görsel sarmalayıcısı: modelin ham çıktısından saydam PNG üretir. */
export async function removeVariantBackground(input: Buffer, keyColor?: Rgb): Promise<{ pngBuffer: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  cleanupVariantBackground(data, width, height, keyColor);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; }
  }
  const pngBuffer = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { pngBuffer, width, height };
}
