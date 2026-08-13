import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function resetFakeKeywordScores() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env.local!');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('🔍 Checking keyword_pool for fake / synthetic scores...');

  try {
    const fakeRows = await sql`
      SELECT id, keyword, total_listings 
      FROM keyword_pool 
      WHERE total_listings IN (850, 3500, 3850, 4200)
         OR raw_metrics->>'method' = 'ddg_etsy_index'
    `;

    console.log(`📊 Found ${fakeRows.length} keywords with synthetic fallback listing counts (850, 3500, 3850, 4200).`);

    if (fakeRows.length === 0) {
      console.log('✅ No fake keyword scores found. Database is clean!');
      return;
    }

    const resetRes = await sql`
      UPDATE keyword_pool 
      SET 
        total_listings = 0,
        etsy_score = 0,
        opportunity_score = 0,
        bestseller_count = 0,
        competition_level = 'Taranacak',
        last_evaluated_at = NULL,
        last_scrape_error = NULL
      WHERE total_listings IN (850, 3500, 3850, 4200)
         OR raw_metrics->>'method' = 'ddg_etsy_index'
    `;

    console.log(`✅ Successfully reset ${fakeRows.length} fake keyword entries in keyword_pool! They are now ready to be re-evaluated with real Etsy data.`);

  } catch (error) {
    console.error('❌ Error resetting fake keyword scores:', error);
  }
}

resetFakeKeywordScores();
