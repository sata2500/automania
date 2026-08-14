import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  const { sql } = await import('@/lib/db');
  const rows = await sql`
    SELECT keyword, total_listings, bestseller_count, is_etsy_suggested, autocomplete_rank, opportunity_score 
    FROM keyword_pool 
    WHERE keyword ILIKE '%scholar%' OR keyword ILIKE '%american tradition%'
  `;
  console.log('RESULTS:', JSON.stringify(rows, null, 2));
  process.exit(0);
}

main();
