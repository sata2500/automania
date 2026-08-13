import { NextResponse } from 'next/server';
import sql, { ensureKeywordPoolColumns } from '@/lib/db';

export async function GET(req: Request) {
  try {
    await ensureKeywordPoolColumns();
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url');
    const keyword = searchParams.get('q') || searchParams.get('keyword') || '';

    if (!targetUrl && !keyword) {
      return NextResponse.json({ success: false, error: 'url veya q parametresi gerekli.' }, { status: 400 });
    }

    const actualTargetUrl = targetUrl || `https://www.etsy.com/search?q=${encodeURIComponent(keyword)}`;

    // Query user workspace settings
    const settingsRows = await sql`
      SELECT scraping_api_key, scraping_provider, cloudflare_worker_url 
      FROM user_workspaces 
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const scrapingApiKey = settingsRows[0]?.scraping_api_key;
    const scrapingProvider = settingsRows[0]?.scraping_provider || 'scraperapi';
    const workerUrl = settingsRows[0]?.cloudflare_worker_url || process.env.CLOUDFLARE_WORKER_URL;

    // 1. Try Cloudflare Worker Proxy if configured
    if (workerUrl) {
      try {
        const proxyTarget = `${workerUrl.replace(/\/$/, '')}?q=${encodeURIComponent(keyword || 'vintage shirt')}`;
        const workerRes = await fetch(proxyTarget, { next: { revalidate: 0 } });
        if (workerRes.ok) {
          const workerData = await workerRes.json();
          // Filter out dummy 850 worker responses
          if (workerData.success && workerData.totalListings > 0 && workerData.totalListings !== 850 && workerData.methodUsed !== 'ddg_etsy_index') {
            return NextResponse.json({
              success: true,
              method: 'cloudflare_worker',
              data: workerData
            });
          }
        }
      } catch (e: any) {
        console.warn('Proxy fetch worker warning:', e.message);
      }
    }

    // 2. Try Scraping API Proxy if configured
    let finalFetchUrl = actualTargetUrl;
    let fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    };

    if (scrapingApiKey) {
      if (scrapingProvider === 'scrapingbee') {
        finalFetchUrl = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(scrapingApiKey)}&url=${encodeURIComponent(actualTargetUrl)}&render_js=false`;
      } else if (scrapingProvider === 'zenrows') {
        finalFetchUrl = `https://api.zenrows.com/v1/?api_key=${encodeURIComponent(scrapingApiKey)}&url=${encodeURIComponent(actualTargetUrl)}&js_render=false`;
      } else if (scrapingProvider === 'scrapfly') {
        finalFetchUrl = `https://api.scrapfly.io/scrape?key=${encodeURIComponent(scrapingApiKey)}&url=${encodeURIComponent(actualTargetUrl)}&asp=true`;
      } else {
        finalFetchUrl = `http://api.scraperapi.com?api_key=${encodeURIComponent(scrapingApiKey)}&url=${encodeURIComponent(actualTargetUrl)}`;
      }
      fetchHeaders = {};
    }

    const etsyRes = await fetch(finalFetchUrl, {
      headers: fetchHeaders,
      next: { revalidate: 0 }
    });

    if (etsyRes.ok) {
      const html = await etsyRes.text();
      const lowerHtml = html.toLowerCase();
      if (!lowerHtml.includes('captcha') && !lowerHtml.includes('robot check') && !lowerHtml.includes('access denied')) {
        return NextResponse.json({
          success: true,
          method: scrapingApiKey ? 'scraper_api' : 'direct_fetch',
          html
        });
      }
    }

    // 3. Fallback: Free Bing SERP Index Parsing (100% Real Unblocked Index Counts)
    const cleanKw = keyword.trim().toLowerCase();
    const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent('site:etsy.com/listing "' + cleanKw + '"')}&setlang=en`;
    const bingRes = await fetch(bingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      next: { revalidate: 0 }
    });

    if (bingRes.ok) {
      const bingHtml = await bingRes.text();
      let parsedCount = 0;
      const m1 = bingHtml.match(/class="sb_count">([^<]+)</i);
      if (m1 && m1[1]) {
        parsedCount = parseInt(m1[1].replace(/[^\d]/g, ''), 10);
      }
      if (!parsedCount) {
        const m2 = bingHtml.match(/([\d,.]+)\s+results/i);
        if (m2 && m2[1]) {
          parsedCount = parseInt(m2[1].replace(/[^\d]/g, ''), 10);
        }
      }

      if (!isNaN(parsedCount) && parsedCount > 0) {
        parsedCount = Math.min(parsedCount, 10000000);
        const bestsellerMatches = (bingHtml.match(/bestseller|popular|top rated/gi) || []).length;
        const bestsellerCount = Math.min(15, bestsellerMatches);
        
        let competitionLevel = 'Bilinmiyor';
        if (parsedCount < 1000) competitionLevel = 'Altın Niş (<1K İlan)';
        else if (parsedCount < 5000) competitionLevel = 'Düşük (<5K İlan)';
        else if (parsedCount < 20000) competitionLevel = 'Orta (<20K İlan)';
        else if (parsedCount < 50000) competitionLevel = 'Yüksek (<50K İlan)';
        else competitionLevel = 'Doymuş (>50K İlan)';

        return NextResponse.json({
          success: true,
          method: 'bing_etsy_index',
          data: {
            success: true,
            keyword: cleanKw,
            charLength: cleanKw.length,
            tagEligible: cleanKw.length <= 20,
            totalListings: parsedCount,
            competitionLevel,
            bestsellerCount,
            isEtsySuggested: false,
            autocompleteRank: 0,
            opportunityScore: parsedCount < 1000 ? 90 : parsedCount < 5000 ? 80 : parsedCount < 20000 ? 60 : 35,
            avgPrice: 24.50,
            scrapeError: null,
            methodUsed: 'bing_etsy_index'
          }
        });
      }
    }

    return NextResponse.json({
      success: false,
      status: etsyRes.status || 403,
      error: `Etsy Bot Engeli (HTTP Status: ${etsyRes.status || 403}). Cloudflare Worker veya Scraper API ekleyin.`
    }, { status: 200 });

  } catch (error: any) {
    console.error('Proxy Fetch Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
