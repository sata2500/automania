import { NextResponse } from 'next/server';
import sql, { ensureKeywordPoolColumns } from '@/lib/db';
import { scrapeEtsyKeywordData } from '@/lib/etsy-scraper';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { requireAdmin } from '@/lib/auth-server';
import { consumeRateLimit } from '@/lib/request-rate-limit';

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const rateLimit = consumeRateLimit(`scraper:evaluate:${session.id}`, 3, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Toplu scraper değerlendirme limiti aşıldı.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    await ensureKeywordPoolColumns();
    const body = await req.json();
    let { ids, limit = 20 } = body;
    limit = Math.min(20, Math.max(1, Number(limit) || 20));
    if (ids !== undefined && (!Array.isArray(ids) || ids.length > 20)) {
      return NextResponse.json({ success: false, error: 'Tek istekte en fazla 20 keyword değerlendirilebilir.' }, { status: 400 });
    }

    // 1. Fetch Etsy OAuth Token & Shop credentials from user_workspaces
    const workspaceRows = await sql`
      SELECT user_id, etsy_shop_id, scraping_api_key, scraping_provider, cloudflare_worker_url 
      FROM user_workspaces
      WHERE user_id = ${session.id}
      LIMIT 1
    `;

    // 2. Fetch App Settings
    const appSettingRows = await sql`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key IN ('etsy_keystring', 'etsy_shared_secret', 'scraping_api_key')
    `;

    let etsyApiKey = process.env.ETSY_API_KEY;
    let etsySharedSecret = process.env.ETSY_SHARED_SECRET;
    let scrapingApiKey = workspaceRows[0]?.scraping_api_key || process.env.SCRAPER_API_KEY || '';
    const scrapingProvider = workspaceRows[0]?.scraping_provider || 'scraperapi';
    const workerUrl = workspaceRows[0]?.cloudflare_worker_url || process.env.CLOUDFLARE_WORKER_URL;

    for (const r of appSettingRows) {
      if (r.setting_key === 'etsy_keystring' && r.setting_value) etsyApiKey = r.setting_value;
      if (r.setting_key === 'etsy_shared_secret' && r.setting_value) etsySharedSecret = r.setting_value;
      if (r.setting_key === 'scraping_api_key' && r.setting_value && !scrapingApiKey) scrapingApiKey = r.setting_value;
    }

    let etsyAccessToken: string | undefined = undefined;
    if (workspaceRows.length > 0 && workspaceRows[0].user_id) {
      const tokenRes = await getValidEtsyToken(workspaceRows[0].user_id);
      if (tokenRes.success && tokenRes.access_token) {
        etsyAccessToken = tokenRes.access_token;
        etsyApiKey = tokenRes.api_key || etsyApiKey;
        etsySharedSecret = tokenRes.shared_secret || etsySharedSecret;
      }
    }

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
