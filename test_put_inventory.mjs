import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local'});
const sql = neon(process.env.DATABASE_URL);

async function testPut() {
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

    const headers = {
        'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const invGetRes = await fetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`, {
      method: 'GET',
      headers
    });
    
    const currentInv = await invGetRes.json();
    let readiness_state_id = undefined;
    if (currentInv.products && currentInv.products.length > 0 && currentInv.products[0].offerings && currentInv.products[0].offerings.length > 0) {
      readiness_state_id = currentInv.products[0].offerings[0].readiness_state_id;
    }

    console.log("Readiness state ID is:", readiness_state_id);

    const payload = {
      products: [
        {
          sku: "TEST-1",
          property_values: [
            { property_id: 513, property_name: "Size", values: ["M"] },
            { property_id: 514, property_name: "Color", values: ["Red"] }
          ],
          offerings: [
            {
              price: 15.99,
              quantity: 100,
              is_enabled: true,
              ...(readiness_state_id ? { readiness_state_id } : {})
            }
          ]
        },
        {
          sku: "TEST-2",
          property_values: [
            { property_id: 513, property_name: "Size", values: ["L"] },
            { property_id: 514, property_name: "Color", values: ["Red"] }
          ],
          offerings: [
            {
              price: 16.99,
              quantity: 50,
              is_enabled: true,
              ...(readiness_state_id ? { readiness_state_id } : {})
            }
          ]
        }
      ],
      price_on_property: [513, 514],
      quantity_on_property: [513, 514],
      sku_on_property: [513, 514]
    };

    const invRes = await fetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    });

    if (invRes.ok) {
      console.log("SUCCESS PUT");
    } else {
      console.log("FAIL PUT", await invRes.text());
    }

  } catch (e) {
    console.error(e);
  }
}
testPut();
