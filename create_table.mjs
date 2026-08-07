import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }
  
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS keyword_pool (
        id VARCHAR(255) PRIMARY KEY,
        keyword VARCHAR(255) UNIQUE NOT NULL,
        usage_count INT DEFAULT 1,
        etsy_score INT DEFAULT 0,
        total_listings INT DEFAULT 0,
        competition_level VARCHAR(50) DEFAULT 'Henüz Taranmadı',
        bestseller_count INT DEFAULT 0,
        is_etsy_suggested BOOLEAN DEFAULT FALSE,
        autocomplete_rank INT DEFAULT 0,
        char_length INT DEFAULT 0,
        tag_eligible BOOLEAN DEFAULT TRUE,
        opportunity_score INT DEFAULT 0,
        avg_price NUMERIC(10,2) DEFAULT 0,
        last_scrape_error VARCHAR(1000) DEFAULT NULL,
        raw_metrics JSONB DEFAULT '{}'::jsonb,
        last_evaluated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS scraping_api_key VARCHAR(500)`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS scraping_provider VARCHAR(100) DEFAULT 'scraperapi'`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS cloudflare_worker_url VARCHAR(500)`;
    await sql`UPDATE user_workspaces SET cloudflare_worker_url = 'https://automania-etsy-proxy.salihtanriseven25.workers.dev'`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_pkce_verifier VARCHAR(500)`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_pkce_state VARCHAR(500)`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_refresh_token VARCHAR(500)`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_token_expires_at TIMESTAMP`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_access_token TEXT`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_shop_id VARCHAR(200)`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_variation_template JSONB`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_variation_templates JSONB`;

    // Ensure app_settings table exists
    await sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        id VARCHAR(50) PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    
    console.log('Table keyword_pool updated with new columns successfully.');
  } catch (error) {
    console.error('Error creating/updating table:', error);
  }
}

main();
