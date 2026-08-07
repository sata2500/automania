import { NextResponse } from 'next/server';
import sql, { ensureKeywordPoolColumns } from '@/lib/db';
import { scrapeEtsyKeywordData } from '@/lib/etsy-scraper';

export async function POST(req: Request) {
  try {
    await ensureKeywordPoolColumns();
    const body = await req.json();
    const { keyword = 'vintage shirt', workerUrl } = body;

    // Fetch user workspace settings
    const settingsRows = await sql`
      SELECT scraping_api_key, scraping_provider, cloudflare_worker_url 
      FROM user_workspaces 
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const scrapingApiKey = settingsRows[0]?.scraping_api_key;
    const scrapingProvider = settingsRows[0]?.scraping_provider || 'scraperapi';
    const effectiveWorkerUrl = workerUrl || settingsRows[0]?.cloudflare_worker_url || process.env.CLOUDFLARE_WORKER_URL;

    const result = await scrapeEtsyKeywordData(keyword, {
      apiKey: scrapingApiKey,
      provider: scrapingProvider,
      workerUrl: effectiveWorkerUrl
    });

    return NextResponse.json({
      success: !result.scrapeError,
      result,
      diagnostics: {
        testedKeyword: keyword,
        workerUrlUsed: effectiveWorkerUrl || 'Yok',
        hasScraperApiKey: !!scrapingApiKey,
        scrapingProvider
      }
    });
  } catch (error: any) {
    console.error('Test Scraper API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
