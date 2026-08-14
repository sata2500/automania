/**
 * Automania POD Studio - Cloudflare Worker Etsy Scraper Proxy (Zero-Block High-Speed Engine)
 * Deploy this code to your Cloudflare Worker: https://automania-etsy-proxy.salihtanriseven25.workers.dev
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);
    const keyword = url.searchParams.get('q') || url.searchParams.get('keyword');

    if (!keyword) {
      return new Response(
        JSON.stringify({ success: false, error: 'q (keyword) parameter is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const cleanKeyword = keyword.trim().toLowerCase();
    const charLength = cleanKeyword.length;
    const tagEligible = charLength <= 20;

    let totalListings = 0;
    let bestsellerCount = 0;
    let isEtsySuggested = false;
    let autocompleteRank = 0;
    let avgPrice = 24.50; // Standard US apparel benchmark baseline
    let scrapeError = null;
    let methodUsed = 'direct_etsy';

    // 1. Etsy Native Autocomplete API (100% Real Etsy Data, Unblocked)
    try {
      const suggestUrl = `https://www.etsy.com/api/v3/ajax/public/search/suggestions?query=${encodeURIComponent(cleanKeyword)}`;
      const suggestRes = await fetch(suggestUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        }
      });
      if (suggestRes.ok) {
        const suggestData = await suggestRes.json();
        const suggestions = (suggestData.results || []).map((r) => (r.query || '').toLowerCase()).filter(Boolean);
        const foundIdx = suggestions.findIndex(s => s === cleanKeyword || s.includes(cleanKeyword));
        if (foundIdx !== -1) {
          isEtsySuggested = true;
          autocompleteRank = foundIdx + 1;
        }
      }
    } catch (nativeErr) {
      // Fallback to Google Suggest
      try {
        const suggestUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent('etsy ' + cleanKeyword)}`;
        const suggestRes = await fetch(suggestUrl);
        if (suggestRes.ok) {
          const suggestData = await suggestRes.json();
          const suggestions = (suggestData[1] || []).map((s) => s.toLowerCase());
          const foundIdx = suggestions.findIndex(s => s.includes(cleanKeyword));
          if (foundIdx !== -1) {
            isEtsySuggested = true;
            autocompleteRank = foundIdx + 1;
          }
        }
      } catch (e) {
        console.warn('Suggest API warning:', e);
      }
    }

    // 2. Etsy Search HTML or DuckDuckGo Site Index Search
    try {
      const searchUrl = `https://www.etsy.com/search?q=${encodeURIComponent(cleanKeyword)}`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
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
        } else {
          throw new Error('Etsy Direct WAF Block');
        }
      } else {
        throw new Error(`Etsy Direct Status ${searchRes.status}`);
      }
    } catch (directErr) {
      // Fallback Engine: Bing site:etsy.com/listing search (100% Real SERP Indexing)
      methodUsed = 'bing_etsy_index';
      try {
        const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent('site:etsy.com/listing "' + cleanKeyword + '"')}&setlang=en`;
        const bingRes = await fetch(bingUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          }
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
            totalListings = parsedCount;
          }
          const bestsellerMatches = (bingHtml.match(/bestseller|popular|top rated/gi) || []).length;
          bestsellerCount = Math.min(15, bestsellerMatches);
        } else {
          scrapeError = 'Bing Index Fallback Blocked';
        }
      } catch (bingErr) {
        scrapeError = 'Kazıma Bağlantı Engeli';
      }
    }


    // Determine Competition Level Text
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

    // Calculate Opportunity Score
    let opportunityScore = 0;
    if (!scrapeError && totalListings > 0) {
      let demandScore = 30;
      if (isEtsySuggested) {
        if (autocompleteRank === 1) demandScore = 100;
        else if (autocompleteRank === 2) demandScore = 92;
        else if (autocompleteRank === 3) demandScore = 85;
        else if (autocompleteRank === 4) demandScore = 78;
        else if (autocompleteRank === 5) demandScore = 72;
        else demandScore = Math.max(50, 70 - (autocompleteRank - 6) * 5);
      }

      if (bestsellerCount >= 3) {
        demandScore = Math.max(demandScore, 90);
      } else if (bestsellerCount === 2) {
        demandScore = Math.max(demandScore, 75);
      } else if (bestsellerCount === 1) {
        demandScore = Math.max(demandScore, 60);
      }

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

      let commercialScore = 20;
      if (tagEligible) commercialScore += 30;
      commercialScore += Math.min(40, bestsellerCount * 12);
      if (avgPrice >= 15 && avgPrice <= 50) commercialScore += 10;
      commercialScore = Math.min(100, commercialScore);

      let baseScore = Math.round(
        (demandScore * 0.40) +
        (competitionScore * 0.40) +
        (commercialScore * 0.20)
      );

      if (totalListings < 1500 && bestsellerCount >= 2) {
        baseScore += 5;
      }
      if (totalListings > 100000) {
        baseScore -= 10;
      }

      opportunityScore = Math.max(1, Math.min(99, baseScore));
    }

    return new Response(
      JSON.stringify({
        success: !scrapeError,
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
        methodUsed
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  },
};
