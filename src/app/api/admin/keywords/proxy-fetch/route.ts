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
          return NextResponse.json({
            success: true,
            method: 'cloudflare_worker',
            data: workerData
          });
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

    if (etsyRes.status === 403 || etsyRes.status === 429) {
      return NextResponse.json({
        success: false,
        status: etsyRes.status,
        error: `Etsy Bot Koruması Engeli (HTTP Status: ${etsyRes.status}). Cloudflare Worker veya Scraper API ekleyin.`
      }, { status: 200 });
    }

    const html = await etsyRes.text();
    const lowerHtml = html.toLowerCase();

    if (lowerHtml.includes('captcha') || lowerHtml.includes('robot check') || lowerHtml.includes('access denied')) {
      return NextResponse.json({
        success: false,
        status: 403,
        error: 'Etsy Captcha Engeli (Cloudflare WAF)'
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      method: scrapingApiKey ? 'scraper_api' : 'direct_fetch',
      html
    });

  } catch (error: any) {
    console.error('Proxy Fetch Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
