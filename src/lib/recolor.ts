/**
 * Kumaş rengine uyarlama ("Koyu kumaş için uyarla" / "Açık kumaş için uyarla").
 * ===========================================================================
 * Tasarımın kumaşa değen ve kumaşla karışacak tonları algısal renk uzayında (OKLCH) yeniden düzenlenir;
 * ton (hue) ve mümkün olduğunca doygunluk korunur, yalnızca açıklık değişir (bkz. `adaptToFabric`):
 *  - Koyu kumaş: eşikten koyu tonlar ayna gibi açılır (siyah kontur → beyaz, lacivert → açık mavi,
 *    koyu kırmızı → canlı kırmızı). Zaten açık olan renklere dokunulmaz.
 *  - Açık kumaş: eşikten açık tonlar koyulaştırılır (beyaz → siyah, açık sarı → hardal, pastel → canlı).
 *    Koyu ve orta tonlar olduğu gibi kalır.
 * Renkli tonlar griye dönmesin diye renkli piksellerde hedef açıklık sınırlanır; sRGB dışına taşan renkler
 * doygunluk azaltılarak gama içine alınır. Saydamlık (alfa) değişmez, böylece kenarlar pürüzsüz kalır.
 */
import sharp from 'sharp';

export type RecolorMode = 'light_garment' | 'dark_garment';

export interface RecolorResult {
  pngBuffer: Buffer;
  processingTimeMs: number;
  /** Rengi değiştirilen (görünür) piksel oranı */
  changedRatio: number;
  /** Görselde saydam alan (kaldırılmış zemin) var mı? Yoksa uyarlama yapılamaz. */
  hasTransparency: boolean;
}

// ─── OKLab dönüşümleri (Björn Ottosson) ──────────────────────────────────────

const toLinear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toSrgb = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → doğrusal sRGB (gama içi kontrolü için kırpılmamış). */
function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = ([r, g, b]: [number, number, number]) => r >= -1e-4 && r <= 1.0001 && g >= -1e-4 && g <= 1.0001 && b >= -1e-4 && b <= 1.0001;

/** OKLCH → sRGB; gama dışındaysa ton ve açıklık korunup doygunluk azaltılır. */
function oklchToRgb(L: number, C: number, h: number): [number, number, number] {
  const cos = Math.cos(h), sin = Math.sin(h);
  let lin = oklabToLinear(L, C * cos, C * sin);
  if (!inGamut(lin)) {
    let lo = 0, hi = C;
    for (let k = 0; k < 14; k++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklabToLinear(L, mid * cos, mid * sin))) lo = mid; else hi = mid;
    }
    lin = oklabToLinear(L, lo * cos, lo * sin);
  }
  return lin.map((v) => Math.round(Math.min(255, Math.max(0, toSrgb(Math.min(1, Math.max(0, v))))))) as [number, number, number];
}

// ─── Açıklık eşlemesi ────────────────────────────────────────────────────────

/** Koyu kumaşta bu açıklığın (OKLab L) altı kumaşla karışır. */
const DARK_THRESHOLD = 0.55;
/** Açık kumaşta bu açıklığın üstü kumaşla karışır. */
const LIGHT_THRESHOLD = 0.72;
/** Bu doygunluğun altı nötr (siyah/beyaz/gri) sayılır. */
const NEUTRAL_CHROMA = 0.035;

/**
 * Bir rengin hedef kumaşa uyarlanmış açıklığı. Değişmeyecekse null.
 * Eşik tarafındaki tonlar eşiğin öbür yanına aynalanır: sıra tersine döner, böylece koyu kontur ile
 * açık dolgu gibi ayrımlar kaybolmaz (kontur açılır, dolgu zaten açık olduğundan yerinde kalır).
 */
export function mapLightness(L: number, C: number, mode: RecolorMode): number | null {
  const colorful = C >= NEUTRAL_CHROMA;
  if (mode === 'dark_garment') {
    if (L >= DARK_THRESHOLD) return null;
    const t = (DARK_THRESHOLD - L) / DARK_THRESHOLD; // 0 (eşikte) … 1 (siyah)
    // Nötrler beyaza kadar açılır; renkli tonlar renkleri görünür kalsın diye en fazla 0.86.
    const ceiling = colorful ? 0.86 : 0.97;
    return DARK_THRESHOLD + 0.06 + t * (ceiling - DARK_THRESHOLD - 0.06);
  }
  if (L <= LIGHT_THRESHOLD) return null;
  const t = (L - LIGHT_THRESHOLD) / (1 - LIGHT_THRESHOLD); // 0 (eşikte) … 1 (beyaz)
  // Nötrler siyaha kadar koyulaşır; renkli tonlar griye dönmesin diye en az 0.42.
  const floor = colorful ? 0.42 : 0.16;
  return LIGHT_THRESHOLD - 0.06 - t * (LIGHT_THRESHOLD - 0.06 - floor);
}

/** Tek bir rengi uyarlar; değişmiyorsa null. */
export function recolorPixel(r: number, g: number, b: number, mode: RecolorMode): [number, number, number] | null {
  const [L, A, B] = rgbToOklab(r, g, b);
  const C = Math.hypot(A, B);
  const target = mapLightness(L, C, mode);
  if (target === null) return null;
  const h = Math.atan2(B, A);
  // Koyu tonlar açılırken doygunluk biraz artırılır (koyu lacivert → canlı mavi); açık tonlar koyulaşırken
  // sabit kalır. Gama sınırı oklchToRgb'de uygulanır.
  const chroma = mode === 'dark_garment' && C >= NEUTRAL_CHROMA ? Math.min(0.32, C * 1.15) : C;
  return oklchToRgb(target, chroma, h);
}

/**
 * Chamfer (3-4) mesafe dönüşümü: her pikselin `isSource` piksellerine yaklaşık uzaklığı (piksel × 3).
 * Görselin dışı kaynak sayılmaz.
 */
function distanceTransform(width: number, height: number, isSource: (p: number) => boolean): Uint16Array {
  const total = width * height;
  const INF = 0xffff;
  const dist = new Uint16Array(total).fill(INF);
  for (let p = 0; p < total; p++) if (isSource(p)) dist[p] = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      let d = dist[p]!;
      if (d === 0) continue;
      if (x > 0) d = Math.min(d, dist[p - 1]! + 3);
      if (y > 0) {
        d = Math.min(d, dist[p - width]! + 3);
        if (x > 0) d = Math.min(d, dist[p - width - 1]! + 4);
        if (x < width - 1) d = Math.min(d, dist[p - width + 1]! + 4);
      }
      dist[p] = d;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x;
      let d = dist[p]!;
      if (d === 0) continue;
      if (x < width - 1) d = Math.min(d, dist[p + 1]! + 3);
      if (y < height - 1) {
        d = Math.min(d, dist[p + width]! + 3);
        if (x < width - 1) d = Math.min(d, dist[p + width + 1]! + 4);
        if (x > 0) d = Math.min(d, dist[p + width - 1]! + 4);
      }
      dist[p] = d;
    }
  }
  return dist;
}

/**
 * Ham RGBA üzerinde yerinde uyarlama (test edilebilir). Yalnızca kumaşta kaybolacak ve kumaşa doğrudan
 * açılan tonlar değişir:
 *  1. Kumaşta kaybolacak pikseller (eşik tarafındaki tonlar) bulunur.
 *  2. Kumaştan (saydam alandan) başlayıp yalnızca bu piksellerin üzerinden ilerleyen bir yayılma yapılır.
 *     Arada kumaşa karşıt bir kontur varsa öğe zaten görünür; yayılma oraya geçmez (konturlu krem dallar,
 *     plaka üzerindeki yazılar korunur).
 *  3. Kalınlığa göre: ince yapılar (kontur, harf, çizgi) kumaştan belirli bir uzaklığa kadar tamamen uyarlanır
 *     — kalın bir alana veya iç çizgilere bağlı olsalar da. Kalın alanlarda (zemin plakası, şapka gibi büyük
 *     koyu bölgeler) yalnızca kumaşa değen kenarda ince, net bir kontur oluşur; içleri olduğu gibi kalır.
 * Saydam alanı olmayan (zemini kaldırılmamış) görselde değişiklik yapılmaz ve -1 döner; aksi halde değişen
 * piksel sayısını döner.
 */
export function adaptToFabric(data: Uint8Array | Buffer, width: number, height: number, mode: RecolorMode): number {
  const total = width * height;
  const size = Math.max(width, height);
  /** Bu yarı kalınlıktan kalın bölgeler "kalın alan" sayılır (harf gövdelerinden kalın); chamfer birimi. */
  const thickHalf = Math.max(5, Math.round(size * 0.016)) * 3;
  /** İnce yapıların kumaştan itibaren uyarlandığı uzaklık (piksel); sonrasında azalarak biter. */
  const reach = Math.max(6, Math.round(size * 0.02));
  const reachFade = Math.round(reach * 1.25);
  /** Kalın alanlarda oluşan kenar konturunun kalınlığı (piksel). */
  const stroke = Math.max(2, Math.round(size * 0.004));

  const transparent = (p: number) => data[p * 4 + 3]! < 40;
  let hasTransparency = false;
  for (let p = 0; p < total; p++) if (transparent(p)) { hasTransparency = true; break; }
  if (!hasTransparency) return -1;

  // Kumaşta kaybolacak pikseller ve uyarlanmış renkleri (renk başına bir kez hesaplanır).
  const cache = new Map<number, number>();
  const mapped = new Int32Array(total).fill(-1);
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    if (data[i + 3]! < 40) continue;
    const key = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
    let packed = cache.get(key);
    if (packed === undefined) {
      const next = recolorPixel(data[i]!, data[i + 1]!, data[i + 2]!, mode);
      packed = next ? (next[0] << 16) | (next[1] << 8) | next[2] : -1;
      cache.set(key, packed);
    }
    mapped[p] = packed;
  }

  // Kalınlık: bölgenin kenarına uzaklık. Çekirdek (yarı kalınlığı eşikten büyük) ve çekirdeğe eşik kadar
  // yakın pikseller kalın alanı oluşturur (morfolojik açma); harfler ve konturlar ince kalır.
  const toEdge = distanceTransform(width, height, (p) => mapped[p]! < 0);
  const toCore = distanceTransform(width, height, (p) => toEdge[p]! > thickHalf);
  const thick = (p: number) => toCore[p]! <= thickHalf;

  // Kumaştan, yalnızca kaybolacak pikseller üzerinden yayılma (adım sayısı = kumaşa yol uzunluğu). Kumaşa
  // kontur kalınlığı kadar yakın pikseller başlangıçtır: kenar yumuşatması veya ince bir hale engel olmaz.
  const toFabric = distanceTransform(width, height, transparent);
  const steps = new Int32Array(total).fill(-1);
  const queue = new Int32Array(total);
  let head = 0, tail = 0;
  for (let p = 0; p < total; p++) {
    if (mapped[p]! >= 0 && toFabric[p]! <= stroke * 3) { steps[p] = 1; queue[tail++] = p; }
  }
  while (head < tail) {
    const p = queue[head++]!;
    const d = steps[p]!;
    // Kalın alanda yalnızca kontur kalınlığı kadar, ince yapılarda erişim uzaklığına kadar ilerlenir.
    if (d >= (thick(p) ? stroke : reachFade)) continue;
    const x = p % width;
    const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width];
    for (const q of neighbours) {
      if (q >= 0 && q < total && mapped[q]! >= 0 && steps[q]! < 0) { steps[q] = d + 1; queue[tail++] = q; }
    }
  }

  let changed = 0;
  for (let p = 0; p < total; p++) {
    const d = steps[p]!;
    if (d < 0) continue;
    const packed = mapped[p]!;
    const w = thick(p)
      ? (d <= stroke ? 1 : 0)
      : Math.min(1, Math.max(0, (reachFade - d) / (reachFade - reach)));
    if (w <= 0) continue;
    const i = p * 4;
    data[i] = Math.round(data[i]! + (((packed >> 16) & 255) - data[i]!) * w);
    data[i + 1] = Math.round(data[i + 1]! + (((packed >> 8) & 255) - data[i + 1]!) * w);
    data[i + 2] = Math.round(data[i + 2]! + ((packed & 255) - data[i + 2]!) * w);
    changed++;
  }
  return changed;
}

/**
 * Tasarımı hedef kumaşa uyarlar.
 * @param mode 'dark_garment': koyu kumaş için (koyu tonlar açılır); 'light_garment': açık kumaş için (açık tonlar koyulaşır)
 */
export async function recolorDesign(input: string | Buffer, mode: RecolorMode): Promise<RecolorResult> {
  const startTime = Date.now();
  const buffer: Buffer = typeof input === 'string' ? Buffer.from(input, 'base64') : input;
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let visible = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]! >= 4) visible++;
  const changed = adaptToFabric(data, info.width, info.height, mode);
  const pngBuffer = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return {
    pngBuffer,
    processingTimeMs: Date.now() - startTime,
    changedRatio: visible > 0 ? Math.max(0, changed) / visible : 0,
    hasTransparency: changed >= 0,
  };
}
