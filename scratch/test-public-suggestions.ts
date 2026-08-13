import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testPublicSuggestions() {
  const kw = "cat shirt";
  const params = [
    `q=${encodeURIComponent(kw)}&search_type=all`,
    `q=${encodeURIComponent(kw)}&type=typeahead`,
    `query=${encodeURIComponent(kw)}`,
    `text=${encodeURIComponent(kw)}`,
    `q=${encodeURIComponent(kw)}&search_query=${encodeURIComponent(kw)}`,
    `q=${encodeURIComponent(kw)}&limit=10`,
    `q=${encodeURIComponent(kw)}&sub_type=tag`
  ];

  for (const p of params) {
    const ep = `https://www.etsy.com/api/v3/ajax/public/search/suggestions?${p}`;
    try {
      const res = await fetch(ep, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        }
      });
      console.log(`Params: ${p} -> Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log("-> Response:", text.slice(0, 300));
      }
    } catch (e: any) {
      console.log(`Err: ${e.message}`);
    }
  }
}

testPublicSuggestions().catch(console.error);
