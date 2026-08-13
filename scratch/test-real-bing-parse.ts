import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function parseBingRealCount(keyword: string) {
  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent('site:etsy.com/listing "' + keyword + '"')}&setlang=en`;
  try {
    const res = await fetch(bingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const html = await res.text();

    // Regex 1: sb_count (e.g., "About 160,000 results")
    const m1 = html.match(/class="sb_count">([^<]+)</i);
    let count = 0;
    if (m1 && m1[1]) {
      const parsed = parseInt(m1[1].replace(/[^\d]/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0) count = parsed;
    }

    // Regex 2: general results count
    if (!count) {
      const m2 = html.match(/([\d,.]+)\s+results/i);
      if (m2 && m2[1]) {
        const parsed = parseInt(m2[1].replace(/[^\d]/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) count = parsed;
      }
    }

    console.log(`Keyword: "${keyword}" => Real Bing Count: ${count.toLocaleString()}`);
    return count;
  } catch (e: any) {
    console.error(`Error for "${keyword}":`, e.message);
    return 0;
  }
}

async function main() {
  const keywords = [
    'oak tree shirt',
    'coiled snake tee',
    'eagle and snake',
    'feather and oak',
    'oak leaf shirt'
  ];

  for (const kw of keywords) {
    await parseBingRealCount(kw);
  }
}

main();
