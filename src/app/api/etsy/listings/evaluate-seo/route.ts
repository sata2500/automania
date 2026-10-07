import { getErrorMessage } from '@/lib/errors';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { evaluateEtsyListingSeo } from '@/lib/etsy-seo-evaluator';
import { scrapeEtsyKeywordData } from '@/lib/etsy-scraper';
import { loadScraperCredentials } from '@/lib/scraper-credentials';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {

    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const body = await req.json();
    const { listingId, listingIds, all = false, forceRescrape = false } = body;

    let listings: any[] = [];

    if (all) {
      listings = await sql`
        SELECT * FROM user_etsy_listings 
        WHERE user_id = ${session.id}
      `;
    } else {
      const targetIds: string[] = [];
      if (listingId) targetIds.push(String(listingId));
      if (Array.isArray(listingIds)) {
        for (const id of listingIds) {
          if (id && !targetIds.includes(String(id))) targetIds.push(String(id));
        }
      }

      if (targetIds.length === 0) {
        return NextResponse.json({ success: false, error: 'Değerlendirilecek listing ID belirtilmedi.' }, { status: 400 });
      }

      listings = await sql`
        SELECT * FROM user_etsy_listings 
        WHERE user_id = ${session.id} AND listing_id = ANY(${targetIds as any})
      `;
    }

    if (listings.length === 0) {
      return NextResponse.json({ success: false, error: 'Değerlendirilecek ilan bulunamadı.' }, { status: 404 });
    }

    // 1. Extract all unique tags across target listings
    const allUniqueTags = Array.from(
      new Set(
        listings.flatMap(l => {
          const tags = Array.isArray(l.tags) ? l.tags : (typeof l.tags === 'string' ? JSON.parse(l.tags) : []);
          return (tags as string[]).map((t: string) => String(t).trim().toLowerCase()).filter(Boolean);
        })
      )
    );

    // 2. Query existing keyword_pool records
    const existingPoolRows = allUniqueTags.length > 0 ? await sql`
      SELECT id, keyword, opportunity_score, etsy_score, total_listings, competition_level, bestseller_count, is_etsy_suggested, last_evaluated_at
      FROM keyword_pool
      WHERE keyword = ANY(${allUniqueTags as any})
    ` : [];

    const poolMapByKeyword = new Map<string, any>();
    for (const row of existingPoolRows) {
      if (row.keyword) {
        poolMapByKeyword.set(row.keyword.toLowerCase().trim(), row);
      }
    }

    // 3. Identify tags that are missing OR stale (7-day rule: last_evaluated_at < NOW() - 7 days)
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const tagsToScrape = allUniqueTags.filter(tag => {
      if (forceRescrape) return true;
      const existing = poolMapByKeyword.get(tag);
      if (!existing) return true;
      if (!existing.last_evaluated_at) return true;
      const ageMs = now - new Date(existing.last_evaluated_at).getTime();
      return ageMs > SEVEN_DAYS_MS;
    });

    // 4. If any tags need scraping, resolve Etsy / Scraper credentials and evaluate
    let newlyScrapedCount = 0;
    if (tagsToScrape.length > 0) {
      // Fetch Etsy credentials & settings
      const { etsyAccessToken, etsyApiKey, etsySharedSecret, scrapingApiKey, scrapingProvider, workerUrl } =
        await loadScraperCredentials(session.id);

      // Limit concurrent scrapes to avoid Etsy API rate-limits
      for (const tag of tagsToScrape) {
        try {
          const scraped = await scrapeEtsyKeywordData(tag, {
            etsyAccessToken,
            etsyApiKey,
            etsySharedSecret,
            apiKey: scrapingApiKey,
            provider: scrapingProvider,
            workerUrl,
            fastMode: true,
          });

          const newId = poolMapByKeyword.get(tag)?.id || `kw-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

          await sql`
            INSERT INTO keyword_pool (
              id, keyword, etsy_score, opportunity_score, total_listings,
              competition_level, bestseller_count, is_etsy_suggested,
              autocomplete_rank, char_length, tag_eligible, avg_price,
              last_scrape_error, raw_metrics, last_evaluated_at
            ) VALUES (
              ${newId}, ${tag}, ${scraped.opportunityScore}, ${scraped.opportunityScore}, ${scraped.totalListings},
              ${scraped.competitionLevel}, ${scraped.bestsellerCount}, ${scraped.isEtsySuggested},
              ${scraped.autocompleteRank}, ${scraped.charLength}, ${scraped.tagEligible}, ${scraped.avgPrice},
              ${scraped.scrapeError}, ${JSON.stringify(scraped.rawMetrics)}, CURRENT_TIMESTAMP
            )
            ON CONFLICT (keyword) DO UPDATE SET
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

          newlyScrapedCount++;
        } catch (scrapeErr) {
          console.warn(`[Listing SEO Tag Scrape] Warning for tag "${tag}":`, getErrorMessage(scrapeErr));
        }
      }
    }

    // 5. Load complete keyword pool metrics for target tags and store
    const keywordPoolRows = await sql`
      SELECT keyword, opportunity_score, etsy_score, total_listings, competition_level, bestseller_count, is_etsy_suggested, last_evaluated_at 
      FROM keyword_pool
      WHERE opportunity_score > 0 OR etsy_score > 0 OR keyword = ANY(${allUniqueTags as any})
    `;

    const results: any[] = [];

    // 6. Run mathematical SEO evaluation for each listing
    for (const item of listings) {
      const listingIdStr = String(item.listing_id);
      const tags = Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? JSON.parse(item.tags) : []);
      const vision = typeof item.vision_analysis === 'string' ? JSON.parse(item.vision_analysis) : (item.vision_analysis || {});

      const evaluation = evaluateEtsyListingSeo({
        title: item.title,
        description: item.description,
        tags,
        visionAnalysis: vision,
        keywordPoolRows
      });

      await sql`
        UPDATE user_etsy_listings 
        SET 
          seo_score = ${evaluation.score},
          seo_evaluation = ${JSON.stringify(evaluation)}::jsonb,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${session.id} AND listing_id = ${listingIdStr}
      `;

      results.push({
        listingId: listingIdStr,
        seoScore: evaluation.score,
        grade: evaluation.grade,
        evaluation
      });
    }

    return NextResponse.json({
      success: true,
      evaluatedCount: results.length,
      newlyScrapedTagsCount: newlyScrapedCount,
      freshFromPoolTagsCount: allUniqueTags.length - newlyScrapedCount,
      results
    });

  } catch (error) {
    console.error('SEO Evaluation API Error:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
