import { getR2Stats } from '@/lib/r2';

// Bucket'ın tamamını listelemek pahalıdır (1000 nesnede bir istek). Admin paneli her açıldığında
// yeniden listelemek yerine sonuç kısa süre önbelleklenir; temizlik sonrası önbellek boşaltılır.
const TTL_MS = 10 * 60 * 1000;
let cached: { at: number; value: { totalBytes: number; objectCount: number } } | null = null;

export async function getCachedR2Stats(options: { fresh?: boolean; now?: number } = {}) {
  const now = options.now ?? Date.now();
  if (!options.fresh && cached && now - cached.at < TTL_MS) return { ...cached.value, cachedAt: cached.at };
  const value = await getR2Stats();
  cached = { at: now, value: { totalBytes: value.totalBytes, objectCount: value.objectCount } };
  return { ...cached.value, cachedAt: now };
}

export function invalidateR2StatsCache() {
  cached = null;
}
