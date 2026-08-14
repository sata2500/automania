import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testAll() {
  const { default: sql } = await import('../src/lib/db');
  console.log("=== 1. Checking Database App Settings & Workspaces ===");
  const settings = await sql`SELECT setting_key, setting_value FROM app_settings`;
  let etsyKey = process.env.ETSY_API_KEY;
  let etsySecret = process.env.ETSY_SHARED_SECRET;
  let scrapingApiKey = process.env.SCRAPER_API_KEY || process.env.SCRAPING_API_KEY;
  let serperApiKey = process.env.SERPER_API_KEY;

  for (const s of settings) {
    if (s.setting_key === 'etsy_keystring') etsyKey = s.setting_value;
    if (s.setting_key === 'etsy_shared_secret') etsySecret = s.setting_value;
    if (s.setting_key === 'scraping_api_key') scrapingApiKey = s.setting_value;
    if (s.setting_key === 'serper_api_key') serperApiKey = s.setting_value;
  }

  const workspaces = await sql`
    SELECT user_id, etsy_access_token, etsy_shop_id, scraping_api_key, scraping_provider, cloudflare_worker_url
    FROM user_workspaces 
    ORDER BY updated_at DESC
  `;

  console.log("Settings found:");
  console.log("- Etsy Keystring:", etsyKey ? etsyKey.substring(0, 8) + '...' : 'None');
  console.log("- Etsy Secret:", etsySecret ? 'Yes' : 'None');
  console.log("- Scraping API Key:", scrapingApiKey ? scrapingApiKey.substring(0, 8) + '...' : 'None');
  console.log("- Serper API Key:", serperApiKey ? 'Yes' : 'None');
  console.log("- Total Workspaces:", workspaces.length);
  if (workspaces.length > 0) {
    console.log("- Workspace 0 token:", workspaces[0].etsy_access_token ? 'Present' : 'None');
    console.log("- Workspace 0 shopId:", workspaces[0].etsy_shop_id);
    console.log("- Workspace 0 workerUrl:", workspaces[0].cloudflare_worker_url);
    console.log("- Workspace 0 scrapingApiKey:", workspaces[0].scraping_api_key ? 'Present' : 'None');
  }

  console.log("\n=== 2. Testing Etsy Suggestions / Autocomplete Public API ===");
  const testKw = 'vintage shirt';
  try {
    const suggestRes = await fetch(`https://www.etsy.com/api/v3/ajax/public/search/suggestions?query=${encodeURIComponent(testKw)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    console.log("Suggestions Status:", suggestRes.status);
    if (suggestRes.ok) {
      const data = await suggestRes.json();
      console.log("Suggestions returned count:", data.results?.length);
      console.log("Top suggestions:", data.results?.slice(0, 5).map((r: any) => r.query || r.term));
    }
  } catch (e: any) {
    console.error("Suggestions error:", e.message);
  }

  console.log("\n=== 3. Testing Etsy Open API v3 findAllListingsActive ===");
  if (etsyKey && workspaces.length > 0 && workspaces[0].etsy_access_token) {
    try {
      const headers = {
        'x-api-key': `${etsyKey}:${etsySecret || ''}`,
        'Authorization': `Bearer ${workspaces[0].etsy_access_token}`
      };
      const apiRes = await fetch(`https://openapi.etsy.com/v3/application/listings/active?keywords=${encodeURIComponent(testKw)}&limit=5`, { headers });
      console.log("Etsy Open API Status:", apiRes.status);
      const apiData = await apiRes.json();
      console.log("Etsy Open API Response:", JSON.stringify(apiData).substring(0, 300));
    } catch (e: any) {
      console.error("Etsy Open API error:", e.message);
    }
  } else {
    console.log("Etsy Open API skipped (no key/token)");
  }

  console.log("\n=== 4. Testing Direct Etsy Search HTML Request ===");
  try {
    const searchRes = await fetch(`https://www.etsy.com/search?q=${encodeURIComponent(testKw)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    console.log("Direct Etsy Search Status:", searchRes.status);
    const html = await searchRes.text();
    console.log("Direct HTML length:", html.length);
    const hasCaptcha = html.toLowerCase().includes('captcha') || html.toLowerCase().includes('robot check');
    console.log("Direct HTML has Captcha / Bot Challenge:", hasCaptcha);
    let countMatch = html.match(/([\d,.]+)\s*(?:\+|plus)?\s*results/i) ||
                     html.match(/"total_results"\s*:\s*(\d+)/i) ||
                     html.match(/([\d,.]+)\s*results\s+for/i);
    console.log("Direct HTML count match:", countMatch ? countMatch[0] : 'None');
  } catch (e: any) {
    console.error("Direct Search error:", e.message);
  }

  console.log("\n=== 5. Testing Cloudflare Worker Proxy ===");
  const workerUrl = workspaces[0]?.cloudflare_worker_url || process.env.CLOUDFLARE_WORKER_URL;
  if (workerUrl) {
    try {
      const workerRes = await fetch(`${workerUrl.replace(/\/$/, '')}?q=${encodeURIComponent(testKw)}`);
      console.log("Worker Status:", workerRes.status);
      if (workerRes.ok) {
        const workerData = await workerRes.json();
        console.log("Worker Response:", JSON.stringify(workerData, null, 2));
      }
    } catch (e: any) {
      console.error("Worker error:", e.message);
    }
  } else {
    console.log("No Cloudflare Worker URL");
  }
}

testAll().catch(console.error);
