/**
 * Etsy Open API v3 çağrıları için ortak yardımcılar:
 * hız sınırı (429) ve geçici sunucu hatalarında bekleyip yeniden deneme,
 * Etsy hata gövdesinden okunur mesaj çıkarma.
 */

export interface EtsyFetchOptions {
  /** Yeniden deneme sayısı (ilk deneme hariç). */
  retries?: number;
  /** Tek bir bekleme için üst sınır (ms). */
  maxWaitMs?: number;
  /** Test için enjekte edilebilir bekleme fonksiyonu. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Yeniden denenebilir durum kodları: hız sınırı ve geçici sunucu hataları. */
export function isRetryableEtsyStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/** Retry-After başlığından (saniye ya da HTTP tarihi) bekleme süresi; yoksa üstel geri çekilme. */
export function retryDelayMs(res: Pick<Response, 'headers'>, attempt: number, maxWaitMs: number): number {
  const header = res.headers.get('retry-after');
  let delay = 500 * 2 ** attempt;
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) {
      delay = seconds * 1000;
    } else {
      const date = Date.parse(header);
      if (Number.isFinite(date)) delay = date - Date.now();
    }
  }
  return Math.min(Math.max(delay, 250), maxWaitMs);
}

/**
 * fetch sarmalayıcı: 429/502/503/504 yanıtlarında Retry-After'a uyarak yeniden dener.
 * Son yanıt (başarılı ya da değil) çağırana döner; ağ hataları da aynı şekilde yeniden denenir.
 */
export async function etsyFetch(url: string, init: RequestInit = {}, options: EtsyFetchOptions = {}): Promise<Response> {
  const { retries = 3, maxWaitMs = 8000, sleep = defaultSleep } = options;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!isRetryableEtsyStatus(res.status) || attempt >= retries) return res;
      await sleep(retryDelayMs(res, attempt, maxWaitMs));
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(Math.min(500 * 2 ** attempt, maxWaitMs));
    }
  }
}

/** Etsy hata yanıtından kullanıcıya gösterilebilir kısa mesaj üretir. */
export async function readEtsyError(res: Response, context: string): Promise<string> {
  let detail = '';
  try {
    const text = await res.text();
    try {
      const body = JSON.parse(text) as { error?: unknown; error_description?: unknown; message?: unknown };
      const candidate = body.error_description ?? body.error ?? body.message;
      detail = typeof candidate === 'string' ? candidate : '';
    } catch {
      detail = text;
    }
  } catch {
    detail = '';
  }
  detail = detail.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (res.status === 429) {
    return `${context}: Etsy istek sınırına ulaşıldı. Lütfen birkaç dakika sonra tekrar deneyin.`;
  }
  return detail ? `${context} (HTTP ${res.status}): ${detail}` : `${context} (HTTP ${res.status}).`;
}

/**
 * Senkronda Etsy'den dönmeyen ilanlardan hangilerinin "kaldırıldı" sayılacağını belirler.
 * Yalnızca tüm durumlar eksiksiz çekildiyse karar verilir; tek bir sayfa bile eksikse hiçbir ilan işaretlenmez.
 */
export function listingsToMarkRemoved(
  existing: Iterable<[string, { state?: unknown }]>,
  returnedIds: Set<string>,
  allStatesComplete: boolean,
): string[] {
  if (!allStatesComplete) return [];
  const removed: string[] = [];
  for (const [listingId, row] of existing) {
    if (!returnedIds.has(listingId) && row.state !== 'removed') removed.push(listingId);
  }
  return removed;
}
