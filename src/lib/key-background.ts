/**
 * Perde (chroma key) arka planı: görsel modelleri gerçek saydamlık üretemediği için tasarım düz bir
 * perde rengi üzerinde üretilir, perde sonradan `chroma-key` ile kaldırılır.
 *
 * Perde rengi tasarımda geçmeyecek bir renk olmalıdır. Varsayılan saf yeşil; yeşil ağırlıklı
 * konularda (Noel, orman, St. Patrick…) tasarımın yeşilleri perdeyle karışmasın diye magenta.
 */

export type KeyBackground = 'green' | 'magenta';

export const KEY_COLORS: Record<KeyBackground, { r: number; g: number; b: number; hex: string; name: string }> = {
  green: { r: 0, g: 255, b: 0, hex: '#00FF00', name: 'pure chroma-key green' },
  magenta: { r: 255, g: 0, b: 255, hex: '#FF00FF', name: 'pure magenta' },
};

const GREEN_THEMES = [
  'christmas', 'xmas', 'grinch', 'elf', 'holiday tree', 'pine', 'forest', 'woods', 'sequoia', 'redwood', 'tree', 'jungle',
  'leaf', 'leaves', 'foliage', 'fern', 'plant', 'garden', 'botanical', 'succulent', 'cactus', 'houseplant', 'moss',
  'st patrick', 'st. patrick', 'saint patrick', 'irish', 'shamrock', 'clover', 'leprechaun',
  'camping', 'hiking', 'outdoors', 'nature', 'national park', 'mountain', 'wilderness', 'eco', 'earth day',
  'frog', 'turtle', 'dinosaur', 'alien', 'zombie', 'money', 'dollar', 'golf', 'cannabis', 'weed', 'matcha', 'avocado', 'lime',
  'noel', 'çam', 'orman', 'ağaç', 'yaprak', 'bitki', 'doğa', 'kamp',
];

/** Tasarım konusuna göre perde rengi seçer: yeşil ağırlıklı konularda magenta, diğerlerinde yeşil. */
export function pickKeyBackground(text: string | null | undefined): KeyBackground {
  const lower = (text ?? '').toLocaleLowerCase('en');
  return GREEN_THEMES.some((word) => new RegExp(`(^|[^a-zğüşıöç])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(lower))
    ? 'magenta'
    : 'green';
}

/** "Tasarım tuvali ve arka plan" talimatındaki perde rengi değişkenleri. */
export function keyColorPromptValues(key: KeyBackground): Record<string, string> {
  const color = KEY_COLORS[key];
  return { keyColorName: color.name, keyColorHex: color.hex };
}
