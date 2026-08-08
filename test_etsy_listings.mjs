import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    const ws = await sql`SELECT etsy_access_token, etsy_shop_id FROM user_workspaces WHERE etsy_access_token IS NOT NULL LIMIT 1`;
    const settingsRows = await sql`SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('etsy_keystring', 'etsy_shared_secret')`;
    
    let etsyApiKey = process.env.ETSY_API_KEY;
    let etsySharedSecret = process.env.ETSY_SHARED_SECRET;
    for (const row of settingsRows) {
      if (row.setting_key === 'etsy_keystring') etsyApiKey = row.setting_value;
      if (row.setting_key === 'etsy_shared_secret') etsySharedSecret = row.setting_value;
    }

    if (ws.length > 0) {
      const { etsy_access_token, etsy_shop_id } = ws[0];
      
      console.log('Fetching listings...');
      const res = await fetch(`https://openapi.etsy.com/v3/application/shops/${etsy_shop_id}/listings?state=active&limit=5`, {
        headers: {
          'x-api-key': `${etsyApiKey}:${etsySharedSecret}`,
          'Authorization': `Bearer ${etsy_access_token}`
        }
      });
      console.log('Status:', res.status);
      const data = await res.json();
      console.log(data);
      
      if (data.results && data.results.length > 0) {
        const listingId = data.results[0].listing_id;
        console.log('Fetching inventory for listing', listingId);
        const invRes = await fetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`, {
          headers: {
            'x-api-key': `${etsyApiKey}:${etsySharedSecret}`,
            'Authorization': `Bearer ${etsy_access_token}`
          }
        });
        console.log('Inventory Status:', invRes.status);
        console.log(JSON.stringify(await invRes.json(), null, 2));
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
