/**
 * Kelime havuzu (keyword_pool): tasarım analizlerinin ve ilan metinlerinin kullandığı Etsy kelime puanları.
 *
 * Akış:
 *  - Bir kelime sorulduğunda puanı TAZE ise (son 7 gün, gerçek veri) havuzdaki puan kullanılır, Etsy'ye gidilmez.
 *  - Eski veya hiç taranmamışsa süre bütçesi içinde Etsy'den puanlanıp havuza yazılır; bütçe biterse kelime
 *    "Taranacak" olarak havuza eklenir ve arka plan yenilemesi puanlar.
 *  - Rakip etiketleri (ilanların birlikte kullandığı etiketler) havuza "Taranacak" olarak eklenir; senkron
 *    istekte taranmaz (zaman aşımını önler).
 *  - Zamanlayıcı her turda en eski / hiç taranmamış kelimeleri sınırlı sayıda yeniden puanlar (`refreshStaleKeywords`).
 *  - 14 günden eski puanlar "güncel değil" sayılır: ilan metni, niş araştırması ve analiz sonucu kullanmaz.
 */
import sql from '@/lib/db';
import { scrapeEtsyKeywordData, type ScrapingOptions, type ScrapingResult } from '@/lib/etsy-scraper';
import { filterSafeKeywords } from '@/lib/trademark-shield';
import type { EvaluatedKeyword } from '@/types/pod';

/** Bu süreden yeni puan taze sayılır; yeniden taranmaz. */
export const KEYWORD_FRESH_DAYS = 7;
/** Bu süreden eski puan kullanılmaz (gösterilmez, ilan metnine katkı vermez). */
export const KEYWORD_MAX_SCORE_AGE_DAYS = 14;

const PENDING_LEVELS = new Set(['Taranacak', 'Henüz Taranmadı', 'Engellendi / Hata']);
const DAY_MS = 24 * 60 * 60 * 1000;
const SCRAPE_CONCURRENCY = 3;

export type PoolRow = EvaluatedKeyword & { usage_count?: number | null; last_evaluated_at?: string | Date | null };

/** Havuz satırının puanı taze mi (yeniden taramaya gerek yok). */
export function isFreshPoolRow(row: Pick<PoolRow, 'last_evaluated_at' | 'opportunity_score' | 'competition_level'> | undefined, now = Date.now()): boolean {
  if (!row?.last_evaluated_at) return false;
  const at = new Date(row.last_evaluated_at).getTime();
  return Number.isFinite(at)
    && now - at < KEYWORD_FRESH_DAYS * DAY_MS
    && (row.opportunity_score ?? 0) > 0
    && !PENDING_LEVELS.has(String(row.competition_level ?? ''));
}

/** Kelimeleri havuzda eşleşecek biçime getirir: küçük harf, tek boşluk, Etsy etiket sınırı (20), marka riski yok. */
export function normalizeKeywords(keywords: string[]): string[] {
  const cleaned = keywords.map((k) => String(k ?? '').toLowerCase().replace(/\s+/g, ' ').trim()).filter((k) => k.length > 0 && k.length <= 20);
  return Array.from(new Set(filterSafeKeywords(cleaned).safe));
}

async function loadRows(keywords: string[]): Promise<Map<string, PoolRow>> {
  if (keywords.length === 0) return new Map();
  const rows = await sql`SELECT * FROM keyword_pool WHERE keyword = ANY(${keywords})` as unknown as PoolRow[];
  return new Map(rows.map((row) => [row.keyword.toLowerCase(), row]));
}

async function saveScraped(keyword: string, scraped: ScrapingResult, existing: PoolRow | undefined, countUsage: boolean) {
  const id = existing?.id || crypto.randomUUID();
  const usage = countUsage ? 1 : 0;
  await sql`
    INSERT INTO keyword_pool (
      id, keyword, usage_count, etsy_score, opportunity_score, total_listings, competition_level, bestseller_count,
      is_etsy_suggested, autocomplete_rank, char_length, tag_eligible, avg_price, last_scrape_error, raw_metrics,
      last_evaluated_at, created_at
    ) VALUES (
      ${id}, ${keyword}, ${Math.max(1, usage)}, ${scraped.opportunityScore}, ${scraped.opportunityScore}, ${scraped.totalListings},
      ${scraped.competitionLevel}, ${scraped.bestsellerCount}, ${scraped.isEtsySuggested}, ${scraped.autocompleteRank},
      ${keyword.length}, ${keyword.length <= 20}, ${scraped.avgPrice}, ${scraped.scrapeError},
      ${JSON.stringify(scraped.rawMetrics)}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (keyword) DO UPDATE SET
      usage_count = COALESCE(keyword_pool.usage_count, 0) + ${usage},
      etsy_score = EXCLUDED.etsy_score,
      opportunity_score = EXCLUDED.opportunity_score,
      total_listings = EXCLUDED.total_listings,
      competition_level = EXCLUDED.competition_level,
      bestseller_count = EXCLUDED.bestseller_count,
      is_etsy_suggested = EXCLUDED.is_etsy_suggested,
      autocomplete_rank = EXCLUDED.autocomplete_rank,
      char_length = EXCLUDED.char_length,
      tag_eligible = EXCLUDED.tag_eligible,
      avg_price = EXCLUDED.avg_price,
      last_scrape_error = EXCLUDED.last_scrape_error,
      raw_metrics = EXCLUDED.raw_metrics,
      last_evaluated_at = CURRENT_TIMESTAMP
  `;
}

/** Puanlanmamış kelimeleri havuza "Taranacak" olarak ekler (arka plan yenilemesi puanlar). */
export async function queueKeywords(keywords: string[]): Promise<void> {
  for (const keyword of keywords) {
    await sql`
      INSERT INTO keyword_pool (id, keyword, usage_count, competition_level, char_length, tag_eligible, created_at)
      VALUES (${crypto.randomUUID()}, ${keyword}, 1, 'Taranacak', ${keyword.length}, ${keyword.length <= 20}, CURRENT_TIMESTAMP)
      ON CONFLICT (keyword) DO NOTHING
    `.catch(() => undefined);
  }
}

export type ScoreResult = {
  /** Havuzdaki güncel satırlar (sorulan kelimeler + rakip etiketleri) */
  evaluated: EvaluatedKeyword[];
  /** Rakiplerin birlikte kullandığı etiketler (havuzda puanlı veya puanlanmak üzere sıraya alınmış) */
  competitorTags: string[];
  /** Süre bütçesi bittiği için taranamayan kelimeler (havuza "Taranacak" olarak eklendi) */
  pending: string[];
  /** Bu istekte Etsy'den taranan kelime sayısı */
  scraped: number;
};

/**
 * Kelimeleri havuzdan puanlar: taze olanlar doğrudan kullanılır (kullanım sayısı artar), eski/yeni olanlar
 * `budgetMs` içinde Etsy'den taranıp havuza yazılır. Bütçe biterse kalanlar sıraya alınır.
 */
export async function scoreKeywords(rawKeywords: string[], options: ScrapingOptions, { budgetMs, countUsage = true }: { budgetMs: number; countUsage?: boolean }): Promise<ScoreResult> {
  const deadline = Date.now() + budgetMs;
  const keywords = normalizeKeywords(rawKeywords);
  const existing = await loadRows(keywords);
  const fresh = keywords.filter((k) => isFreshPoolRow(existing.get(k)));
  const stale = keywords.filter((k) => !fresh.includes(k));

  if (countUsage && fresh.length > 0) {
    await sql`UPDATE keyword_pool SET usage_count = COALESCE(usage_count, 0) + 1 WHERE keyword = ANY(${fresh})`.catch(() => undefined);
  }

  let scraped = 0;
  const pending: string[] = [];
  for (let i = 0; i < stale.length; i += SCRAPE_CONCURRENCY) {
    const chunk = stale.slice(i, i + SCRAPE_CONCURRENCY);
    // Bir tarama birkaç saniye sürebilir: kalan süre yetmeyecekse yeni parti başlatılmaz.
    if (Date.now() > deadline - 8_000) { pending.push(...stale.slice(i)); break; }
    await Promise.allSettled(chunk.map(async (keyword) => {
      try {
        const result = await scrapeEtsyKeywordData(keyword, { ...options, fastMode: true });
        await saveScraped(keyword, result, existing.get(keyword), countUsage);
        scraped++;
      } catch (error) {
        console.warn(`[Keyword Pool] "${keyword}" could not be scored:`, error instanceof Error ? error.message : error);
        pending.push(keyword);
      }
    }));
  }
  if (pending.length > 0) await queueKeywords(pending);

  // Rakip etiketleri: taranan/taze kelimelerin ilanlarında en sık birlikte geçen etiketler.
  const rows = await loadRows(keywords);
  const counts = new Map<string, number>();
  for (const row of rows.values()) {
    const metrics = (typeof row.raw_metrics === 'string' ? JSON.parse(row.raw_metrics) : row.raw_metrics) as { topTags?: unknown } | null;
    for (const tag of Array.isArray(metrics?.topTags) ? metrics!.topTags : []) {
      const clean = String(tag).toLowerCase().trim();
      if (clean && clean.length <= 20 && !keywords.includes(clean)) counts.set(clean, (counts.get(clean) ?? 0) + 1);
    }
  }
  const competitorTags = normalizeKeywords(Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([tag]) => tag)).slice(0, 8);
  const competitorRows = await loadRows(competitorTags);
  await queueKeywords(competitorTags.filter((tag) => !competitorRows.has(tag)));

  const evaluated = [...rows.values(), ...competitorRows.values()].map(publicRow);
  return { evaluated, competitorTags, pending, scraped };
}

/** İstemciye/analize dönen satır: 14 günden eski puan "güncel değil" olarak sıfırlanır. */
export function publicRow(row: PoolRow): EvaluatedKeyword {
  const at = row.last_evaluated_at ? new Date(row.last_evaluated_at).getTime() : 0;
  const tooOld = !at || Date.now() - at > KEYWORD_MAX_SCORE_AGE_DAYS * DAY_MS;
  const { usage_count: _usage, ...rest } = row;
  return tooOld && !PENDING_LEVELS.has(String(row.competition_level ?? ''))
    ? { ...rest, opportunity_score: 0, etsy_score: 0, competition_level: 'Taranacak' }
    : rest;
}

/**
 * Arka plan yenilemesi: hiç taranmamış, 7 günden eski ve (bir günden önce) taranamamış kelimeleri (en çok kullanılanlar ve en eskiler önce)
 * sınırlı sayıda, süre bütçesi içinde yeniden puanlar. Etsy'yi yormamak için partiler arasında kısa bekleme yapılır.
 */
export async function refreshStaleKeywords(options: ScrapingOptions, { limit = 45, budgetMs = 120_000 }: { limit?: number; budgetMs?: number } = {}): Promise<{ refreshed: number; remaining: number }> {
  const deadline = Date.now() + budgetMs;
  const rows = await sql`
    SELECT keyword FROM keyword_pool
    WHERE last_evaluated_at IS NULL OR last_evaluated_at < NOW() - make_interval(days => ${KEYWORD_FRESH_DAYS}::int)
      OR (competition_level IN ('Taranacak', 'Henüz Taranmadı', 'Engellendi / Hata') AND last_evaluated_at < NOW() - INTERVAL '1 day')
    ORDER BY (last_evaluated_at IS NULL) DESC, COALESCE(usage_count, 0) DESC, last_evaluated_at ASC NULLS FIRST
    LIMIT ${limit}
  ` as unknown as Array<{ keyword: string }>;
  let refreshed = 0;
  for (let i = 0; i < rows.length; i += SCRAPE_CONCURRENCY) {
    if (Date.now() > deadline - 10_000) break;
    const chunk = rows.slice(i, i + SCRAPE_CONCURRENCY);
    await Promise.allSettled(chunk.map(async ({ keyword }) => {
      const result = await scrapeEtsyKeywordData(keyword, { ...options, fastMode: true });
      await saveScraped(keyword, result, undefined, false);
      refreshed++;
    }));
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  const [{ count } = { count: 0 }] = await sql`
    SELECT COUNT(*)::int AS count FROM keyword_pool
    WHERE last_evaluated_at IS NULL OR last_evaluated_at < NOW() - make_interval(days => ${KEYWORD_FRESH_DAYS}::int)
      OR (competition_level IN ('Taranacak', 'Henüz Taranmadı', 'Engellendi / Hata') AND last_evaluated_at < NOW() - INTERVAL '1 day')
  ` as unknown as Array<{ count: number }>;
  return { refreshed, remaining: Number(count) || 0 };
}
