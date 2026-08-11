const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

async function main() {
    try {
        const rows = await sql`SELECT user_id, etsy_access_token, etsy_shop_id FROM user_workspaces LIMIT 1`;
        if (rows.length === 0) return console.log("No workspace found");
        const user = rows[0];
        
        const settings = await sql`SELECT setting_key, setting_value FROM app_settings`;
        let key = process.env.ETSY_API_KEY, secret = process.env.ETSY_SHARED_SECRET;
        settings.forEach(r => {
            if (r.setting_key === 'etsy_keystring') key = r.setting_value;
            if (r.setting_key === 'etsy_shared_secret') secret = r.setting_value;
        });

        const headers = {
          'x-api-key': `${key}:${secret || ''}`,
          'Authorization': `Bearer ${user.etsy_access_token}`
        };

        const res = await fetch(`https://openapi.etsy.com/v3/application/shops/${user.etsy_shop_id}/listings?state=active&limit=10`, { headers });
        const data = await res.json();
        
        if (!data.results) {
            console.log("No listings found", data);
            return;
        }

        for (let listing of data.results) {
            console.log(`\n======================================`);
            console.log(`Listing ID: ${listing.listing_id} | Title: ${listing.title.substring(0,30)}... | Taxonomy ID: ${listing.taxonomy_id}`);
            
            // Fetch properties
            const propsRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${user.etsy_shop_id}/listings/${listing.listing_id}/properties`, { headers });
            const props = await propsRes.json();
            console.log("PROPERTIES:");
            console.log(JSON.stringify(props.results?.map(p => ({id: p.property_id, name: p.property_name, values: p.values})), null, 2));

            // Fetch inventory
            const invRes = await fetch(`https://openapi.etsy.com/v3/application/listings/${listing.listing_id}/inventory`, { headers });
            const inv = await invRes.json();
            console.log("INVENTORY:");
            console.log(JSON.stringify(inv.products?.[0]?.property_values, null, 2));
        }
    } catch(e) {
        console.error(e);
    }
}
main();
