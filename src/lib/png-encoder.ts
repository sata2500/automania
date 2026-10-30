/**
 * Tarayıcıda kayıpsız, en yüksek sıkıştırmalı PNG kodlayıcı (misafirin tasarımları). Tarayıcıların
 * `canvas.toBlob('image/png')` çıktısı sıkıştırma düzeyi seçtirmez ve filtre seçimi zayıftır; burada sunucudaki
 * sharp ayarı (zlib 9 + uyarlanabilir filtre) taklit edilir:
 *  - Her satır için beş PNG filtresinden en küçük mutlak toplamı veren seçilir (libpng'nin sezgisi).
 *  - Hiç saydam pikseli olmayan görsel alfa kanalsız (RGB) yazılır.
 * Saf fonksiyon (DOM yok): Web Worker'da çalışır.
 */
import { zlibSync } from 'fflate';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Satırları uyarlanabilir filtreyle kodlar (her satırın başında filtre baytı). */
function filterRows(px: Uint8Array, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp;
  const out = new Uint8Array(height * (stride + 1));
  const filtered = (f: number, row: number, prev: number, i: number) => {
    const x = px[row + i]!;
    const a = i >= bpp ? px[row + i - bpp]! : 0;
    const b = prev >= 0 ? px[prev + i]! : 0;
    if (f === 0) return x;
    if (f === 1) return (x - a) & 255;
    if (f === 2) return (x - b) & 255;
    if (f === 3) return (x - ((a + b) >> 1)) & 255;
    const c = prev >= 0 && i >= bpp ? px[prev + i - bpp]! : 0;
    return (x - paeth(a, b, c)) & 255;
  };
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    const prev = y > 0 ? row - stride : -1;
    let best = 0;
    let bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      let sum = 0;
      for (let i = 0; i < stride && sum < bestSum; i++) {
        const v = filtered(f, row, prev, i);
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = f; }
    }
    const o = y * (stride + 1);
    out[o] = best;
    for (let i = 0; i < stride; i++) out[o + 1 + i] = filtered(best, row, prev, i);
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

/** RGBA pikselleri kayıpsız PNG'ye kodlar. */
export function encodePng(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array {
  let opaque = true;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) { opaque = false; break; }
  let px: Uint8Array;
  if (opaque) {
    px = new Uint8Array(width * height * 3);
    for (let p = 0, i = 0, o = 0; p < width * height; p++, i += 4, o += 3) {
      px[o] = rgba[i]!; px[o + 1] = rgba[i + 1]!; px[o + 2] = rgba[i + 2]!;
    }
  } else {
    px = rgba instanceof Uint8Array ? rgba : new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  }

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = opaque ? 2 : 6; // RGB / RGBA
  const idat = zlibSync(filterRows(px, width, height, opaque ? 3 : 4), { level: 9, mem: 12 });

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
