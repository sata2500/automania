import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkDb() {
  const { default: sql } = await import('../src/lib/db');
  const rows = await sql`
    SELECT id, keyword, total_listings, competition_level, bestseller_count, is_etsy_suggested, autocomplete_rank, opportunity_score, last_scrape_error, raw_metrics, last_evaluated_at
    FROM keyword_pool
    ORDER BY last_evaluated_at DESC NULLS LAST
    LIMIT 20
  `;
  console.log("Total keywords in pool (sample 20):");
  console.dir(rows, { depth: null });

  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(last_evaluated_at) as evaluated,
      COUNT(last_scrape_error) as errors
    FROM keyword_pool
  `;
  console.log("Pool stats:", stats[0]);
}

checkDb().catch(console.error);
