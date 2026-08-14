/**
 * Trademark & IP Safety Shield for Print-on-Demand (POD)
 * Protects Etsy shops from automated IP strikes, takedowns, and account suspensions.
 * Specifically targets high-risk trademarks in Class 025 (Apparel) and Class 021 (Home & Giftware).
 */

// Comprehensive dictionary of high-risk brands, franchises, and trademarked terms
export const HIGH_RISK_TRADEMARKS: { term: string; safeAlternative?: string; category: string }[] = [
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
  { term: 'peanuts', category: 'Entertainment' },
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
  { term: 'vans', category: 'Fashion' },
  { term: 'converse', category: 'Fashion' },
  { term: 'champion', category: 'Fashion' },
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
  { term: 'yeti', safeAlternative: 'stainless tumbler', category: 'Generic Trap' },
  { term: 'crock-pot', safeAlternative: 'slow cooker', category: 'Generic Trap' },
  { term: 'crock pot', safeAlternative: 'slow cooker', category: 'Generic Trap' },
  { term: 'jacuzzi', safeAlternative: 'hot tub', category: 'Generic Trap' },
  { term: 'styrofoam', safeAlternative: 'foam packing', category: 'Generic Trap' },
  { term: 'popsocket', safeAlternative: 'phone grip', category: 'Generic Trap' },
  { term: 'frisbee', safeAlternative: 'flying disc', category: 'Generic Trap' },
];

/**
 * Check if a single string or tag contains any high-risk trademark
 */
export function isTrademarkViolator(input: string): { isViolator: boolean; matchedTerm?: string; category?: string } {
  if (!input || typeof input !== 'string') return { isViolator: false };
  const normalized = input.toLowerCase().trim();

  for (const entry of HIGH_RISK_TRADEMARKS) {
    const escaped = entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\b|\\s|_|-)${escaped}(\\b|\\s|_|-|$)`, 'i');
    if (regex.test(normalized)) {
      return { isViolator: true, matchedTerm: entry.term, category: entry.category };
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

  for (const entry of HIGH_RISK_TRADEMARKS) {
    const escaped = entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    if (regex.test(sanitized)) {
      violations.push(entry.term);
      if (entry.safeAlternative) {
        sanitized = sanitized.replace(regex, entry.safeAlternative);
      } else {
        sanitized = sanitized.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
      }
    }
  }

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
