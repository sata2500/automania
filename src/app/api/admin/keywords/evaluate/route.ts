import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { scrapeEtsyKeywordData } from '@/lib/etsy-scraper';
import { loadScraperCredentials } from '@/lib/scraper-credentials';
import { requireAdmin } from '@/lib/auth-server';
import { consumeRateLimit } from '@/lib/request-rate-limit';

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    // This is an application-level guard for expensive provider calls, not an
    // Etsy quota claim. A request evaluates at most 20 keywords sequentially.
    const rateLimit = consumeRateLimit(`scraper:evaluate:${session.id}`, 10, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: `Kelime değerlendirme istek limiti doldu. Yaklaşık ${rateLimit.retryAfterSeconds} saniye sonra tekrar deneyin.`,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      }, {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'X-RateLimit-Remaining': '0',
        },
      });
    }

    const body = await req.json();
    let { ids, limit = 20 } = body;
    limit = Math.min(20, Math.max(1, Number(limit) || 20));
    if (ids !== undefined && (!Array.isArray(ids) || ids.length > 20)) {
      return NextResponse.json({ success: false, error: 'Tek istekte en fazla 20 keyword değerlendirilebilir.' }, { status: 400 });
    }

    // 1. Fetch Etsy OAuth Token & Shop credentials from user_workspaces
    const { etsyAccessToken, etsyApiKey, etsySharedSecret, scrapingApiKey, scrapingProvider, workerUrl } =
      await loadScraperCredentials(session.id);

    let targetKeywords: { id: string, keyword: string }[] = [];

    // If specific IDs are provided, evaluate those. Otherwise pick oldest evaluated
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const rows = await sql`
        SELECT id, keyword FROM keyword_pool WHERE id = ANY(${ids as any})
      `;
      targetKeywords = rows as { id: string, keyword: string }[];
    } else {
      const rows = await sql`
        SELECT id, keyword FROM keyword_pool 
        WHERE last_evaluated_at IS NULL 
           OR last_evaluated_at < NOW() - INTERVAL '7 days'
        ORDER BY last_evaluated_at ASC NULLS FIRST
        LIMIT ${limit}
      `;
      targetKeywords = rows as { id: string, keyword: string }[];
    }

    if (targetKeywords.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Değerlendirilecek kelime bulunamadı.', 
        evaluatedCount: 0,
        hasEtsyApi: !!etsyAccessToken
      });
    }

    let evaluatedCount = 0;
    let botBlockedCount = 0;
    const errors: string[] = [];

    for (const item of targetKeywords) {
      try {
        const scraped = await scrapeEtsyKeywordData(item.keyword, {
          etsyAccessToken,
          etsyApiKey,
          etsySharedSecret,
          apiKey: scrapingApiKey,
          provider: scrapingProvider,
          workerUrl
        });

        if (scraped.scrapeError) {
          botBlockedCount++;
          errors.push(`"${item.keyword}": ${scraped.scrapeError}`);
        }

        await sql`
          UPDATE keyword_pool 
          SET 
            etsy_score = ${scraped.opportunityScore},
            opportunity_score = ${scraped.opportunityScore},
            total_listings = ${scraped.totalListings},
            competition_level = ${scraped.competitionLevel},
            bestseller_count = ${scraped.bestsellerCount},
            is_etsy_suggested = ${scraped.isEtsySuggested},
            autocomplete_rank = ${scraped.autocompleteRank},
            char_length = ${scraped.charLength},
            tag_eligible = ${scraped.tagEligible},
            avg_price = ${scraped.avgPrice},
            last_scrape_error = ${scraped.scrapeError},
            raw_metrics = ${JSON.stringify(scraped.rawMetrics)},
            last_evaluated_at = CURRENT_TIMESTAMP
          WHERE id = ${item.id}
        `;

        // Note: topTags are saved inside raw_metrics JSON for info/listing context,
        // but NOT inserted as new un-evaluated rows into keyword_pool (prevents infinite recursive bloat).

        evaluatedCount++;

        // 350ms throttle to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 350));
      } catch (e: any) {
        console.error(`Error scraping keyword ${item.keyword}:`, e);
        errors.push(`"${item.keyword}": ${e.message}`);
      }
    }

    let warning: string | undefined = undefined;
    if (botBlockedCount > 0) {
      warning = `${botBlockedCount} adet kelimede Etsy Bot Koruması / API hatası oluştu. Gerçek veri alınamadığı için engellendi olarak işaretlendi.`;
    }

    return NextResponse.json({
      success: true,
      evaluatedCount,
      botBlockedCount,
      rateLimit: {
        remaining: rateLimit.remaining,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      totalRequested: targetKeywords.length,
      hasEtsyApi: !!etsyAccessToken,
      errors: errors.length > 0 ? errors : undefined,
      warning
    });

  } catch (error) {
    console.error('[Keywords Evaluate] Request failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Keyword değerlendirme isteği işlenemedi.' }, { status: 500 });
  }
}
