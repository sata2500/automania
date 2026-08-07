export interface ClientScrapeResult {
  id: string;
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
}

export async function scrapeEtsyFromBrowser(id: string, keyword: string): Promise<ClientScrapeResult> {
  const cleanKeyword = keyword.trim().toLowerCase();
  const charLength = cleanKeyword.length;
  const tagEligible = charLength <= 20;

  let totalListings = 0;
  let bestsellerCount = 0;
  let isEtsySuggested = false;
  let autocompleteRank = 0;
  let avgPrice = 0;
  let scrapeError: string | null = null;

  // 1. Etsy Autocomplete Check (Direct Client Fetch - No CORS issue on Autocomplete API!)
  try {
    const suggestUrl = `https://www.etsy.com/api/v3/ajax/bes/suggest?q=${encodeURIComponent(cleanKeyword)}&sub_type=tag`;
    const suggestRes = await fetch(suggestUrl);
    if (suggestRes.ok) {
      const suggestData = await suggestRes.json();
      const results: any[] = suggestData.results || suggestData.queries || [];
      const foundIdx = results.findIndex((item: any) => {
        const queryText = (item.query || item.search_query || item.term || '').toLowerCase();
        return queryText === cleanKeyword || queryText.includes(cleanKeyword);
      });
      if (foundIdx !== -1) {
        isEtsySuggested = true;
        autocompleteRank = foundIdx + 1;
      }
    }
  } catch (e: any) {
    console.warn(`Browser Autocomplete error for "${cleanKeyword}":`, e.message);
  }

  // 2. Etsy Search HTML via Proxy Fetch Handler (Resolves CORS Origin Header Restrictions)
  try {
    const proxyRes = await fetch(`/api/admin/keywords/proxy-fetch?q=${encodeURIComponent(cleanKeyword)}`);
    const proxyData = await proxyRes.json();

    if (proxyData.data && proxyData.method === 'cloudflare_worker') {
      // Cloudflare Worker responded with complete JSON data
      return {
        id,
        keyword: cleanKeyword,
        charLength,
        tagEligible,
        totalListings: proxyData.data.totalListings || 0,
        competitionLevel: proxyData.data.competitionLevel || 'Bilinmiyor',
        bestsellerCount: proxyData.data.bestsellerCount || 0,
        isEtsySuggested: !!proxyData.data.isEtsySuggested,
        autocompleteRank: proxyData.data.autocompleteRank || 0,
        opportunityScore: proxyData.data.opportunityScore || 0,
        avgPrice: proxyData.data.avgPrice || 0,
        scrapeError: proxyData.data.scrapeError || null
      };
    } else if (!proxyData.success || proxyData.error) {
      scrapeError = proxyData.error || 'Etsy Bot Koruması Engeli (HTTP Status: 403)';
    } else if (proxyData.html) {
      const html = proxyData.html;
      // Extract Total Listings Count
      let countMatch = html.match(/([\d,.]+)\s*(?:\+|plus)?\s*results/i) ||
                       html.match(/"total_results"\s*:\s*(\d+)/i) ||
                       html.match(/([\d,.]+)\s*results\s+for/i);

      if (countMatch && countMatch[1]) {
        totalListings = parseInt(countMatch[1].replace(/[,.]/g, ''), 10) || 0;
      }

      // Count Bestsellers
      const bestsellerMatches = (html.match(/Bestseller|Etsy's Pick|Popular now|In \d+\+ carts/gi) || []).length;
      bestsellerCount = Math.min(20, bestsellerMatches);

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
    }
  } catch (e: any) {
    scrapeError = `Kazıma Bağlantı Hatası: ${e.message}`;
  }

  // Competition Level Text
  let competitionLevel = 'Bilinmiyor';
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

  // Pure Math Opportunity Score (STRICTLY 0 IF SCRAPE ERROR)
  let opportunityScore = 0;
  if (!scrapeError) {
    let demandScore = isEtsySuggested ? Math.max(30, 100 - (autocompleteRank - 1) * 10) : 25;
    let competitionScore = 50;
    if (totalListings > 0) {
      if (totalListings < 1000) competitionScore = 100;
      else if (totalListings < 5000) competitionScore = 85;
      else if (totalListings < 20000) competitionScore = 60;
      else if (totalListings < 50000) competitionScore = 35;
      else competitionScore = 15;
    }
    let commercialScore = Math.min(100, (bestsellerCount * 20) + 30);

    opportunityScore = Math.round((demandScore * 0.35) + (competitionScore * 0.45) + (commercialScore * 0.20));
  }

  return {
    id,
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
    scrapeError
  };
}
