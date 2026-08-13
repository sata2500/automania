import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testEndpoints() {
  const kw = "vintage shirt";
  console.log("--- Testing Etsy & Alternative Endpoints for:", kw, "---");

  // 1. Etsy Autocomplete / Suggest API
  try {
    const url = `https://www.etsy.com/api/v3/ajax/bes/suggest?q=${encodeURIComponent(kw)}&sub_type=tag`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    console.log("Etsy Suggest API Status:", res.status);
    if (res.ok) {
      const data = await res.json();
      console.log("Etsy Suggest Data:", JSON.stringify(data).slice(0, 300));
    }
  } catch (e: any) {
    console.log("Etsy Suggest Err:", e.message);
  }

  // 2. Etsy Search Async JSON API
  try {
    const url = `https://www.etsy.com/search/async?q=${encodeURIComponent(kw)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      }
    });
    console.log("Etsy Search Async Status:", res.status);
    if (res.ok) {
      const text = await res.text();
      console.log("Etsy Search Async Len:", text.length, "Snippet:", text.slice(0, 300));
    }
  } catch (e: any) {
    console.log("Etsy Search Async Err:", e.message);
  }

  // 3. Google Suggest API
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent('etsy ' + kw)}`;
    const res = await fetch(url);
    console.log("Google Suggest Status:", res.status);
    if (res.ok) {
      const data = await res.json();
      console.log("Google Suggest Data:", data);
    }
  } catch (e: any) {
    console.log("Google Suggest Err:", e.message);
  }

  // 4. Google Search HTML (via fetch)
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent('site:etsy.com "' + kw + '"')}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    console.log("Google SERP Status:", res.status);
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/About ([\d,.]+) results/i) || html.match(/Yaklaşık ([\d,.]+) sonuç/i);
      console.log("Google SERP Total Match:", match ? match[1] : 'Not found');
    }
  } catch (e: any) {
    console.log("Google SERP Err:", e.message);
  }
}

testEndpoints().catch(console.error);
