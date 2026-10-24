/**
 * Trademark & IP Safety Shield for Print-on-Demand (POD)
 * Protects Etsy shops from automated IP strikes, takedowns, and account suspensions.
 * Specifically targets high-risk trademarks in Class 025 (Apparel) and Class 021 (Home & Giftware).
 */

// Comprehensive dictionary of high-risk brands, franchises, and trademarked terms
export type TrademarkEntry = {
  term: string;
  safeAlternative?: string;
  category: string;
  /**
   * Genel anlamı da olan kelimeler (ör. "world champion dad", "camper vans") yalnızca bu bağlam
   * kelimelerinden biriyle birlikte geçtiğinde marka riski sayılır.
   */
  onlyWith?: string[];
};

export const HIGH_RISK_TRADEMARKS: TrademarkEntry[] = [
  // Major Entertainment & Characters
  { term: 'disney', category: 'Entertainment' },
  { term: 'mickey mouse', category: 'Entertainment' },
  { term: 'minnie mouse', category: 'Entertainment' },
  { term: 'donald duck', category: 'Entertainment' },
  { term: 'pooh', category: 'Entertainment' },
  { term: 'winnie the pooh', category: 'Entertainment' },
  { term: 'marvel', category: 'Entertainment' },
  { term: 'avengers', category: 'Entertainment' },
  { term: 'spiderman', category: 'Entertainment' },
  { term: 'spider-man', category: 'Entertainment' },
  { term: 'iron man', category: 'Entertainment' },
  { term: 'captain america', category: 'Entertainment' },
  { term: 'deadpool', category: 'Entertainment' },
  { term: 'star wars', category: 'Entertainment' },
  { term: 'baby yoda', safeAlternative: 'green alien', category: 'Entertainment' },
  { term: 'mandalorian', category: 'Entertainment' },
  { term: 'darth vader', category: 'Entertainment' },
  { term: 'harry potter', category: 'Entertainment' },
  { term: 'hogwarts', category: 'Entertainment' },
  { term: 'gryffindor', category: 'Entertainment' },
  { term: 'slytherin', category: 'Entertainment' },
  { term: 'ravenclaw', category: 'Entertainment' },
  { term: 'hufflepuff', category: 'Entertainment' },
  { term: 'pokemon', category: 'Entertainment' },
  { term: 'pikachu', category: 'Entertainment' },
  { term: 'barbie', category: 'Entertainment' },
  { term: 'hello kitty', category: 'Entertainment' },
  { term: 'sanrio', category: 'Entertainment' },
  { term: 'peanuts', category: 'Entertainment', onlyWith: ['snoopy', 'charlie brown', 'woodstock', 'comic', 'gang', 'linus', 'lucy'] },
  { term: 'snoopy', category: 'Entertainment' },
  { term: 'grinch', safeAlternative: 'holiday monster', category: 'Entertainment' },
  { term: 'dr seuss', category: 'Entertainment' },
  { term: 'bluey', category: 'Entertainment' },

  // Celebrities & Pop Culture Icons
  { term: 'taylor swift', category: 'Celebrity' },
  { term: 'swiftie', category: 'Celebrity' },
  { term: 'eras tour', category: 'Celebrity' },
  { term: 'beyonce', category: 'Celebrity' },
  { term: 'renaissance tour', category: 'Celebrity' },

  // Sports Leagues & Events
  { term: 'super bowl', safeAlternative: 'big game', category: 'Sports' },
  { term: 'superbowl', safeAlternative: 'big game', category: 'Sports' },
  { term: 'nfl', category: 'Sports' },
  { term: 'nba', category: 'Sports' },
  { term: 'mlb', category: 'Sports' },
  { term: 'nhl', category: 'Sports' },
  { term: 'fifa', category: 'Sports' },
  { term: 'olympics', category: 'Sports' },
  { term: 'olympic', category: 'Sports' },
  { term: 'world cup', category: 'Sports' },
  { term: 'ncaa', category: 'Sports' },
  { term: 'march madness', category: 'Sports' },

  // Fashion & Apparel Brands
  { term: 'nike', category: 'Fashion' },
  { term: 'just do it', category: 'Fashion' },
  { term: 'adidas', category: 'Fashion' },
  { term: 'lululemon', category: 'Fashion' },
  { term: 'gucci', category: 'Fashion' },
  { term: 'chanel', category: 'Fashion' },
  { term: 'louis vuitton', category: 'Fashion' },
  { term: 'prada', category: 'Fashion' },
  { term: 'carhartt', category: 'Fashion' },
  { term: 'patagonia', category: 'Fashion' },
  { term: 'north face', category: 'Fashion' },
  { term: 'the north face', category: 'Fashion' },
  { term: 'vans', category: 'Fashion', onlyWith: ['shoe', 'shoes', 'sneaker', 'sneakers', 'skate', 'off the wall', 'checkerboard'] },
  { term: 'converse', category: 'Fashion', onlyWith: ['shoe', 'shoes', 'sneaker', 'sneakers', 'chuck', 'all star', 'high top'] },
  { term: 'champion', category: 'Fashion', onlyWith: ['hoodie', 'sweatshirt', 'brand', 'logo', 'reverse weave', 'athletic wear'] },
  { term: 'comfort colors', safeAlternative: 'vintage garment dyed', category: 'Fashion' },
  { term: 'bella canvas', safeAlternative: 'premium cotton', category: 'Fashion' },
  { term: 'gildan', safeAlternative: 'heavyweight cotton', category: 'Fashion' },

  // Trademarked Generic Traps (High Danger on Etsy)
  { term: 'onesie', safeAlternative: 'infant bodysuit', category: 'Generic Trap' },
  { term: 'onesies', safeAlternative: 'infant bodysuits', category: 'Generic Trap' },
  { term: 'velcro', safeAlternative: 'hook and loop', category: 'Generic Trap' },
  { term: 'bubble wrap', safeAlternative: 'cushioned wrap', category: 'Generic Trap' },
  { term: 'band-aid', safeAlternative: 'adhesive bandage', category: 'Generic Trap' },
  { term: 'band aid', safeAlternative: 'adhesive bandage', category: 'Generic Trap' },
  { term: 'chapstick', safeAlternative: 'lip balm', category: 'Generic Trap' },
  { term: 'stanley cup', safeAlternative: '40oz tumbler', category: 'Generic Trap' },
  { term: 'stanley tumbler', safeAlternative: 'insulated tumbler', category: 'Generic Trap' },
  { term: 'yeti', safeAlternative: 'stainless tumbler', category: 'Generic Trap', onlyWith: ['tumbler', 'cooler', 'rambler', 'mug', 'cup', 'bottle'] },
  { term: 'crock-pot', safeAlternative: 'slow cooker', category: 'Generic Trap' },
  { term: 'crock pot', safeAlternative: 'slow cooker', category: 'Generic Trap' },
  { term: 'jacuzzi', safeAlternative: 'hot tub', category: 'Generic Trap' },
  { term: 'styrofoam', safeAlternative: 'foam packing', category: 'Generic Trap' },
  { term: 'popsocket', safeAlternative: 'phone grip', category: 'Generic Trap' },
  { term: 'frisbee', safeAlternative: 'flying disc', category: 'Generic Trap' },
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Regex'ler modül yüklenirken bir kez derlenir. Uzun terimler önce denenir: "winnie the pooh",
 * "pooh"dan önce temizlenmezse metinde "winnie the" artığı kalır.
 */
const COMPILED_TRADEMARKS = [...HIGH_RISK_TRADEMARKS]
  .sort((a, b) => b.term.length - a.term.length)
  .map((entry) => ({
    entry,
    test: new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(entry.term)}(?=$|[^\\p{L}\\p{N}])`, 'iu'),
    replace: new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(entry.term)}(?=$|[^\\p{L}\\p{N}])`, 'giu'),
    context: entry.onlyWith?.map((word) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(word)}(?=$|[^\\p{L}\\p{N}])`, 'iu')),
  }));

function hasRequiredContext(compiled: (typeof COMPILED_TRADEMARKS)[number], text: string): boolean {
  return !compiled.context || compiled.context.some((pattern) => pattern.test(text));
}

/**
 * Check if a single string or tag contains any high-risk trademark
 */
export function isTrademarkViolator(input: string): { isViolator: boolean; matchedTerm?: string; category?: string } {
  if (!input || typeof input !== 'string') return { isViolator: false };
  const normalized = input.toLowerCase().trim();

  for (const compiled of COMPILED_TRADEMARKS) {
    if (compiled.test.test(normalized) && hasRequiredContext(compiled, normalized)) {
      return { isViolator: true, matchedTerm: compiled.entry.term, category: compiled.entry.category };
    }
  }
  return { isViolator: false };
}

/**
 * Filter an array of candidate keywords, removing trademark violations
 */
export function filterSafeKeywords(keywords: string[]): { safe: string[]; removed: { keyword: string; matchedTerm: string; category: string }[] } {
  const safe: string[] = [];
  const removed: { keyword: string; matchedTerm: string; category: string }[] = [];

  for (const kw of keywords) {
    const check = isTrademarkViolator(kw);
    if (check.isViolator && check.matchedTerm) {
      removed.push({ keyword: kw, matchedTerm: check.matchedTerm, category: check.category || 'Trademark' });
    } else {
      safe.push(kw);
    }
  }

  return { safe, removed };
}

/**
 * Sanitize text (Title, Description, or Tags) by removing or replacing trademarked words
 */
export function sanitizeTrademarkText(text: string): { cleanText: string; violations: string[] } {
  if (!text) return { cleanText: '', violations: [] };
  let sanitized = text;
  const violations: string[] = [];

  for (const compiled of COMPILED_TRADEMARKS) {
    if (!compiled.test.test(sanitized) || !hasRequiredContext(compiled, sanitized)) continue;
    violations.push(compiled.entry.term);
    const replacement = compiled.entry.safeAlternative ?? '';
    sanitized = sanitized.replace(compiled.replace, (_match, prefix: string) => `${prefix}${replacement}`);
  }

  sanitized = sanitized.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.!?;:])/g, '$1').trim();
  return { cleanText: sanitized, violations };
}

/**
 * Clean and validate an array of Etsy tags against trademark violations and 20-character rule
 */
export function sanitizeEtsyTags(tags: string[]): { cleanTags: string[]; violationsFound: string[] } {
  const cleanTags: string[] = [];
  const violationsFound: string[] = [];

  for (const tag of tags) {
    const check = isTrademarkViolator(tag);
    if (check.isViolator && check.matchedTerm) {
      violationsFound.push(`${tag} (${check.matchedTerm})`);
      const matchingEntry = HIGH_RISK_TRADEMARKS.find((t) => t.term === check.matchedTerm);
      if (matchingEntry?.safeAlternative && matchingEntry.safeAlternative.length <= 20) {
        cleanTags.push(matchingEntry.safeAlternative);
      }
    } else {
      const trimmed = tag.trim().slice(0, 20);
      if (trimmed.length > 0) {
        cleanTags.push(trimmed);
      }
    }
  }

  return { cleanTags: Array.from(new Set(cleanTags)), violationsFound };
}
