/**
 * Dynamic Seasonality & Trend Multiplier for Etsy SEO
 * Automatically identifies active shopping seasons based on the calendar
 * and boosts relevant long-tail Opportunity Scores and contextualizes AI prompts.
 */

export interface SeasonInfo {
  seasonKey: string;
  seasonName: string;
  activeThemes: string[];
  promptGuidance: string;
  bonusRules: { keywords: string[]; bonus: number; reason: string }[];
}

export function getCurrentSeasonInfo(customDate?: Date): SeasonInfo {
  const now = customDate || new Date();
  const month = now.getMonth(); // 0-indexed (0 = Jan, 7 = Aug, 9 = Oct, 11 = Dec)
  const day = now.getDate();

  // 1. Q4 Holiday Peak (Nov 1 - Dec 31)
  if (month === 10 || month === 11) {
    return {
      seasonKey: 'q4_holiday',
      seasonName: 'Q4 Holiday & Christmas Peak Shopping Season',
      activeThemes: ['Christmas Gifts', 'Holiday Apparel', 'Stocking Stuffers', 'Family Gathering', 'Winter Aesthetic'],
      promptGuidance:
        'ACTIVE SEASON: Q4 Christmas & Holiday Peak. If the design allows or has gift appeal, strategically weave in holiday gift-giving angles (e.g. Christmas gift, stocking stuffer, holiday present) while preserving the exact design subject.',
      bonusRules: [
        { keywords: ['christmas', 'xmas', 'holiday', 'stocking stuffer', 'secret santa'], bonus: 20, reason: 'Q4 Christmas Peak' },
        { keywords: ['gift for her', 'gift for him', 'gift for mom', 'birthday gift', 'best friend gift'], bonus: 15, reason: 'Q4 High Gift Demand' },
        { keywords: ['winter', 'cozy', 'holiday sweater', 'festive'], bonus: 12, reason: 'Winter Holiday' },
      ],
    };
  }

  // 2. Fall & Halloween Peak (Aug 1 - Oct 31)
  if (month === 7 || month === 8 || month === 9) {
    return {
      seasonKey: 'fall_halloween',
      seasonName: 'Fall, Spooky Season & Halloween Ramp-up',
      activeThemes: ['Autumn / Fall', 'Halloween & Spooky', 'Thanksgiving', 'Cozy Season', 'Pumpkin / Harvest'],
      promptGuidance:
        'ACTIVE SEASON: Autumn, Fall & Halloween Season. If the design has autumnal, spooky, cozy, or nature themes, emphasize fall vibes, pumpkin season, or cozy aesthetic.',
      bonusRules: [
        { keywords: ['halloween', 'spooky', 'ghost', 'witchy', 'pumpkin'], bonus: 20, reason: 'Halloween Season' },
        { keywords: ['fall', 'autumn', 'cozy season', 'fall vibes', 'sweater weather'], bonus: 16, reason: 'Autumn Aesthetic' },
        { keywords: ['thanksgiving', 'harvest', 'gratitude'], bonus: 12, reason: 'Fall Harvest' },
      ],
    };
  }

  // 3. Mother's Day, Easter & Spring (Feb 15 - May 15)
  if ((month === 1 && day >= 15) || month === 2 || month === 3 || (month === 4 && day <= 15)) {
    return {
      seasonKey: 'spring_mothers_day',
      seasonName: "Spring, Easter & Mother's Day Shopping Wave",
      activeThemes: ["Mother's Day", 'Spring Floral', 'Gardening & Nature', 'Easter', 'Teacher Appreciation'],
      promptGuidance:
        "ACTIVE SEASON: Spring & Mother's Day Wave. If the design relates to flowers, gardening, animals, moms, or pastel aesthetics, highlight spring rejuvenation and Mother's Day gift potential.",
      bonusRules: [
        { keywords: ['mother day', 'mothers day', 'mom gift', 'plant mom', 'dog mom'], bonus: 20, reason: "Mother's Day Gift" },
        { keywords: ['spring', 'wildflower', 'botanical', 'floral', 'gardening'], bonus: 16, reason: 'Spring Nature Trend' },
        { keywords: ['easter', 'bunny', 'springtime'], bonus: 15, reason: 'Easter / Spring' },
      ],
    };
  }

  // 4. Summer, Father's Day & Vacation (May 16 - Jul 31)
  if ((month === 4 && day > 15) || month === 5 || month === 6) {
    return {
      seasonKey: 'summer_vacation',
      seasonName: "Summer, Father's Day & Outdoor Vacation Season",
      activeThemes: ['Summer Vacation', 'Beach & Lake', "Father's Day", 'Camping & Outdoor', '4th of July'],
      promptGuidance:
        "ACTIVE SEASON: Summer Vacation & Outdoor Adventure. Highlight summer vibes, vacation apparel, outdoor leisure, or Father's Day gift appeal if appropriate.",
      bonusRules: [
        { keywords: ['father day', 'fathers day', 'dad gift', 'papa shirt'], bonus: 20, reason: "Father's Day Gift" },
        { keywords: ['summer', 'beach', 'lake life', 'vacation', 'camp', 'hiking'], bonus: 15, reason: 'Summer Outdoor' },
        { keywords: ['4th of july', 'patriotic', 'memorial day'], bonus: 14, reason: 'Summer Holidays' },
      ],
    };
  }

  // 5. Default / New Year & Valentine's (Jan 1 - Feb 14)
  return {
    seasonKey: 'winter_valentines',
    seasonName: "New Year Goals & Valentine's Day Shopping Season",
    activeThemes: ["Valentine's Day", 'Self Care & Mindset', 'Cozy Winter', 'Love & Couples'],
    promptGuidance:
      "ACTIVE SEASON: New Year & Valentine's Season. Highlight self-care, love, romantic gifts, girlfriend/boyfriend gifts, or motivational mindset themes.",
    bonusRules: [
      { keywords: ['valentine', 'love', 'couple gift', 'girlfriend gift', 'boyfriend gift'], bonus: 20, reason: "Valentine's Day" },
      { keywords: ['self care', 'growth mindset', 'mental health', 'positive vibes'], bonus: 14, reason: 'New Year Self-Improvement' },
      { keywords: ['winter', 'cozy vibes'], bonus: 10, reason: 'Winter Season' },
    ],
  };
}

/**
 * Apply seasonal bonus to a keyword's base Opportunity Score
 */
export function applySeasonalBonus(
  keyword: string,
  baseScore: number,
  customDate?: Date
): { finalScore: number; bonusApplied: number; seasonReason?: string } {
  if (!keyword || baseScore === undefined || baseScore === null) {
    return { finalScore: baseScore || 0, bonusApplied: 0 };
  }

  const season = getCurrentSeasonInfo(customDate);
  const normalized = keyword.toLowerCase().trim();

  let maxBonus = 0;
  let reason: string | undefined = undefined;

  for (const rule of season.bonusRules) {
    for (const pattern of rule.keywords) {
      if (normalized.includes(pattern)) {
        if (rule.bonus > maxBonus) {
          maxBonus = rule.bonus;
          reason = rule.reason;
        }
      }
    }
  }

  const finalScore = Math.min(100, Math.round(baseScore + maxBonus));
  return {
    finalScore,
    bonusApplied: maxBonus,
    seasonReason: reason,
  };
}
