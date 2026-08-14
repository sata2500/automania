import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testEtsyApiKeywords() {
  const { default: sql } = await import('../src/lib/db');
  const { getValidEtsyToken } = await import('../src/lib/etsy-token-manager');

  const workspaces = await sql`SELECT user_id, etsy_shop_id FROM user_workspaces WHERE etsy_access_token IS NOT NULL LIMIT 1`;
  const tokenRes = await getValidEtsyToken(workspaces[0].user_id);
  
  const headers = {
    'x-api-key': `${tokenRes.api_key}:${tokenRes.shared_secret || ''}`,
    'Authorization': `Bearer ${tokenRes.access_token}`
  };

  const testKeywords = [
    'dog halloween',
    'witch dog',
    'heart sunglasses',
    'pumpkin bucket',
    'spooky and kind',
    'golden retriever shirt',
    '4th of july shirt'
  ];

  for (const kw of testKeywords) {
    console.log(`\n================================`);
    console.log(`Testing Keyword: "${kw}"`);

    // 1. Suggestions
    const sugRes = await fetch(`https://www.etsy.com/api/v3/ajax/public/search/suggestions?query=${encodeURIComponent(kw)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const sugData = await sugRes.json();
    const suggestions = (sugData.results || []).map((r: any) => (r.query || r.term || '').toLowerCase());
    const isSuggested = suggestions.some((s: string) => s === kw || s.includes(kw));
    const rank = suggestions.findIndex((s: string) => s === kw || s.includes(kw)) + 1;
    console.log(`- Etsy Suggestion: isSuggested=${isSuggested}, rank=${rank}, top=[${suggestions.slice(0, 3).join(', ')}]`);

    // 2. Active Listings Search via Etsy Open API v3
    const url = `https://openapi.etsy.com/v3/application/listings/active?keywords=${encodeURIComponent(kw)}&limit=25&sort_on=score`;
    const apiRes = await fetch(url, { headers });
    if (apiRes.ok) {
      const data = await apiRes.json();
      console.log(`- Total Listings Count: ${data.count}`);
      console.log(`- Returned items in sample: ${data.results?.length}`);
      
      if (data.results && data.results.length > 0) {
        // Calculate average price
        const prices = data.results
          .map((item: any) => item.price?.amount ? item.price.amount / (item.price.divisor || 100) : 0)
          .filter((p: number) => p > 0);
        const avgPrice = prices.length > 0 ? (prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2) : 0;
        
        // Check top tags frequency
        const tagMap: Record<string, number> = {};
        data.results.forEach((item: any) => {
          (item.tags || []).forEach((t: string) => {
            const cleanTag = t.toLowerCase().trim();
            tagMap[cleanTag] = (tagMap[cleanTag] || 0) + 1;
          });
        });
        const topTags = Object.entries(tagMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([t, c]) => `${t} (${c})`);

        // Check high engagement (favorites / views as commercial intent proxy)
        const avgFavs = data.results.reduce((a: number, b: any) => a + (b.num_favorers || 0), 0) / data.results.length;
        const avgViews = data.results.reduce((a: number, b: any) => a + (b.views || 0), 0) / data.results.length;
        const bestsellersEstimate = data.results.filter((i: any) => (i.num_favorers || 0) > 100 || (i.views || 0) > 1000).length;

        console.log(`- Avg Price: $${avgPrice} ${data.results[0].price?.currency_code}`);
        console.log(`- Avg Favorites: ${avgFavs.toFixed(1)}, Avg Views: ${avgViews.toFixed(1)}`);
        console.log(`- High Engagement (Bestseller proxy): ${bestsellersEstimate} / ${data.results.length}`);
        console.log(`- Top Co-occurring Tags: ${topTags.join(', ')}`);
      }
    } else {
      console.log(`- Etsy API Status: ${apiRes.status}`);
      const err = await apiRes.text();
      console.log(`- Error: ${err}`);
    }
  }
}

testEtsyApiKeywords().catch(console.error);
