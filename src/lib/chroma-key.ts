/**
 * Chroma Key — Yeşil Arka Plan Kaldırma Servisi
 * ================================================
 * AI tarafından yeşil perde (#00FF00) üzerinde üretilen tasarımdan transparan PNG oluşturur.
 *
 * Tasarımın içindeki yeşilleri (çam ağacı, yeşil ampul, kıyafet) korumak ve kenarları pürüzsüz
 * bırakmak için "ton aralığındaki her pikseli sil" yerine şu adımlar izlenir:
 *  1. Perde rengi görselin kenarlarından ölçülür (sabit #00FF00 varsayılmaz).
 *  2. Her pikselin perdeye uzaklığı renklilik (CbCr) düzleminde hesaplanır; parlaklık farkları
 *     (perdedeki hafif gölge/ışık) sonucu etkilemez.
 *  3. Arka plan, kenarlardan başlayan taşma doldurmayla bulunur: yalnızca dışarıya bağlı perde
 *     pikselleri silinir. Tasarımın içinde kalan bölgeler (harf boşlukları vb.) ancak perdeyle
 *     neredeyse aynı renkteyse silinir; tasarımın kendi yeşilleri dokunulmadan kalır.
 *  4. Kenar şeridindeki pikseller için alfa, yakındaki tasarım rengi (F) ile perde rengi (K)
 *     arasında doğrusal ayrıştırmayla bulunur: C = a·F + (1−a)·K. Renk de perdeden arındırılır
 *     (yeşil hale/taşma kalmaz), böylece kenarlar tırtıksız ve yumuşak olur.
 */

import sharp from 'sharp';

// ─── Tipler ──────────────────────────────────────────────────────────────────

export interface ChromaKeyOptions {
  /**
   * Perde rengi. Verilmezse görselin kenarlarından ölçülür; kenarlar yeşil değilse #00FF00.
   */
  keyColor?: { r: number; g: number; b: number };
}

export interface ChromaKeyResult {
  /** PNG buffer (transparan arka plan) */
  pngBuffer: Buffer;
  /** Kaldırılan (tamamen saydam) piksel oranı (0–1) */
  removedRatio: number;
  /** İşlem süresi (ms) */
  processingTimeMs: number;
}

type Rgb = { r: number; g: number; b: number };

const DEFAULT_KEY: Rgb = { r: 0, g: 255, b: 0 };
/** Kenar şeridinin genişliği (piksel): alfa ayrıştırması bu bantta yapılır (hale dahil). */
const BAND_RADIUS = 4;
/** Tasarımın içinde perdeyle karışmış sayılabilecek en büyük renklilik uzaklığı. */
const MIXED_MAX_DIST = 0.7;
/** Karışım doğrusuna oturma toleransı (RGB uzaklığı). */
const FIT_TOLERANCE = 26;
/** Parıltı/gölge gibi geniş karışım bölgelerinde tasarım renginin arandığı uzaklık (piksel). */
const HALO_SEARCH_RADIUS = 32;
/** Kenar yumuşaması (anti-aliasing) bölgesinin genişliği (piksel). */
const EDGE_RADIUS = 2;
/** Kenar pikseli için tasarım/perde rengi aranırken bakılan en büyük uzaklık. */
const SEARCH_RADIUS = 4;

// ─── Renk yardımcıları ───────────────────────────────────────────────────────

/** RGB → (Cb, Cr) renklilik bileşenleri (BT.601, 128 merkezli). */
function chroma(r: number, g: number, b: number): [number, number] {
  return [
    128 - 0.168736 * r - 0.331264 * g + 0.5 * b,
    128 + 0.5 * r - 0.418688 * g - 0.081312 * b,
  ];
}

function isGreenish({ r, g, b }: Rgb): boolean {
  return g > 80 && g - Math.max(r, b) > 40;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Görselin dış kenarındaki yeşil piksellerin medyan rengi: perde rengi tahmini. */
export function estimateKeyColor(data: Uint8Array | Buffer, width: number, height: number, channels: number): Rgb {
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const ring = Math.max(1, Math.min(4, Math.floor(Math.min(width, height) / 50)));
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    if (channels === 4 && data[i + 3]! < 128) return;
    const px = { r: data[i]!, g: data[i + 1]!, b: data[i + 2]! };
    if (!isGreenish(px)) return;
    rs.push(px.r); gs.push(px.g); bs.push(px.b);
  };
  for (let d = 0; d < ring; d++) {
    for (let x = 0; x < width; x++) { sample(x, d); sample(x, height - 1 - d); }
    for (let y = 0; y < height; y++) { sample(d, y); sample(width - 1 - d, y); }
  }
  const perimeter = 2 * (width + height) * ring;
  // Kenarların en az %20'si yeşil değilse bu bir yeşil perde görseli sayılmaz.
  if (rs.length < perimeter * 0.2) return DEFAULT_KEY;
  return { r: median(rs), g: median(gs), b: median(bs) };
}

// ─── Ana algoritma ───────────────────────────────────────────────────────────

/**
 * Ham RGBA pikseller üzerinde perdeyi kaldırır (yerinde değiştirir). Saf fonksiyon; test edilebilir.
 * @returns Tamamen saydam yapılan piksel sayısı
 */
export function keyOutBackground(data: Uint8Array | Buffer, width: number, height: number, key?: Rgb): number {
  const channels = 4;
  const total = width * height;
  const K = key ?? estimateKeyColor(data, width, height, channels);
  const [kCb, kCr] = chroma(K.r, K.g, K.b);
  // Perdenin nötr griye uzaklığı: tüm eşikler buna göre ölçeklenir (soluk perdelerde de çalışır).
  const keyRadius = Math.max(40, Math.hypot(kCb - 128, kCr - 128));

  // 1) Perdeye renklilik uzaklığı
  const dist = new Float32Array(total);
  for (let p = 0, i = 0; p < total; p++, i += 4) {
    const [cb, cr] = chroma(data[i]!, data[i + 1]!, data[i + 2]!);
    dist[p] = data[i + 3]! < 8 ? 0 : Math.hypot(cb - kCb, cr - kCr) / keyRadius;
  }

  // Kenardaki perde piksellerinin gürültüsüne göre çekirdek eşiği (sıkıştırma kusurlarına dayanıklı).
  const borderDists: number[] = [];
  for (let x = 0; x < width; x++) { borderDists.push(dist[x]!, dist[(height - 1) * width + x]!); }
  for (let y = 0; y < height; y++) { borderDists.push(dist[y * width]!, dist[y * width + width - 1]!); }
  const nearKey = borderDists.filter((d) => d < 0.3).sort((a, b) => a - b);
  const p95 = nearKey.length > 0 ? nearKey[Math.floor(nearKey.length * 0.95)]! : 0.1;
  /** Bu uzaklığın altı kesin perde sayılır. */
  const coreT = Math.min(0.32, Math.max(0.16, p95 * 1.6));
  /** Tasarımın içinde kalan bölgeler çoğunlukla bu kadar perdeye yakınsa silinir (harf boşlukları). */
  const holeT = coreT * 0.6;
  /** Perdeyle karışmış olabilecek yeşilimsi piksel (tasarımın koyu/doygun yeşilleri bu aralığın dışında). */
  const isMixedGreen = (p: number, i: number) =>
    dist[p]! < MIXED_MAX_DIST && data[i + 1]! - Math.max(data[i]!, data[i + 2]!) > 20;

  // 2) Kenarlardan taşma doldurma: dışarıya bağlı perde pikselleri arka plandır.
  const BG = 1;
  const state = new Uint8Array(total); // 0: tasarım, 1: arka plan
  const queue = new Int32Array(total);
  let head = 0, tail = 0;
  const seed = (p: number) => {
    if (state[p] === 0 && dist[p]! < coreT) { state[p] = BG; queue[tail++] = p; }
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

  // 3) Kapalı perde bölgeleri (ör. "O" harfinin içi): bölge ortalaması perdeye çok yakınsa silinir.
  const visited = new Uint8Array(total);
  for (let start = 0; start < total; start++) {
    if (state[start] === BG || visited[start] || dist[start]! >= coreT) continue;
    head = 0; tail = 0;
    queue[tail++] = start; visited[start] = 1;
    let pure = 0;
    while (head < tail) {
      const p = queue[head++]!;
      if (dist[p]! < holeT) pure++;
      const x = p % width;
      const visit = (q: number) => {
        if (!visited[q] && state[q] !== BG && dist[q]! < coreT) { visited[q] = 1; queue[tail++] = q; }
      };
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (p >= width) visit(p - width);
      if (p < total - width) visit(p + width);
    }
    // Bölgenin çoğu perdeyle neredeyse aynı renkteyse boşluktur; birkaç piksellik parçalar gürültü
    // olabilir, onları kenar ayrıştırması yumuşatır.
    if (tail >= 6 && pure >= tail * 0.5) {
      for (let k = 0; k < tail; k++) state[queue[k]!] = BG;
    }
  }

  // 4) Ayrıştırılacak pikseller: arka plan sınırına BAND_RADIUS uzaklıktakiler (kenar yumuşaması,
  //    hale) ve tasarımın içinde perdeyle karışmış yeşilimsi pikseller (ince çatlak, boşluk).
  // band: 1 = ayrıştırılacak, 2 = ayrıca arka plana EDGE_RADIUS uzaklıkta (kenar yumuşaması bölgesi)
  const band = new Uint8Array(total);
  for (let p = 0; p < total; p++) {
    const x = p % width;
    const isBoundary = (x > 0 && state[p - 1] !== state[p])
      || (x < width - 1 && state[p + 1] !== state[p])
      || (p >= width && state[p - width] !== state[p])
      || (p < total - width && state[p + width] !== state[p]);
    if (!isBoundary) continue;
    const y = (p - x) / width;
    for (let dy = -BAND_RADIUS; dy <= BAND_RADIUS; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= height) continue;
      for (let dx = -BAND_RADIUS; dx <= BAND_RADIUS; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= width) continue;
        const near = Math.abs(dx) <= EDGE_RADIUS && Math.abs(dy) <= EDGE_RADIUS;
        if (near) band[yy * width + xx] = 2;
        else if (!band[yy * width + xx]) band[yy * width + xx] = 1;
      }
    }
  }
  for (let p = 0, i = 0; p < total; p++, i += 4) {
    if (!band[p] && state[p] !== BG && isMixedGreen(p, i)) band[p] = 1;
  }
  // Arka plandan, perdeyle karışmış yeşilimsi pikseller boyunca ulaşılabilen bölge (parıltı, gölge, hale).
  const halo = new Uint8Array(total);
  head = 0; tail = 0;
  for (let p = 0; p < total; p++) {
    if (state[p] !== BG) continue;
    const x = p % width;
    if ((x > 0 && state[p - 1] !== BG) || (x < width - 1 && state[p + 1] !== BG)
      || (p >= width && state[p - width] !== BG) || (p < total - width && state[p + width] !== BG)) queue[tail++] = p;
  }
  const spread = (q: number) => {
    if (state[q] !== BG && !halo[q] && isMixedGreen(q, q * 4)) { halo[q] = 1; band[q] = Math.max(band[q]!, 1); queue[tail++] = q; }
  };
  while (head < tail) {
    const p = queue[head++]!;
    const x = p % width;
    if (x > 0) spread(p - 1);
    if (x < width - 1) spread(p + 1);
    if (p >= width) spread(p - width);
    if (p < total - width) spread(p + width);
  }

  // 5) Alfa ayrıştırma. Önce orijinal renkler okunur, sonra yazılır (komşular değişmeden kullanılır).
  const source = Uint8Array.from(data);
  const out = data;
  let removed = 0;
  for (let p = 0, i = 0; p < total; p++, i += 4) {
    const originalAlpha = source[i + 3]!;
    if (!band[p]) {
      if (state[p] === BG) { out[i + 3] = 0; removed++; }
      continue;
    }

    const x = p % width;
    const y = (p - x) / width;
    const cR = source[i]!, cG = source[i + 1]!, cB = source[i + 2]!;

    // Yerel perde rengi: en yakın kesin perde piksellerinin ortalaması (perdedeki ışık farkına uyum).
    let kR = K.r, kG = K.g, kB = K.b;
    {
      let sR = 0, sG = 0, sB = 0, n = 0, best = Infinity;
      for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          const q = yy * width + xx;
          if (state[q] !== BG || dist[q]! >= holeT) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 < best) { best = d2; sR = sG = sB = n = 0; }
          if (d2 === best) { const j = q * 4; sR += source[j]!; sG += source[j + 1]!; sB += source[j + 2]!; n++; }
        }
      }
      if (n > 0) { kR = sR / n; kG = sG / n; kB = sB / n; }
    }

    // Tasarım rengi (F): komşular arasında, pikselin perde ile kendisi arasındaki doğruya en iyi
    // oturan ve perdeden daha uzak olan renk. Karışım pikseli C = a·F + (1−a)·K bu doğrunun üzerindedir;
    // tasarımın kendi yeşilleri (ağaç, ampul) hiçbir komşuyla perde arasındaki doğruya oturmaz → korunur.
    let alpha = -1;
    let fR = 0, fG = 0, fB = 0;
    let bestResidual = Infinity;
    let farQ = -1;
    const ownDist = dist[p]!;
    const searchMix = (radius: number, step: number) => {
      for (let dy = -radius; dy <= radius; dy += step) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -radius; dx <= radius; dx += step) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          const q = yy * width + xx;
          if (state[q] === BG || dist[q]! < ownDist + 0.05) continue;
          if (farQ < 0 || dist[q]! > dist[farQ]!) farQ = q;
          // Kenar bölgesi ve parıltı pikselleri kendileri de karışım olabilir; tasarım rengi olarak alınmaz.
          if (band[q] === 2 || halo[q]) continue;
          const j = q * 4;
          const vR = source[j]! - kR, vG = source[j + 1]! - kG, vB = source[j + 2]! - kB;
          const len2 = vR * vR + vG * vG + vB * vB;
          if (len2 < 2500) continue;
          const a = ((cR - kR) * vR + (cG - kG) * vG + (cB - kB) * vB) / len2;
          if (a < -0.05 || a > 1.05) continue;
          const eR = cR - kR - a * vR, eG = cG - kG - a * vG, eB = cB - kB - a * vB;
          const residual = eR * eR + eG * eG + eB * eB;
          if (residual < bestResidual) {
            bestResidual = residual; alpha = a;
            fR = source[j]!; fG = source[j + 1]!; fB = source[j + 2]!;
          }
        }
      }
    };
    searchMix(SEARCH_RADIUS, 1);
    // Arka plana bağlı geniş karışım bölgesi (yarı saydam parıltı/gölge): tasarım rengi daha uzakta aranır.
    if (halo[p] && bestResidual > FIT_TOLERANCE * FIT_TOLERANCE) searchMix(HALO_SEARCH_RADIUS, 2);

    const fitted = alpha >= 0 && bestResidual <= FIT_TOLERANCE * FIT_TOLERANCE;
    if (!fitted && state[p] === BG) {
      // Kesin perde bölgesi ve tasarım rengiyle karışım çözülemedi: arka plandır.
      out[i + 3] = 0;
      removed++;
      continue;
    }
    if (!fitted) {
      // Kenar yumuşaması bölgesindeki yeşil baskın piksel (sıkıştırma gürültüsü doğruya oturmayı bozar):
      // alfa, renklilik düzleminde perdeden en uzak komşuya doğru izdüşümle tahmin edilir.
      const greenDominant = cG - Math.max(cR, cB) > 30;
      if (band[p] !== 2 || !greenDominant || farQ < 0) continue; // Kendi rengi olan tasarım pikseli: dokunulmaz.
      const j = farQ * 4;
      fR = source[j]!; fG = source[j + 1]!; fB = source[j + 2]!;
      const [lkCb, lkCr] = chroma(kR, kG, kB);
      const [cCb, cCr] = chroma(cR, cG, cB);
      const [fCb, fCr] = chroma(fR, fG, fB);
      const len2 = (fCb - lkCb) ** 2 + (fCr - lkCr) ** 2;
      if (len2 < (keyRadius * 0.3) ** 2) continue;
      alpha = ((cCb - lkCb) * (fCb - lkCb) + (cCr - lkCr) * (fCr - lkCr)) / len2;
    }
    alpha = Math.min(1, Math.max(0, alpha));
    if (alpha < 0.05) alpha = 0;
    else if (alpha > 0.9) alpha = 1;

    if (alpha === 0) {
      out[i + 3] = 0;
      removed++;
      continue;
    }
    // Tamamen tasarıma ait çıkan piksel kendi rengini korur (yalnız kenardaki yeşil taşma temizlenir).
    if (alpha === 1 && fitted && state[p] !== BG) continue;

    // Renk: perde katkısı çıkarılır (unmix); düşük alfada tasarım rengine yaslanılır.
    let r = (cR - (1 - alpha) * kR) / alpha;
    let g = (cG - (1 - alpha) * kG) / alpha;
    let b = (cB - (1 - alpha) * kB) / alpha;
    if (alpha < 0.5) {
      const w = alpha / 0.5;
      r = r * w + fR * (1 - w); g = g * w + fG * (1 - w); b = b * w + fB * (1 - w);
    }
    // Yeşil taşma (spill) bastırma: tasarım rengi yeşil baskın değilse kenarda yeşil hale bırakma.
    const limit = Math.max(r, b) + Math.max(0, fG - Math.max(fR, fB));
    if (g > limit) g = limit;

    out[i] = Math.round(Math.min(255, Math.max(0, r)));
    out[i + 1] = Math.round(Math.min(255, Math.max(0, g)));
    out[i + 2] = Math.round(Math.min(255, Math.max(0, b)));
    out[i + 3] = Math.round(alpha * originalAlpha);
  }

  return removed;
}

/**
 * Base64 veya Buffer formatındaki görselden yeşil arka planı kaldırır.
 * @param input  - base64 string veya Buffer
 * @param options - Chroma key parametreleri
 * @returns Transparan PNG buffer
 */
export async function removeGreenBackground(
  input: string | Buffer,
  options: ChromaKeyOptions = {}
): Promise<ChromaKeyResult> {
  const startTime = Date.now();
  const buffer: Buffer = typeof input === 'string' ? Buffer.from(input, 'base64') : input;

  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const removedCount = keyOutBackground(data, width, height, options.keyColor);

  const pngBuffer = await sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

  return {
    pngBuffer,
    removedRatio: removedCount / (width * height),
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Chroma key kalitesini değerlendirir.
 */
export function evaluateChromaKeyQuality(result: ChromaKeyResult): {
  quality: 'good' | 'warning' | 'poor';
  message: string;
} {
  const { removedRatio } = result;

  if (removedRatio < 0.05) {
    return {
      quality: 'poor',
      message: 'Çok az piksel kaldırıldı. Görsel yeşil arka plana sahip olmayabilir.',
    };
  }
  if (removedRatio > 0.85) {
    return {
      quality: 'warning',
      message: `Çok fazla piksel kaldırıldı (%${Math.round(removedRatio * 100)}). Tasarımın bir kısmı da kaldırılmış olabilir.`,
    };
  }
  return {
    quality: 'good',
    message: `Arka plan başarıyla kaldırıldı (%${Math.round(removedRatio * 100)} piksel işlendi).`,
  };
}
