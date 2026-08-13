import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testBingRss(keyword: string) {
  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent('site:etsy.com/listing "' + keyword + '"')}&format=rss`;
  console.log(`\nFetching Bing RSS for "${keyword}"...`);
  try {
    const res = await fetch(bingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, text/xml, */*'
      }
    });

    const xml = await res.text();
    console.log(`XML length: ${xml.length}`);

    // Parse items count
    const itemMatches = xml.match(/<item>/gi) || [];
    console.log(`Items found in RSS feed: ${itemMatches.length}`);

    // Check title / description
    const titleMatch = xml.match(/<title>(.*?)<\/title>/i);
    console.log(`Channel Title: ${titleMatch?.[1]}`);

  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

async function main() {
  const keywords = ['oak tree shirt', 'coiled snake tee', 'eagle and snake', 'feather and oak', 'oak leaf shirt'];
  for (const kw of keywords) {
    await testBingRss(kw);
  }
}

main();
