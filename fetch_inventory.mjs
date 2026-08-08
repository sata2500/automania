import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local'});
const sql = neon(process.env.DATABASE_URL);

async function checkListing() {
  try {
    const workspaceRows = await sql`SELECT etsy_access_token FROM user_workspaces LIMIT 1`;
    const token = workspaceRows[0].etsy_access_token;
    const listingId = '4551849311'; // ID from user's screenshot
    
    // API KEY
    const settingsRows = await sql`SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('etsy_keystring', 'etsy_shared_secret')`;
    let etsyApiKey = process.env.ETSY_API_KEY;
    let etsySharedSecret = process.env.ETSY_SHARED_SECRET;
    for (const row of settingsRows) {
      if (row.setting_key === 'etsy_keystring') etsyApiKey = row.setting_value;
      if (row.setting_key === 'etsy_shared_secret') etsySharedSecret = row.setting_value;
    }

    const res = await fetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`, {
      method: 'GET',
      headers: {
        'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));

  } catch (e) {
    console.error(e);
  }
}
checkListing();
