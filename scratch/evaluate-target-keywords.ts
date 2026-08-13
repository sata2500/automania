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

  console.log('=== YENİ SİSTEM İLE CANLI TARAMA VE GÜNCELLEME BAŞLIYOR ===\n');

  for (const kw of targetKeywords) {
    console.log(`🔎 Taratılıyor: "${kw}"...`);
    const res = await scrapeEtsyKeywordData(kw, {
      workerUrl: process.env.CLOUDFLARE_WORKER_URL
    });

    console.log(`  📊 Sonuç:`, {
      totalListings: res.totalListings,
      competitionLevel: res.competitionLevel,
      isEtsySuggested: res.isEtsySuggested,
      autocompleteRank: res.autocompleteRank,
      opportunityScore: res.opportunityScore,
      rawMetrics: res.rawMetrics
    });

    // Update database record
    await sql`
      UPDATE keyword_pool 
      SET 
        total_listings = ${res.totalListings},
        competition_level = ${res.competitionLevel},
        bestseller_count = ${res.bestsellerCount},
        is_etsy_suggested = ${res.isEtsySuggested},
        autocomplete_rank = ${res.autocompleteRank},
        opportunity_score = ${res.opportunityScore},
        avg_price = ${res.avgPrice},
        raw_metrics = ${JSON.stringify(res.rawMetrics)},
        last_scrape_error = ${res.scrapeError},
        last_evaluated_at = NOW()
      WHERE keyword = ${kw}
    `;
    console.log(`  ✅ Veritabanında güncellendi!`);
  }

  console.log('\n=== GÜNCEL VERİTABANI KAYITLARI ===');
  const rows = await sql`
    SELECT keyword, total_listings, competition_level, bestseller_count, is_etsy_suggested, autocomplete_rank, opportunity_score, raw_metrics, last_evaluated_at
    FROM keyword_pool
    WHERE keyword = ANY(${targetKeywords})
  `;
  console.table(rows);
}

main().catch(console.error);
