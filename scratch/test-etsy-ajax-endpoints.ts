import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testEndpoint(name: string, url: string, headers?: Record<string, string>) {
  console.log(`\nTesting ${name}: ${url}`);
  try {
    const res = await fetch(url, {
      headers: headers || {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`Response snippet (${text.length} bytes):`, text.slice(0, 300));
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
  }
}

async function main() {
  const kw = 'oak tree shirt';

  // Etsy Candidate Endpoints
  await testEndpoint('Etsy Search Suggestions', `https://www.etsy.com/api/v3/ajax/public/search/suggestions?query=${encodeURIComponent(kw)}`);
  await testEndpoint('Etsy Search Async', `https://www.etsy.com/search/async?q=${encodeURIComponent(kw)}`);
  await testEndpoint('Etsy Search JSON', `https://www.etsy.com/api/v3/ajax/public/search/results?query=${encodeURIComponent(kw)}`);
  await testEndpoint('Etsy Search Query JSON', `https://www.etsy.com/search?q=${encodeURIComponent(kw)}&ref=search_bar&async=true`);
  await testEndpoint('Etsy Mobile API Endpoint', `https://www.etsy.com/api/v3/ajax/member/search/suggestions?query=${encodeURIComponent(kw)}`);

  // Search Engine Alternatives (Free)
  await testEndpoint('Bing Search RSS/XML', `https://www.bing.com/search?q=${encodeURIComponent('site:etsy.com/listing "' + kw + '"')}&format=rss`);
  await testEndpoint('DuckDuckGo HTML API', `https://html.duckduckgo.com/html/?q=${encodeURIComponent('site:etsy.com/listing "' + kw + '"')}`);
  await testEndpoint('DuckDuckGo Lite API', `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent('site:etsy.com/listing "' + kw + '"')}`);
  await testEndpoint('Google Search Mobile', `https://www.google.com/search?q=${encodeURIComponent('site:etsy.com/listing "' + kw + '"')}&gbv=1`);
}

main();
