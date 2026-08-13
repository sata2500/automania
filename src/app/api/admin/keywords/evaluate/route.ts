import { NextResponse } from 'next/server';
import sql, { ensureKeywordPoolColumns } from '@/lib/db';
import { scrapeEtsyKeywordData } from '@/lib/etsy-scraper';

export async function POST(req: Request) {
  try {
    await ensureKeywordPoolColumns();
    const body = await req.json();
    let { ids, limit = 20 } = body;

    // Fetch Admin Scraping & SERP API Key settings from user_workspaces or app_settings
    const settingsRows = await sql`
      SELECT scraping_api_key, scraping_provider 
      FROM user_workspaces 
      WHERE scraping_api_key IS NOT NULL AND scraping_api_key != ''
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const appSettingRows = await sql`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key IN ('serper_api_key', 'scraping_api_key')
    `;
    
    let serperApiKey = process.env.SERPER_API_KEY || '';
    let scrapingApiKey = settingsRows[0]?.scraping_api_key || '';
    let scrapingProvider = settingsRows[0]?.scraping_provider || 'scraperapi';

    for (const r of appSettingRows) {
      if (r.setting_key === 'serper_api_key' && r.setting_value) serperApiKey = r.setting_value;
      if (r.setting_key === 'scraping_api_key' && r.setting_value && !scrapingApiKey) scrapingApiKey = r.setting_value;
    }


    let targetKeywords: { id: string, keyword: string }[] = [];

    // If specific IDs are provided, use them. Otherwise, find oldest evaluated keywords (null or > 7 days)
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
      return NextResponse.json({ success: true, message: 'Değerlendirilecek eskimiş kelime bulunamadı.', evaluatedCount: 0 });
    }

    let evaluatedCount = 0;
    let botBlockedCount = 0;
    const errors: string[] = [];

    for (const item of targetKeywords) {
      try {
        const scraped = await scrapeEtsyKeywordData(item.keyword, { 
          apiKey: scrapingApiKey, 
          provider: scrapingProvider,
          serperApiKey
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

        evaluatedCount++;

        // Add 500ms delay between keywords to reduce risk of IP rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e: any) {
        console.error(`Error scraping keyword ${item.keyword}:`, e);
        errors.push(`"${item.keyword}": ${e.message}`);
      }
    }

    let warning: string | undefined = undefined;
    if (botBlockedCount > 0) {
      warning = `${botBlockedCount} adet kelimede Etsy Bot Koruması / CAPTCHA engeline takılındı. Hatalar veritabanına işlendi.`;
    }

    return NextResponse.json({
      success: true,
      evaluatedCount,
      botBlockedCount,
      totalRequested: targetKeywords.length,
      errors: errors.length > 0 ? errors : undefined,
      warning
    });

  } catch (error: any) {
    console.error('Keywords Evaluate API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
