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
  serperApiKey?: string;
}

export async function scrapeEtsyKeywordData(keyword: string, options?: ScrapingOptions): Promise<ScrapingResult> {
  const cleanKeyword = keyword.trim().toLowerCase();
  const charLength = cleanKeyword.length;
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

  const workerUrl = options?.workerUrl || process.env.CLOUDFLARE_WORKER_URL;
  const scraperKey = options?.apiKey || process.env.SCRAPER_API_KEY || process.env.SCRAPING_API_KEY;
  const provider = (options?.provider || process.env.SCRAPING_PROVIDER || 'scraperapi').toLowerCase();
  const serperKey = options?.serperApiKey || process.env.SERPER_API_KEY;

  // 0. Try Serper.dev Google SERP API if configured (100% Real Google Index Count)
  if (serperKey) {
    try {
      const serperRes = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: `site:etsy.com "${cleanKeyword}"`
        }),
        next: { revalidate: 0 }
      });

      if (serperRes.ok) {
        const serperData = await serperRes.json();
        if (serperData.searchInformation && serperData.searchInformation.totalResults !== undefined) {
          const rawTotal = serperData.searchInformation.totalResults;
          const parsed = typeof rawTotal === 'number' ? rawTotal : parseInt(String(rawTotal).replace(/[^\d]/g, ''), 10);
          if (!isNaN(parsed) && parsed > 0) {
            totalListings = parsed;
            rawMetrics.method = 'google_serper_api';
            rawMetrics.serperTotal = rawTotal;
          }
        }
      }
    } catch (e: any) {
      console.warn(`Serper API warning for "${cleanKeyword}":`, e.message);
    }
  }

  // 1. If Cloudflare Worker URL is configured, use it!
  if (workerUrl) {
    try {
      const proxyTarget = `${workerUrl.replace(/\/$/, '')}?q=${encodeURIComponent(cleanKeyword)}`;
      const workerRes = await fetch(proxyTarget, { next: { revalidate: 0 } });
      if (workerRes.ok) {
        const workerData = await workerRes.json();
        if (workerData.success && workerData.totalListings > 0) {
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
            rawMetrics: { viaWorker: true, methodUsed: workerData.methodUsed || 'cloudflare_worker' }
          };
        }
      }
    } catch (e: any) {
      console.warn(`Cloudflare Worker Proxy warning for "${cleanKeyword}":`, e.message);
    }
  }

  // 2. Etsy Native Autocomplete API (100% Real Etsy Data, Unblocked)
  try {
    const suggestUrl = `https://www.etsy.com/api/v3/ajax/public/search/suggestions?query=${encodeURIComponent(cleanKeyword)}`;
    const suggestRes = await fetch(suggestUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      next: { revalidate: 0 }
    });

    if (suggestRes.ok) {
      const suggestData = await suggestRes.json();
      const suggestions: string[] = (suggestData.results || [])
        .map((r: any) => (r.query || '').toLowerCase())
        .filter(Boolean);

      const foundIdx = suggestions.findIndex(s => s === cleanKeyword || s.includes(cleanKeyword));
      if (foundIdx !== -1) {
        isEtsySuggested = true;
        autocompleteRank = foundIdx + 1;
      }
      rawMetrics.autocomplete = { 
        found: isEtsySuggested, 
        rank: autocompleteRank, 
        suggestionsCount: suggestions.length,
        source: 'etsy_native_api',
        topSuggestions: suggestions.slice(0, 5)
      };
    } else {
      throw new Error(`Etsy Native Suggest status ${suggestRes.status}`);
    }
  } catch (nativeSuggestErr: any) {
    // Fallback to Google Suggest if Etsy Native Suggest is unreachable
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
        rawMetrics.autocomplete = { 
          found: isEtsySuggested, 
          rank: autocompleteRank, 
          suggestionsCount: suggestions.length,
          source: 'google_suggest_fallback' 
        };
      }
    } catch (e: any) {
      console.warn(`Google Suggest warning for "${cleanKeyword}":`, e.message);
    }
  }

  // 3. Direct Etsy Search HTML or Proxy Fetch
  let fetchedDirectly = false;
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
                         html.match(/data-search-results-count="(\d+)"/i) ||
                         html.match(/([\d,.]+)\s*results\s+for/i);

        if (countMatch && countMatch[1]) {
          totalListings = parseInt(countMatch[1].replace(/[,.]/g, ''), 10) || 0;
          fetchedDirectly = true;
        }

        const bestsellerMatches = (html.match(/Bestseller|Etsy's Pick|Popular now|In \d+\+ carts/gi) || []).length;
        bestsellerCount = Math.min(20, bestsellerMatches);
        rawMetrics.method = scraperKey ? 'scraper_api' : 'direct_etsy';
      } else {
        throw new Error('Etsy Bot Block');
      }
    } else {
      throw new Error(`Etsy Status ${searchRes.status}`);
    }
  } catch (directErr) {
    // 4. Real Bing SERP Index Engine (No fake 850/4200 numbers!)
    try {
      const bingUrl = `https://www.bing.com/search?q=site:etsy.com+${encodeURIComponent('"' + cleanKeyword + '"')}`;
      const bingRes = await fetch(bingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        next: { revalidate: 0 }
      });

      if (bingRes.ok) {
        const bingHtml = await bingRes.text();
        const match = bingHtml.match(/class="sb_count">([^<]+)</i);
        if (match && match[1]) {
          const rawNum = match[1].replace(/[^\d]/g, '');
          const parsedCount = parseInt(rawNum, 10);
          if (!isNaN(parsedCount) && parsedCount > 0) {
            totalListings = parsedCount;
            rawMetrics.method = 'bing_etsy_index';
            rawMetrics.bingRawText = match[1];
          }
        }

        const bestsellerMatches = (bingHtml.match(/bestseller|popular|top rated/gi) || []).length;
        bestsellerCount = Math.min(15, bestsellerMatches);
      }
    } catch (bingErr: any) {
      console.warn(`Bing Index warning for "${cleanKeyword}":`, bingErr.message);
    }
  }

  // If no listings could be extracted from direct Etsy, Scraper API, or Bing SERP:
  if (totalListings === 0 && !fetchedDirectly) {
    scrapeError = 'Etsy Bot Engeli (HTTP Status: 403 / Proxy Gerekli)';
  }

  // Determine Competition Level Text
  if (scrapeError && totalListings === 0) {
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
  if (scrapeError && totalListings === 0) {
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
    keyword: cleanKeyword,
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

