import { neon } from '@neondatabase/serverless';

// Fetch the DATABASE_URL from environment variables
const sql = neon(process.env.DATABASE_URL!);

export async function ensureKeywordPoolColumns() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS keyword_pool (
        id VARCHAR(255) PRIMARY KEY,
        keyword VARCHAR(255) UNIQUE NOT NULL,
        usage_count INT DEFAULT 1,
        etsy_score INT DEFAULT 0,
        last_evaluated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`ALTER TABLE keyword_pool ADD COLUMN IF NOT EXISTS total_listings INT DEFAULT 0`;
    await sql`ALTER TABLE keyword_pool ADD COLUMN IF NOT EXISTS competition_level VARCHAR(50) DEFAULT 'Henüz Taranmadı'`;
    await sql`ALTER TABLE keyword_pool ADD COLUMN IF NOT EXISTS bestseller_count INT DEFAULT 0`;
    await sql`ALTER TABLE keyword_pool ADD COLUMN IF NOT EXISTS is_etsy_suggested BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE keyword_pool ADD COLUMN IF NOT EXISTS autocomplete_rank INT DEFAULT 0`;
    await sql`ALTER TABLE keyword_pool ADD COLUMN IF NOT EXISTS char_length INT DEFAULT 0`;
    await sql`ALTER TABLE keyword_pool ADD COLUMN IF NOT EXISTS tag_eligible BOOLEAN DEFAULT TRUE`;
    await sql`ALTER TABLE keyword_pool ADD COLUMN IF NOT EXISTS opportunity_score INT DEFAULT 0`;
    await sql`ALTER TABLE keyword_pool ADD COLUMN IF NOT EXISTS avg_price NUMERIC(10,2) DEFAULT 0`;
    await sql`ALTER TABLE keyword_pool ADD COLUMN IF NOT EXISTS last_scrape_error VARCHAR(1000) DEFAULT NULL`;
    await sql`ALTER TABLE keyword_pool ADD COLUMN IF NOT EXISTS raw_metrics JSONB DEFAULT '{}'::jsonb`;
  } catch (e) {
    console.warn('ensureKeywordPoolColumns warning:', e);
  }
}

export default sql;
