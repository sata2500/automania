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

/**
 * Prompt'taki eski arka plan/perde satırlarını (ör. admin şablonundaki "background MUST be #00FF00")
 * çıkarır; perde rengi ve kompozisyon talimatı `keyBackgroundInstructions` ile tek yerden eklenir.
 */
export function stripBackgroundRules(prompt: string): string {
  return prompt
    .split('\n')
    .filter((line) => !/#00ff00|#ff00ff|chroma[\s-]?key|green[\s-]?screen|green background|background must be/i.test(line))
    .join('\n');
}

/** Görsel modeline eklenecek kompozisyon ve perde talimatları (kare, ortalı, temiz kenarlı, düz perde). */
export function keyBackgroundInstructions(key: KeyBackground): string {
  const color = KEY_COLORS[key];
  const avoid = key === 'green'
    ? 'Do not use bright or neon green anywhere in the design; draw any foliage or green elements in dark forest green, olive or teal.'
    : 'Do not use magenta, hot pink or bright purple anywhere in the design; draw any pink or purple elements in deep burgundy, coral or soft lavender.';
  return [
    'COMPOSITION: a single standalone t-shirt graphic on a square canvas, centered horizontally and vertically, covering about 85-90% of the canvas width with equal empty margins on all four sides. Nothing touches or is cut off by the canvas edges.',
    `BACKGROUND: one flat, uniform ${color.name} (${color.hex}) fill covering the entire canvas edge to edge, with no gradient, texture, noise, shadow, vignette, border or frame.`,
    avoid,
    'EDGES: the outer silhouette has crisp, clean edges with a solid outline, so it separates sharply from the background. No glow, haze, smoke, drop shadow or soft spray touching the background, and no stray specks around the design.',
  ].join('\n');
}
