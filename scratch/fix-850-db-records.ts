import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { default: sql, ensureKeywordPoolColumns } = await import('../src/lib/db');
  const { scrapeEtsyKeywordData } = await import('../src/lib/etsy-scraper');

  await ensureKeywordPoolColumns();

  console.log('Finding all database rows with 850 / 4200 listings or Proxy Worker fallbacks...');

  const rows = await sql`
    SELECT id, keyword, total_listings, raw_metrics 
    FROM keyword_pool 
    WHERE total_listings = 850 
       OR total_listings = 4200 
       OR raw_metrics::text LIKE '%viaWorker%'
       OR raw_metrics::text LIKE '%ddg_etsy_index%'
    ORDER BY id ASC
  `;

  console.log(`Found ${rows.length} rows to re-evaluate with 100% Real SERP Indexing.`);

  let count = 0;
  for (const r of rows as any[]) {
    console.log(`\n[${++count}/${rows.length}] Re-evaluating "${r.keyword}"...`);
    const scraped = await scrapeEtsyKeywordData(r.keyword);

    await sql`
      UPDATE keyword_pool 
      SET 
        etsy_score = ${scraped.opportunityScore},
        opportunity_score = ${scraped.opportunityScore},
        total_listings = ${scraped.totalListings},
        competition_level = ${scraped.competitionLevel},
        bestseller_count = ${scraped.bestsellerCount},
        is_etsy_suggested = ${scraped.isEtsySuggested},
        autocomplete_rank = ${scraped.autocompleteRank},
        char_length = ${scraped.charLength},
        tag_eligible = ${scraped.tagEligible},
        avg_price = ${scraped.avgPrice},
        last_scrape_error = ${scraped.scrapeError},
        raw_metrics = ${JSON.stringify(scraped.rawMetrics)},
        last_evaluated_at = CURRENT_TIMESTAMP
      WHERE id = ${r.id}
    `;

    console.log(` -> Updated "${r.keyword}": Total Listings = ${scraped.totalListings.toLocaleString()}, Score = ${scraped.opportunityScore}, Method = ${scraped.rawMetrics?.method || 'bing_etsy_index'}`);
    
    // Brief 300ms pause
    await new Promise(res => setTimeout(res, 300));
  }

  console.log('\n✅ All 850 / Proxy Worker records in database have been successfully upgraded to SERP Index live data!');
}

main();
