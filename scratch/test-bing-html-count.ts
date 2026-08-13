import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testBingHtml(keyword: string) {
  const bingUrl = `https://www.bing.com/search?q=site:etsy.com+${encodeURIComponent('"' + keyword + '"')}`;
  console.log(`\nFetching Bing HTML for "${keyword}"...`);
  try {
    const res = await fetch(bingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const html = await res.text();
    console.log(`Status: ${res.status}, Length: ${html.length}`);

    // Check count matches
    const sbMatch = html.match(/class="sb_count">([^<]+)</i);
    console.log('sb_count:', sbMatch?.[1]);

    const resMatch = html.match(/([\d,.]+)\s+results/i) || html.match(/([\d,.]+)\s+sonuç/i);
    console.log('results match:', resMatch?.[1]);

  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

async function main() {
  await testBingHtml('oak tree shirt');
  await testBingHtml('coiled snake tee');
  await testBingHtml('oak leaf shirt');
}

main();
