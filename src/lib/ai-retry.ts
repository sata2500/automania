/**
 * Yapay zekâ servislerinin geçici hataları (429 kapasite doldu, 503 yoğunluk) için yeniden deneme.
 * Google'ın önerisi: artan aralıklarla (exponential backoff) yeniden denemek.
 * https://docs.cloud.google.com/vertex-ai/generative-ai/docs/error-code-429
 */

const RETRYABLE = /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|try again later|rate limit/i;

export function isRetryableAiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const status = (error as { status?: unknown; code?: unknown } | null)?.status ?? (error as { code?: unknown } | null)?.code;
  return status === 429 || status === 503 || RETRYABLE.test(message);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `fn`'i geçici hatalarda bekleyerek yeniden dener (varsayılan 4, 10, 25 sn; %20 rastgele sapma).
 * Kalıcı hatalar (geçersiz istek, yetki vb.) hemen fırlatılır.
 */
export async function withAiRetry<T>(
  fn: () => Promise<T>,
  options: { label?: string; delaysMs?: number[]; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const delays = options.delaysMs ?? [4_000, 10_000, 25_000];
  const wait = options.sleep ?? sleep;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= delays.length || !isRetryableAiError(error)) throw error;
      const delay = Math.round(delays[attempt]! * (0.8 + Math.random() * 0.4));
      console.warn(`[AI] ${options.label ?? 'request'} busy; retrying in ${delay} ms (attempt ${attempt + 2}/${delays.length + 1}).`);
      await wait(delay);
    }
  }
}

/** Kullanıcıya gösterilecek hata metni: geçici kapasite hatalarını Türkçe ve anlaşılır yazar. */
export function describeAiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? 'Bilinmeyen hata');
  if (isRetryableAiError(error)) {
    return 'Google yapay zekâ servisi şu anda yoğun (kapasite doldu, hata 429/503). Sistem birkaç kez bekleyip yeniden denedi ama yanıt alamadı. Birkaç dakika sonra yeniden deneyin.';
  }
  return message;
}
