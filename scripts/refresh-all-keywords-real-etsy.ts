import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function refreshAllKeywords() {
  const { default: sql } = await import('../src/lib/db');
  const { scrapeEtsyKeywordData } = await import('../src/lib/etsy-scraper');
  const { getValidEtsyToken } = await import('../src/lib/etsy-token-manager');

  console.log('--- STARTING REAL ETSY KEYWORD REFRESH ---');

  // 1. Fetch Etsy OAuth Token
  const workspaces = await sql`
    SELECT user_id, etsy_shop_id 
    FROM user_workspaces 
    WHERE etsy_access_token IS NOT NULL 
    LIMIT 1
  `;

  if (workspaces.length === 0) {
    console.error('No workspace with Etsy token found!');
    process.exit(1);
  }

  const tokenRes = await getValidEtsyToken(workspaces[0].user_id);
  if (!tokenRes.success || !tokenRes.access_token) {
    console.error('Failed to get valid Etsy token:', tokenRes.error);
    process.exit(1);
  }

  console.log(`✅ Valid Etsy Token obtained for Shop ID: ${tokenRes.shop_id || workspaces[0].etsy_shop_id}`);

  // 2. Fetch all keywords from keyword_pool
  const allKeywords = await sql`
    SELECT id, keyword, total_listings, opportunity_score, last_scrape_error 
    FROM keyword_pool 
    ORDER BY usage_count DESC, id ASC
  `;

  console.log(`Found ${allKeywords.length} total keywords in database to evaluate.`);

  let updatedCount = 0;
  let blockedCount = 0;

  for (let i = 0; i < allKeywords.length; i++) {
    const item = allKeywords[i];
    process.stdout.write(`[${i + 1}/${allKeywords.length}] Evaluating "${item.keyword}"... `);

    try {
      const scraped = await scrapeEtsyKeywordData(item.keyword, {
        etsyAccessToken: tokenRes.access_token,
        etsyApiKey: tokenRes.api_key,
        etsySharedSecret: tokenRes.shared_secret
      });

      if (scraped.scrapeError) {
        blockedCount++;
        console.log(`❌ BLOCKED: ${scraped.scrapeError}`);
      } else {
        updatedCount++;
        console.log(`✅ REAL ETSY: Listings=${scraped.totalListings.toLocaleString()}, Score=${scraped.opportunityScore}, Sug=${scraped.isEtsySuggested ? `#${scraped.autocompleteRank}` : 'No'}, AvgPrice=$${scraped.avgPrice}`);
      }

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
        WHERE id = ${item.id}
      `;

      // 250ms throttle between keywords to stay well within Etsy rate limits (10 req/sec)
      await new Promise(r => setTimeout(r, 250));
    } catch (e: any) {
      console.log(`⚠️ ERROR: ${e.message}`);
    }
  }

  console.log(`\n================================`);
  console.log(`FINISHED! Updated: ${updatedCount}, Blocked/Error: ${blockedCount}, Total: ${allKeywords.length}`);
}

refreshAllKeywords().catch(console.error);
