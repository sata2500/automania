import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testDirectEtsyHtml(keyword: string) {
  const url = `https://www.etsy.com/search?q=${encodeURIComponent(keyword)}`;
  console.log(`\nFetching direct Etsy HTML for "${keyword}"...`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    const html = await res.text();
    console.log(`HTML Length: ${html.length}`);

    // Check DataDome / CAPTCHA
    if (html.includes('datadome') || html.includes('captcha') || html.includes('Please enable JS')) {
      console.log('⚠️ DataDome WAF challenge detected!');
    }

    // Try parsing total results count regexes
    const m1 = html.match(/([\d,.]+)\s*(?:\+|plus)?\s*results/i);
    const m2 = html.match(/"total_results"\s*:\s*(\d+)/i);
    const m3 = html.match(/([\d,.]+)\s*results\s+for/i);
    const m4 = html.match(/"num_found"\s*:\s*(\d+)/i);

    console.log('Matches:', { m1: m1?.[1], m2: m2?.[1], m3: m3?.[1], m4: m4?.[1] });

  } catch (e: any) {
    console.error('Fetch error:', e.message);
  }
}

async function main() {
  await testDirectEtsyHtml('dracula family');
  await testDirectEtsyHtml('dragonfly shirt');
}

main();
