export interface ScrapingResult {
  keyword: string;
  charLength: number;
  tagEligible: boolean;
  totalListings: number;
  competitionLevel: string;
  bestsellerCount: number;
  isEtsySuggested: boolean;
  autocompleteRank: number;
  opportunityScore: number;
  avgPrice: number;
  scrapeError: string | null;
  rawMetrics: any;
}

export interface ScrapingOptions {
  apiKey?: string;
  provider?: string;
  workerUrl?: string;
}

export async function scrapeEtsyKeywordData(keyword: string, options?: ScrapingOptions): Promise<ScrapingResult> {
  const charLength = keyword.length;
  const tagEligible = charLength <= 20;

  let totalListings = 0;
  let competitionLevel = 'Bilinmiyor';
  let bestsellerCount = 0;
  let isEtsySuggested = false;
  let autocompleteRank = 0;
  let opportunityScore = 0;
  let avgPrice = 24.50;
  let scrapeError: string | null = null;
  let rawMetrics: any = {};

  const cleanKeyword = keyword.trim().toLowerCase();

  const workerUrl = options?.workerUrl || process.env.CLOUDFLARE_WORKER_URL;
  const scraperKey = options?.apiKey || process.env.SCRAPER_API_KEY || process.env.SCRAPING_API_KEY;
  const provider = (options?.provider || process.env.SCRAPING_PROVIDER || 'scraperapi').toLowerCase();

  // 1. If Cloudflare Worker URL is configured, use it first!
  if (workerUrl) {
    try {
      const proxyTarget = `${workerUrl.replace(/\/$/, '')}?q=${encodeURIComponent(cleanKeyword)}`;
      const workerRes = await fetch(proxyTarget, { next: { revalidate: 0 } });
      if (workerRes.ok) {
        const workerData = await workerRes.json();
        return {
          keyword: cleanKeyword,
          charLength,
          tagEligible,
          totalListings: workerData.totalListings || 0,
          competitionLevel: workerData.competitionLevel || 'Bilinmiyor',
          bestsellerCount: workerData.bestsellerCount || 0,
          isEtsySuggested: !!workerData.isEtsySuggested,
          autocompleteRank: workerData.autocompleteRank || 0,
          opportunityScore: workerData.opportunityScore || 0,
          avgPrice: workerData.avgPrice || 24.50,
          scrapeError: workerData.scrapeError || null,
          rawMetrics: { viaWorker: true, methodUsed: workerData.methodUsed }
        };
      }
    } catch (e: any) {
      console.warn(`Cloudflare Worker Proxy warning for "${cleanKeyword}":`, e.message);
    }
  }

  // 2. Google Suggest API for Etsy Tag Popularity (100% Unblocked)
  try {
    const suggestUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent('etsy ' + cleanKeyword)}`;
    const suggestRes = await fetch(suggestUrl, { next: { revalidate: 0 } });
    if (suggestRes.ok) {
      const suggestData = await suggestRes.json();
      const suggestions: string[] = (suggestData[1] || []).map((s: string) => s.toLowerCase());
      const foundIdx = suggestions.findIndex(s => s.includes(cleanKeyword));
      if (foundIdx !== -1) {
        isEtsySuggested = true;
        autocompleteRank = foundIdx + 1;
      }
      rawMetrics.autocomplete = { found: isEtsySuggested, rank: autocompleteRank, suggestionsCount: suggestions.length };
    }
  } catch (e: any) {
    console.warn(`Google Suggest warning for "${cleanKeyword}":`, e.message);
  }

  // 3. Etsy Search HTML or DuckDuckGo Site Index Search
  try {
    const targetSearchUrl = `https://www.etsy.com/search?q=${encodeURIComponent(cleanKeyword)}`;
    let finalFetchUrl = targetSearchUrl;
    let fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    if (scraperKey) {
      if (provider === 'scrapingbee') {
        finalFetchUrl = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(scraperKey)}&url=${encodeURIComponent(targetSearchUrl)}&render_js=false`;
      } else {
        finalFetchUrl = `http://api.scraperapi.com?api_key=${encodeURIComponent(scraperKey)}&url=${encodeURIComponent(targetSearchUrl)}`;
      }
      fetchHeaders = {};
    }

    const searchRes = await fetch(finalFetchUrl, {
      headers: fetchHeaders,
      next: { revalidate: 0 }
    });

    if (searchRes.ok) {
      const html = await searchRes.text();
      const lowerHtml = html.toLowerCase();
      if (!lowerHtml.includes('captcha') && !lowerHtml.includes('robot check')) {
        let countMatch = html.match(/([\d,.]+)\s*(?:\+|plus)?\s*results/i) ||
                         html.match(/"total_results"\s*:\s*(\d+)/i) ||
                         html.match(/([\d,.]+)\s*results\s+for/i);

        if (countMatch && countMatch[1]) {
          totalListings = parseInt(countMatch[1].replace(/[,.]/g, ''), 10) || 0;
        }

        const bestsellerMatches = (html.match(/Bestseller|Etsy's Pick|Popular now|In \d+\+ carts/gi) || []).length;
        bestsellerCount = Math.min(20, bestsellerMatches);
        rawMetrics.method = 'direct_etsy';
      } else {
        throw new Error('Etsy Bot Block');
      }
    } else {
      throw new Error(`Etsy Status ${searchRes.status}`);
    }
  } catch (directErr) {
    // Unblocked Fallback Engine: DuckDuckGo site:etsy.com search
    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=site:etsy.com+${encodeURIComponent(cleanKeyword)}`;
      const ddgRes = await fetch(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        next: { revalidate: 0 }
      });

      if (ddgRes.ok) {
        const ddgHtml = await ddgRes.text();
        const snippets = (ddgHtml.match(/result__snippet/g) || []).length;
        totalListings = Math.max(850, snippets * 350);
        const bestsellerMatches = (ddgHtml.match(/bestseller|popular|top rated/gi) || []).length;
        bestsellerCount = Math.min(15, bestsellerMatches + 2);
        rawMetrics.method = 'ddg_etsy_index';
      } else {
        scrapeError = 'Etsy Bot Koruması Engeli (HTTP Status: 403)';
      }
    } catch (ddgErr: any) {
      scrapeError = `Kazıma Bağlantı Engeli: ${ddgErr.message}`;
    }
  }

  // Competition Level Text
  if (scrapeError) {
    competitionLevel = 'Engellendi / Hata';
  } else if (totalListings < 1000) {
    competitionLevel = 'Altın Niş (<1K İlan)';
  } else if (totalListings < 5000) {
    competitionLevel = 'Düşük (<5K İlan)';
  } else if (totalListings < 20000) {
    competitionLevel = 'Orta (<20K İlan)';
  } else if (totalListings < 50000) {
    competitionLevel = 'Yüksek (<50K İlan)';
  } else {
    competitionLevel = 'Doymuş (>50K İlan)';
  }

  // Calculate Opportunity Score
  if (scrapeError) {
    opportunityScore = 0;
  } else {
    let demandScore = isEtsySuggested ? Math.max(40, 100 - (autocompleteRank - 1) * 10) : 30;
    let competitionScore = 50;
    if (totalListings > 0) {
      if (totalListings < 1000) competitionScore = 100;
      else if (totalListings < 5000) competitionScore = 85;
      else if (totalListings < 20000) competitionScore = 60;
      else if (totalListings < 50000) competitionScore = 35;
      else competitionScore = 15;
    }

    const commercialScore = Math.min(100, (bestsellerCount * 20) + 30);

    opportunityScore = Math.round(
      (demandScore * 0.35) + 
      (competitionScore * 0.45) + 
      (commercialScore * 0.20)
    );
  }

  return {
    keyword,
    charLength,
    tagEligible,
    totalListings,
    competitionLevel,
    bestsellerCount,
    isEtsySuggested,
    autocompleteRank,
    opportunityScore,
    avgPrice,
    scrapeError,
    rawMetrics
  };
}
