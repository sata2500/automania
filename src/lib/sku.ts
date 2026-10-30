/**
 * İlan SKU'su: siparişte görünen kısa, okunur ve benzersiz kod. Tasarım bu kodla adlandırılır; sipariş
 * geldiğinde Tasarımlar sekmesinde SKU ile aranıp bulunur. Biçim: ÜRÜN-YYAAGG-XXXX (ör. TSH-261029-K7QD).
 * Son dört karakter karışması kolay harfler (I, L, O, U) ve rakamlar (0, 1) olmadan rastgeledir.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

const PRODUCT_PREFIXES: Array<[RegExp, string]> = [
  [/hoodie|kapüşon/i, 'HOD'],
  [/sweat/i, 'SWT'],
  [/tank|atlet/i, 'TNK'],
  [/long ?sleeve|uzun kollu/i, 'LSL'],
  [/kid|youth|toddler|baby|onesie|çocuk|bebek/i, 'KID'],
  [/mug|kupa|bardak/i, 'MUG'],
  [/tote|çanta/i, 'TOT'],
  [/poster|print|tablo/i, 'PRT'],
  [/sticker|çıkartma/i, 'STK'],
  [/hat|cap|şapka/i, 'HAT'],
  [/shirt|tee|tişört|tshirt/i, 'TSH'],
];

/** Etsy kategori adından ürün tipi ("T-shirts" → "T-shirt", "Hoodies & Sweatshirts" olduğu gibi). */
export function productTypeFromCategory(name: string | null | undefined): string {
  const clean = (name || '').trim();
  return clean.endsWith('s') && !clean.endsWith('ss') && !clean.includes('&') ? clean.slice(0, -1) : clean || 'T-shirt';
}

export function skuPrefix(productType: string | null | undefined): string {
  const text = productType ?? '';
  return PRODUCT_PREFIXES.find(([pattern]) => pattern.test(text))?.[1] ?? 'POD';
}

export function generateListingSku(productType?: string | null, now = new Date(), random: () => number = Math.random): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${pad(now.getFullYear() % 100)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `${skuPrefix(productType)}-${date}-${suffix}`;
}

/** Etsy SKU sınırı (32 karakter) ve izin verilen karakterler. */
export function sanitizeSku(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9._-]/g, '').slice(0, 32);
}
