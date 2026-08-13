async function testEtsyNativeSuggest(kw: string) {
  const url = `https://www.etsy.com/api/v3/ajax/public/search/suggestions?query=${encodeURIComponent(kw)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'
    }
  });
  console.log(`Status for "${kw}":`, res.status);
  if (res.ok) {
    const data = await res.json();
    console.log("Suggestions for", kw, ":", data.results.map((r: any) => r.query));
  }
}

async function run() {
  await testEtsyNativeSuggest("vintage shirt");
  await testEtsyNativeSuggest("dog mom gift");
  await testEtsyNativeSuggest("spooky pet lover");
}

run().catch(console.error);
