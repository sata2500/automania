import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testGoogleSerp(keyword: string) {
  console.log(`\nTesting Google SERP for "${keyword}"...`);
  const targetUrl = `https://www.google.com/search?q=${encodeURIComponent('site:etsy.com ' + keyword)}&hl=en`;
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    console.log(`Google Status: ${res.status}`);
    const html = await res.text();
    console.log(`HTML Length: ${html.length}`);

    // Parse Google total results
    const m1 = html.match(/About\s+([\d,.]+)\s+results/i) || html.match(/Yaklaşık\s+([\d,.]+)\s+sonuç/i);
    console.log('Google Total Count Match:', m1?.[1]);
  } catch (e: any) {
    console.error('Google SERP Error:', e.message);
  }
}

async function main() {
  await testGoogleSerp('dracula family');
  await testGoogleSerp('dragonfly shirt');
  await testGoogleSerp('cat mom shirt');
}

main();
