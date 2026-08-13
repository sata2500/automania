import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';
import { scrapeEtsyKeywordData } from '../src/lib/etsy-scraper';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const targetKeywords = [
    'dracula family',
    'dracula tee',
    'sunflower dragonfly',
    'dragonfly graphic',
    'dragonfly shirt',
    'dragonfly art'
  ];

  console.log('=== CURRENT DB RECORDS FOR TARGET KEYWORDS ===');
  const rows = await sql`
    SELECT keyword, total_listings, competition_level, bestseller_count, is_etsy_suggested, autocomplete_rank, opportunity_score, raw_metrics, last_scrape_error
    FROM keyword_pool
    WHERE keyword = ANY(${targetKeywords})
  `;
  console.log(JSON.stringify(rows, null, 2));

  console.log('\n=== TESTING SCRAPING WITH NEW UPDATED SYSTEM ===');
  for (const kw of targetKeywords) {
    console.log(`\n--- Scraping keyword: "${kw}" ---`);
    const res = await scrapeEtsyKeywordData(kw, { workerUrl: process.env.CLOUDFLARE_WORKER_URL });
    console.log('Scrape Result:', JSON.stringify(res, null, 2));
  }
}

main().catch(console.error);
