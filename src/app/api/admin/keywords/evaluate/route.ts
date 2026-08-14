import { NextResponse } from 'next/server';
import sql, { ensureKeywordPoolColumns } from '@/lib/db';
import { scrapeEtsyKeywordData } from '@/lib/etsy-scraper';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';

export async function POST(req: Request) {
  try {
    await ensureKeywordPoolColumns();
    const body = await req.json();
    let { ids, limit = 20 } = body;

    // 1. Fetch Etsy OAuth Token & Shop credentials from user_workspaces
    const workspaceRows = await sql`
      SELECT user_id, etsy_shop_id, scraping_api_key, scraping_provider, cloudflare_worker_url 
      FROM user_workspaces 
      WHERE etsy_access_token IS NOT NULL OR scraping_api_key IS NOT NULL
      ORDER BY updated_at DESC
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
    let scrapingProvider = workspaceRows[0]?.scraping_provider || 'scraperapi';
    let workerUrl = workspaceRows[0]?.cloudflare_worker_url || process.env.CLOUDFLARE_WORKER_URL;

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

        // Ingest discovered competitor co-occurring tags into keyword pool
        if (scraped.rawMetrics?.topTags && Array.isArray(scraped.rawMetrics.topTags)) {
          for (const topTag of scraped.rawMetrics.topTags) {
            const cleanTag = String(topTag).toLowerCase().trim();
            if (cleanTag && cleanTag !== item.keyword.toLowerCase().trim() && cleanTag.length <= 20) {
              const tagId = crypto.randomUUID();
              try {
                await sql`
                  INSERT INTO keyword_pool (
                    id, keyword, usage_count, etsy_score, opportunity_score, total_listings,
                    competition_level, bestseller_count, is_etsy_suggested, autocomplete_rank,
                    char_length, tag_eligible, avg_price, last_scrape_error, raw_metrics,
                    created_at
                  )
                  VALUES (
                    ${tagId}, ${cleanTag}, 1, 0, 0, 0,
                    'Taranacak', 0, false, 0,
                    ${cleanTag.length}, true, 0, null,
                    ${JSON.stringify({ source: 'competitor_co_occurring_tag', parent_keyword: item.keyword })}::jsonb,
                    CURRENT_TIMESTAMP
                  )
                  ON CONFLICT (keyword) DO UPDATE
                  SET usage_count = keyword_pool.usage_count + 1
                `;
              } catch (tagErr: any) {
                // Ignore silent conflict/unique errors
              }
            }
          }
        }

        evaluatedCount++;

        // 300ms throttle to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
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

  } catch (error: any) {
    console.error('Keywords Evaluate API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
