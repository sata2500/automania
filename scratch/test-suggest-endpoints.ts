import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testEtsySuggestEndpoints() {
  const kw = "cat shirt";
  const endpoints = [
    `https://www.etsy.com/api/v3/ajax/bes/member/search/suggestions?q=${encodeURIComponent(kw)}`,
    `https://www.etsy.com/search/suggestions?q=${encodeURIComponent(kw)}`,
    `https://www.etsy.com/api/v3/ajax/public/search/suggestions?q=${encodeURIComponent(kw)}`,
    `https://www.etsy.com/api/v3/ajax/bes/search/typeahead?q=${encodeURIComponent(kw)}`,
    `https://www.etsy.com/api/v3/ajax/bes/search/suggestions?q=${encodeURIComponent(kw)}`,
    `https://www.etsy.com/api/v3/ajax/bes/search/auto-complete?q=${encodeURIComponent(kw)}`,
    `https://www.etsy.com/api/v3/ajax/bes/member/search/typeahead?q=${encodeURIComponent(kw)}`,
    `https://suggestqueries.google.com/complete/search?client=chrome&ds=etsy&q=${encodeURIComponent(kw)}`
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        }
      });
      console.log(`Endpoint: ${ep} -> Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log("-> Response:", text.slice(0, 200));
      }
    } catch (e: any) {
      console.log(`Endpoint: ${ep} -> Err: ${e.message}`);
    }
  }
}

testEtsySuggestEndpoints().catch(console.error);
