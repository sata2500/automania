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
  rawMetrics: {
    method?: 'etsy_official_api' | 'scraper_api' | 'direct_etsy' | 'cloudflare_worker' | 'error';
    autocomplete?: {
      found: boolean;
      rank: number;
      suggestionsCount: number;
      source: string;
      topSuggestions: string[];
    };
    topTags?: string[];
    avgFavorites?: number;
    avgViews?: number;
    currencyCode?: string;
    sampleSize?: number;
    [key: string]: any;
  };
}

export interface ScrapingOptions {
  etsyAccessToken?: string;
  etsyApiKey?: string;
  etsySharedSecret?: string;
  userId?: string;
  apiKey?: string; // Scraping provider key
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
  let avgPrice = 0;
  let scrapeError: string | null = null;
  let rawMetrics: ScrapingResult['rawMetrics'] = {};

  // 1. Etsy Native Autocomplete API (100% Real Etsy Suggestion Engine)
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
        .map((r: any) => (r.query || r.term || '').toLowerCase())
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
    }
  } catch (nativeSuggestErr: any) {
    console.warn(`Etsy Suggestion warning for "${cleanKeyword}":`, nativeSuggestErr.message);
  }

  // 2. PRIMARY SOURCE: Etsy Open API v3 (100% Genuine, Exact Listing Count & Real Listing Data)
  let etsyToken = options?.etsyAccessToken;
  let etsyApiKey = options?.etsyApiKey || process.env.ETSY_API_KEY;
  let etsySecret = options?.etsySharedSecret || process.env.ETSY_SHARED_SECRET;

  // If userId provided but no token in options, try resolving token dynamically
  if (!etsyToken && options?.userId) {
    try {
      const { getValidEtsyToken } = await import('@/lib/etsy-token-manager');
      const tokenRes = await getValidEtsyToken(options.userId);
      if (tokenRes.success && tokenRes.access_token) {
        etsyToken = tokenRes.access_token;
        etsyApiKey = tokenRes.api_key || etsyApiKey;
        etsySecret = tokenRes.shared_secret || etsySecret;
      }
    } catch (e: any) {
      console.warn('Could not dynamically load Etsy token:', e.message);
    }
  }

  if (etsyToken && etsyApiKey) {
    try {
      const headers = {
        'x-api-key': `${etsyApiKey}:${etsySecret || ''}`,
        'Authorization': `Bearer ${etsyToken}`
      };

      const apiUrl = `https://openapi.etsy.com/v3/application/listings/active?keywords=${encodeURIComponent(cleanKeyword)}&limit=25&sort_on=score`;
      const apiRes = await fetch(apiUrl, { headers, next: { revalidate: 0 } });

      if (apiRes.ok) {
        const data = await apiRes.json();
        totalListings = typeof data.count === 'number' ? data.count : 0;
        rawMetrics.method = 'etsy_official_api';

        if (data.results && Array.isArray(data.results) && data.results.length > 0) {
          // Calculate Real Average Price
          const prices = data.results
            .map((item: any) => item.price?.amount ? item.price.amount / (item.price.divisor || 100) : 0)
            .filter((p: number) => p > 0 && p < 1000);
          
          if (prices.length > 0) {
            const sum = prices.reduce((a: number, b: number) => a + b, 0);
            avgPrice = Math.round((sum / prices.length) * 100) / 100;
          }

          // Count High Engagement / Bestseller proxy items
          const highEngagementItems = data.results.filter(
            (i: any) => (i.num_favorers || 0) >= 50 || (i.views || 0) >= 300
          ).length;
          bestsellerCount = highEngagementItems;

          // Extract Co-occurring Ranks / Top Tags from real Etsy listings
          const tagMap: Record<string, number> = {};
          data.results.forEach((item: any) => {
            (item.tags || []).forEach((t: string) => {
              const cleanTag = t.toLowerCase().trim();
              if (cleanTag && cleanTag !== cleanKeyword) {
                tagMap[cleanTag] = (tagMap[cleanTag] || 0) + 1;
              }
            });
          });

          const topTags = Object.entries(tagMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([t]) => t);

          const totalViews = data.results.reduce((a: number, b: any) => a + (b.views || 0), 0);
          const totalFavs = data.results.reduce((a: number, b: any) => a + (b.num_favorers || 0), 0);

          rawMetrics.topTags = topTags;
          rawMetrics.avgViews = Math.round(totalViews / data.results.length);
          rawMetrics.avgFavorites = Math.round(totalFavs / data.results.length);
          rawMetrics.sampleSize = data.results.length;
          rawMetrics.currencyCode = data.results[0]?.price?.currency_code || 'USD';
        }

        // Successfully retrieved from Official Etsy API! Skip fallback scrapers.
        return finalizeKeywordMetrics(cleanKeyword, charLength, tagEligible, totalListings, bestsellerCount, isEtsySuggested, autocompleteRank, avgPrice, null, rawMetrics);
      } else {
        const errText = await apiRes.text();
        console.warn(`Etsy Open API returned status ${apiRes.status} for "${cleanKeyword}":`, errText.substring(0, 150));
      }
    } catch (apiErr: any) {
      console.warn(`Etsy Open API error for "${cleanKeyword}":`, apiErr.message);
    }
  }

  // 3. SECONDARY SOURCE: Residential Scraper API (If configured)
  const scraperKey = options?.apiKey || process.env.SCRAPER_API_KEY || process.env.SCRAPING_API_KEY;
  const provider = (options?.provider || process.env.SCRAPING_PROVIDER || 'scraperapi').toLowerCase();

  if (scraperKey) {
    try {
      const targetSearchUrl = `https://www.etsy.com/search?q=${encodeURIComponent(cleanKeyword)}`;
      let finalFetchUrl = targetSearchUrl;

      if (provider === 'scrapingbee') {
        finalFetchUrl = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(scraperKey)}&url=${encodeURIComponent(targetSearchUrl)}&render_js=false`;
      } else if (provider === 'zenrows') {
        finalFetchUrl = `https://api.zenrows.com/v1/?api_key=${encodeURIComponent(scraperKey)}&url=${encodeURIComponent(targetSearchUrl)}&js_render=false`;
      } else {
        finalFetchUrl = `http://api.scraperapi.com?api_key=${encodeURIComponent(scraperKey)}&url=${encodeURIComponent(targetSearchUrl)}`;
      }

      const searchRes = await fetch(finalFetchUrl, { next: { revalidate: 0 } });
      if (searchRes.ok) {
        const html = await searchRes.text();
        const lowerHtml = html.toLowerCase();
        if (!lowerHtml.includes('captcha') && !lowerHtml.includes('robot check') && !lowerHtml.includes('access denied')) {
          let countMatch = html.match(/([\d,.]+)\s*(?:\+|plus)?\s*results/i) ||
                           html.match(/"total_results"\s*:\s*(\d+)/i) ||
                           html.match(/data-search-results-count="(\d+)"/i) ||
                           html.match(/([\d,.]+)\s*results\s+for/i);

          if (countMatch && countMatch[1]) {
            totalListings = parseInt(countMatch[1].replace(/[,.]/g, ''), 10) || 0;
          }

          const bestsellerMatches = (html.match(/Bestseller|Etsy's Pick|Popular now|In \d+\+ carts/gi) || []).length;
          bestsellerCount = Math.min(20, bestsellerMatches);
          rawMetrics.method = 'scraper_api';

          // Extract Prices
          const priceMatches = html.match(/\$\s*(\d+\.\d{2})/g) || [];
          if (priceMatches.length > 0) {
            const prices = priceMatches
              .map((p: string) => parseFloat(p.replace('$', '').trim()))
              .filter((p: number) => !isNaN(p) && p > 0 && p < 500);

            if (prices.length > 0) {
              const sum = prices.reduce((a: number, b: number) => a + b, 0);
              avgPrice = Math.round((sum / prices.length) * 100) / 100;
            }
          }

          if (totalListings > 0) {
            return finalizeKeywordMetrics(cleanKeyword, charLength, tagEligible, totalListings, bestsellerCount, isEtsySuggested, autocompleteRank, avgPrice, null, rawMetrics);
          }
        }
      }
    } catch (scraperErr: any) {
      console.warn(`Scraper API warning for "${cleanKeyword}":`, scraperErr.message);
    }
  }

  // 4. TERTIARY SOURCE: Direct Fetch / Cloudflare Worker (Checks if residential/unblocked)
  const workerUrl = options?.workerUrl || process.env.CLOUDFLARE_WORKER_URL;
  if (workerUrl) {
    try {
      const proxyTarget = `${workerUrl.replace(/\/$/, '')}?q=${encodeURIComponent(cleanKeyword)}`;
      const workerRes = await fetch(proxyTarget, { next: { revalidate: 0 } });
      if (workerRes.ok) {
        const workerData = await workerRes.json();
        if (workerData.success && workerData.totalListings > 0 && workerData.methodUsed !== 'bing_etsy_index' && workerData.methodUsed !== 'ddg_etsy_index') {
          return finalizeKeywordMetrics(
            cleanKeyword,
            charLength,
            tagEligible,
            workerData.totalListings,
            workerData.bestsellerCount || 0,
            !!workerData.isEtsySuggested,
            workerData.autocompleteRank || 0,
            workerData.avgPrice || 0,
            null,
            { viaWorker: true, method: 'cloudflare_worker' }
          );
        }
      }
    } catch (e: any) {
      console.warn(`Cloudflare Worker Proxy warning for "${cleanKeyword}":`, e.message);
    }
  }

  // 5. ZERO FAKE DATA PRINCIPLE: If no genuine Etsy data source succeeded, report strict error!
  scrapeError = 'Etsy Bot Koruması (HTTP 403) veya Etsy API Bağlantısı Gerekli';
  rawMetrics.method = 'error';

  return finalizeKeywordMetrics(cleanKeyword, charLength, tagEligible, 0, 0, isEtsySuggested, autocompleteRank, 0, scrapeError, rawMetrics);
}

/**
 * Calculates Opportunity Score & Competition Level purely from Real Etsy Signals
 */
function finalizeKeywordMetrics(
  cleanKeyword: string,
  charLength: number,
  tagEligible: boolean,
  totalListings: number,
  bestsellerCount: number,
  isEtsySuggested: boolean,
  autocompleteRank: number,
  avgPrice: number,
  scrapeError: string | null,
  rawMetrics: ScrapingResult['rawMetrics']
): ScrapingResult {
  // Determine Competition Level
  let competitionLevel = 'Bilinmiyor';
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

  // Calculate State-of-the-Art Etsy Print-On-Demand Opportunity Score (0 - 100)
  let opportunityScore = 0;
  if (!scrapeError && totalListings > 0) {
    // 1. Demand & Sales Proof Score (40% Weight)
    // Combines Etsy Autocomplete ranking and real Best Seller proof of transactions
    let demandScore = 30; // Default floor
    if (isEtsySuggested) {
      if (autocompleteRank === 1) demandScore = 100;
      else if (autocompleteRank === 2) demandScore = 92;
      else if (autocompleteRank === 3) demandScore = 85;
      else if (autocompleteRank === 4) demandScore = 78;
      else if (autocompleteRank === 5) demandScore = 72;
      else demandScore = Math.max(50, 70 - (autocompleteRank - 6) * 5);
    }

    // If keyword has proven Best Sellers, lift demand score even if not in top 10 autocomplete
    // Having multiple bestsellers in a niche is direct mathematical proof of active buyer transactions!
    if (bestsellerCount >= 3) {
      demandScore = Math.max(demandScore, 90);
    } else if (bestsellerCount === 2) {
      demandScore = Math.max(demandScore, 75);
    } else if (bestsellerCount === 1) {
      demandScore = Math.max(demandScore, 60);
    }

    // 2. Competition Score (40% Weight) - Fewer competing active listings = higher organic rank velocity
    let competitionScore = 10;
    if (totalListings < 300) competitionScore = 100;
    else if (totalListings < 750) competitionScore = 95;
    else if (totalListings < 1500) competitionScore = 90;
    else if (totalListings < 3000) competitionScore = 80;
    else if (totalListings < 6000) competitionScore = 70;
    else if (totalListings < 15000) competitionScore = 55;
    else if (totalListings < 35000) competitionScore = 35;
    else if (totalListings < 75000) competitionScore = 20;
    else competitionScore = 10;

    // 3. Commercial & Optimization Score (20% Weight) - Tag fit (<=20 chars), Bestsellers & Pricing
    let commercialScore = 20; // Base
    if (tagEligible) commercialScore += 30; // Etsy tag limit is 20 chars; directly usable as a tag
    commercialScore += Math.min(40, bestsellerCount * 12); // Bestseller presence
    if (avgPrice >= 15 && avgPrice <= 50) commercialScore += 10; // Healthy POD price range
    commercialScore = Math.min(100, commercialScore);

    // Weighted Base Calculation
    let baseScore = Math.round(
      (demandScore * 0.40) +
      (competitionScore * 0.40) +
      (commercialScore * 0.20)
    );

    // 4. "Hidden Gem" / "Altın Maden" Bonus & Saturated Penalty
    // If listings < 1500 AND bestsellers >= 2: This is a proven gold mine with almost no competition
    if (totalListings < 1500 && bestsellerCount >= 2) {
      baseScore += 5;
    }
    // Heavy saturation penalty for generic keywords with >100K listings
    if (totalListings > 100000) {
      baseScore -= 10;
    }

    opportunityScore = Math.max(1, Math.min(99, baseScore));
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
    avgPrice: Math.round(avgPrice * 100) / 100,
    scrapeError,
    rawMetrics
  };
}
