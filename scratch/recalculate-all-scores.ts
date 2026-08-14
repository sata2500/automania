import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  const { sql } = await import('@/lib/db');
  console.log('🔄 Re-calculating Opportunity Scores for all keywords in database...');
  const rows = await sql`SELECT id, keyword, total_listings, bestseller_count, is_etsy_suggested, autocomplete_rank, avg_price, last_scrape_error FROM keyword_pool`;

  console.log(`Found ${rows.length} keywords in pool.`);
  let updated = 0;

  for (const r of rows) {
    const cleanKeyword = (r.keyword || '').trim();
    const charLength = cleanKeyword.length;
    const tagEligible = charLength <= 20;
    const totalListings = Number(r.total_listings || 0);
    const bestsellerCount = Number(r.bestseller_count || 0);
    const isEtsySuggested = !!r.is_etsy_suggested;
    const autocompleteRank = Number(r.autocomplete_rank || 10);
    const avgPrice = Number(r.avg_price || 0);
    const scrapeError = r.last_scrape_error;

    let opportunityScore = 0;
    if (!scrapeError && totalListings > 0) {
      // 1. Demand Score (40%)
      let demandScore = 30;
      if (isEtsySuggested) {
        if (autocompleteRank === 1) demandScore = 100;
        else if (autocompleteRank === 2) demandScore = 92;
        else if (autocompleteRank === 3) demandScore = 85;
        else if (autocompleteRank === 4) demandScore = 78;
        else if (autocompleteRank === 5) demandScore = 72;
        else demandScore = Math.max(50, 70 - (autocompleteRank - 6) * 5);
      }

      if (bestsellerCount >= 3) {
        demandScore = Math.max(demandScore, 90);
      } else if (bestsellerCount === 2) {
        demandScore = Math.max(demandScore, 75);
      } else if (bestsellerCount === 1) {
        demandScore = Math.max(demandScore, 60);
      }

      // 2. Competition Score (40%)
      let competitionScore = 10;
      if (totalListings < 300) competitionScore = 100;
      else if (totalListings < 750) competitionScore = 95;
      else if (totalListings < 1500) competitionScore = 90;
      else if (totalListings < 3000) competitionScore = 80;
      else if (totalListings < 6000) competitionScore = 70;
      else if (totalListings < 15000) competitionScore = 55;
      else if (totalListings < 35000) competitionScore = 35;
      else if (totalListings < 75000) competitionScore = 20;
      else competitionScore = 10;

      // 3. Commercial & Optimization Score (20%)
      let commercialScore = 20;
      if (tagEligible) commercialScore += 30;
      commercialScore += Math.min(40, bestsellerCount * 12);
      if (avgPrice >= 15 && avgPrice <= 50) commercialScore += 10;
      commercialScore = Math.min(100, commercialScore);

      let baseScore = Math.round(
        (demandScore * 0.40) +
        (competitionScore * 0.40) +
        (commercialScore * 0.20)
      );

      // Hidden Gem bonus (< 1500 listings & >= 2 bestsellers)
      if (totalListings < 1500 && bestsellerCount >= 2) {
        baseScore += 5;
      }
      if (totalListings > 100000) {
        baseScore -= 10;
      }

      opportunityScore = Math.max(1, Math.min(99, baseScore));
    }

    await sql`
      UPDATE keyword_pool
      SET 
        etsy_score = ${opportunityScore},
        opportunity_score = ${opportunityScore}
      WHERE id = ${r.id}
    `;
    updated++;
  }

  console.log(`🎉 Successfully recalculated and updated ${updated} keywords in database!`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
