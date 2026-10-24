import type { EtsyReturnPolicy } from '@/types/etsy';

/** Etsy iade politikaları başlık içermez; seçim listesi için okunabilir bir etiket üretir. */
export function formatReturnPolicy(policy: EtsyReturnPolicy): string {
  const parts: string[] = [];
  if (policy.accepts_returns) parts.push('İade');
  if (policy.accepts_exchanges) parts.push('Değişim');
  const label = parts.length > 0 ? `${parts.join(' + ')} kabul` : 'İade/değişim yok';
  const deadline = policy.return_deadline ? ` · ${policy.return_deadline} gün` : '';
  return `${label}${deadline} (ID: ${policy.return_policy_id})`;
}

/** Etsy etiket kuralı: en fazla 20 karakter; yalnızca harf, rakam, boşluk ve - ' ™ © ® karakterleri. */
export const MAX_ETSY_TAGS = 13;
export const MAX_ETSY_TAG_CHARS = 20;
const DISALLOWED_TAG_CHARS = /[^\p{L}\p{N}\s\-'™©®]/gu;

/** Tek bir etiketi Etsy'nin kabul edeceği hale getirir (geçersizse boş string). */
export function sanitizeEtsyTag(tag: unknown): string {
  if (typeof tag !== 'string') return '';
  const cleaned = tag.replace(DISALLOWED_TAG_CHARS, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length <= MAX_ETSY_TAG_CHARS ? cleaned : '';
}

/** Etiket listesini temizler, büyük/küçük harf duyarsız tekrarları ve fazlasını atar. */
export function sanitizeEtsyTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = sanitizeEtsyTag(raw);
    const key = tag.toLocaleLowerCase('en-US');
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= MAX_ETSY_TAGS) break;
  }
  return result;
}
