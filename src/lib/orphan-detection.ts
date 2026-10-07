import { parseJsonArray } from '@/lib/json-utils';

/** Yeni yüklenen ama henüz çalışma alanına kaydedilmemiş dosyaları korumak için bekleme süresi. */
export const ORPHAN_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

type WithSrc = { src?: unknown };
type WithPreview = { previewUrl?: unknown };

/** Bir veritabanı satırındaki tüm medya referanslarını (URL/anahtar) toplar. */
export function collectWorkspaceReferences(row: Record<string, unknown>, into: Set<string>): void {
  for (const item of parseJsonArray<WithSrc>(row.mockups)) if (typeof item?.src === 'string') into.add(item.src);
  for (const item of parseJsonArray<WithSrc>(row.designs)) if (typeof item?.src === 'string') into.add(item.src);
  for (const item of parseJsonArray<WithPreview>(row.etsy_generated_mockups)) {
    if (typeof item?.previewUrl === 'string') into.add(item.previewUrl);
  }
}

/**
 * Referans verilmeyen ve bekleme süresinden eski nesneleri döner.
 * Bir anahtar, herhangi bir referans URL'sinin içinde (ham veya URL-kodlu) geçiyorsa korunur.
 */
export function findOrphanKeys(
  objects: Array<{ key: string; lastModified?: Date }>,
  references: Iterable<string>,
  now = Date.now(),
): string[] {
  const haystack = [...references].map((ref) => {
    try {
      return `${ref}\n${decodeURIComponent(ref)}`;
    } catch {
      return ref;
    }
  }).join('\n');

  return objects
    .filter((obj) => obj.key)
    .filter((obj) => !obj.lastModified || now - obj.lastModified.getTime() > ORPHAN_GRACE_PERIOD_MS)
    .filter((obj) => !haystack.includes(obj.key))
    .map((obj) => obj.key);
}
