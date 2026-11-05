/**
 * Görsellerin küçük önizlemeleri (saf modül; istemci ve sunucuda). Tasarımlar 16 MB'a kadar çıkabildiği için
 * ızgaralarda, listelerde ve küçük kartlarda özgün dosya yerine sunucunun ürettiği küçük WebP kullanılır:
 * `/api/r2/<anahtar>?w=512`. Önizleme ilk istekte üretilir ve R2'de `<anahtar>.w512.webp` olarak saklanır;
 * özgün dosya olduğu gibi kalır (indirme, üretim ve Etsy'ye gönderim özgünüyle yapılır).
 */
/** 256/512/1024: ızgara ve kartlar; 2048: mockup üretimi (baskı alanı 2048 pikseli aşmaz). */
export const PREVIEW_WIDTHS = [256, 512, 1024, 2048] as const;
export type PreviewWidth = (typeof PREVIEW_WIDTHS)[number];

const PREVIEW_SUFFIX = /\.w(256|512|1024|2048)\.webp$/;
const IMAGE_KEY = /\.(png|jpe?g|webp)$/i;

/** Uygulamanın depoladığı bir görselin önizleme adresi; başka adresler (misafir blob/data, harici) olduğu gibi döner. */
export function previewSrc(src: string | null | undefined, width: PreviewWidth): string {
  if (!src) return '';
  if (!/^\/api\/r2\//.test(src) || src.includes('?') || !IMAGE_KEY.test(src)) return src;
  return `${src}?w=${width}`;
}

/** İstekteki `w` değeri izin verilen bir önizleme genişliği mi? */
export function parsePreviewWidth(value: string | null): PreviewWidth | null {
  const width = Number(value);
  return (PREVIEW_WIDTHS as readonly number[]).includes(width) ? (width as PreviewWidth) : null;
}

export function previewKey(key: string, width: PreviewWidth): string {
  return `${key}.w${width}.webp`;
}

export function isPreviewKey(key: string): boolean {
  return PREVIEW_SUFFIX.test(key);
}

/** Önizleme anahtarının özgün dosyası (önizleme değilse null). */
export function sourceKeyOfPreview(key: string): string | null {
  return isPreviewKey(key) ? key.replace(PREVIEW_SUFFIX, '') : null;
}

/** Bir görselin olası tüm önizleme anahtarları (dosya silinirken önizlemeleri de silinsin diye). */
export function previewKeysFor(key: string): string[] {
  return IMAGE_KEY.test(key) && !isPreviewKey(key) ? PREVIEW_WIDTHS.map((w) => previewKey(key, w)) : [];
}
