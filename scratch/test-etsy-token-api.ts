import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testToken() {
  const { default: sql } = await import('../src/lib/db');
  const { getValidEtsyToken } = await import('../src/lib/etsy-token-manager');

  const workspaces = await sql`SELECT user_id, etsy_shop_id FROM user_workspaces WHERE etsy_access_token IS NOT NULL`;
  console.log("Found workspaces with tokens:", workspaces);

  for (const w of workspaces) {
    console.log(`\nTesting token refresh for user ${w.user_id} (shop ${w.etsy_shop_id})...`);
    const tokenRes = await getValidEtsyToken(w.user_id);
    console.log("Token result:", tokenRes.success, tokenRes.error || "Valid token obtained!");
    if (tokenRes.success && tokenRes.access_token) {
      const headers = {
        'x-api-key': `${tokenRes.api_key}:${tokenRes.shared_secret || ''}`,
        'Authorization': `Bearer ${tokenRes.access_token}`
      };
      
      console.log("\nTesting Etsy Open API v3 findAllListingsActive (keywords=vintage shirt)...");
      const res = await fetch(`https://openapi.etsy.com/v3/application/listings/active?keywords=vintage%20shirt&limit=5`, { headers });
      console.log("API Status:", res.status);
      const data = await res.json();
      console.log("Total Count (data.count):", data.count);
      console.log("Results count:", data.results?.length);
      if (data.results && data.results.length > 0) {
        console.log("First listing title:", data.results[0].title);
        console.log("First listing price:", data.results[0].price);
        console.log("First listing views/favs:", data.results[0].views, data.results[0].num_favorers);
        console.log("First listing tags:", data.results[0].tags);
      }
    }
  }
}

testToken().catch(console.error);
