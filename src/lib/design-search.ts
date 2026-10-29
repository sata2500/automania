import type { DesignItem } from '@/types/pod';

const normalize = (value: string) => value.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

/**
 * Tasarım araması: ad, SKU'lar, etiketler ve AI analizinin anahtar kelimeleri içinde aranır. Boşlukla
 * ayrılan her sözcük bulunmalıdır; büyük/küçük harf ve Türkçe karakter farkı gözetilmez.
 * SKU'lar tire veya boşluk olmadan da bulunur ("tsh261029" → "TSH-261029-K7QD").
 */
export function matchesDesignQuery(design: DesignItem, query: string): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalize([
    design.name,
    ...(design.skus ?? []),
    ...(design.skus ?? []).map((sku) => sku.replace(/[-_.]/g, '')),
    ...(design.tags ?? []),
    ...(design.analysis?.keywords ?? []),
  ].join(' '));
  return terms.every((term) => haystack.includes(term));
}
