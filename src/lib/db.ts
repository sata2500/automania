import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@/db/schema';

// Fetch the DATABASE_URL from environment variables
const client = neon(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });

// Keep the raw sql export for backwards compatibility where needed
export const sql = client;

export async function ensureKeywordPoolColumns() {
  console.log('Database init warning: Schema migrations should be handled by Drizzle ORM.');
}

export async function ensureUserEtsyListingsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS user_etsy_listings (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        listing_id VARCHAR(100) NOT NULL,
        shop_id VARCHAR(100),
        title TEXT,
        description TEXT,
        tags JSONB DEFAULT '[]'::jsonb,
        materials JSONB DEFAULT '[]'::jsonb,
        price NUMERIC(10,2) DEFAULT 0,
        currency_code VARCHAR(10) DEFAULT 'USD',
        quantity INT DEFAULT 999,
        state VARCHAR(50) DEFAULT 'active',
        url TEXT,
        views INT DEFAULT 0,
        num_favorers INT DEFAULT 0,
        images JSONB DEFAULT '[]'::jsonb,
        primary_image_url TEXT,
        taxonomy_id INT,
        taxonomy_path VARCHAR(500),
        vision_analysis JSONB DEFAULT '{}'::jsonb,
        seo_score INT DEFAULT 0,
        seo_evaluation JSONB DEFAULT '{}'::jsonb,
        ai_optimized_title TEXT,
        ai_optimized_description TEXT,
        ai_optimized_tags JSONB DEFAULT '[]'::jsonb,
        ai_optimized_at TIMESTAMP,
        etsy_updated_timestamp BIGINT,
        last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`ALTER TABLE user_etsy_listings ADD COLUMN IF NOT EXISTS etsy_updated_timestamp BIGINT`.catch(() => {});
    await sql`CREATE INDEX IF NOT EXISTS idx_user_etsy_listings_user_id ON user_etsy_listings(user_id)`.catch(() => {});
    await sql`CREATE INDEX IF NOT EXISTS idx_user_etsy_listings_listing_id ON user_etsy_listings(listing_id)`.catch(() => {});
    await sql`CREATE INDEX IF NOT EXISTS idx_user_etsy_listings_state ON user_etsy_listings(state)`.catch(() => {});
    await sql`CREATE INDEX IF NOT EXISTS idx_user_etsy_listings_seo_score ON user_etsy_listings(seo_score)`.catch(() => {});
    await sql`CREATE INDEX IF NOT EXISTS idx_user_etsy_listings_etsy_updated ON user_etsy_listings(etsy_updated_timestamp)`.catch(() => {});
  } catch (err) {
    console.error('ensureUserEtsyListingsTable error:', err);
  }
}

export default client;
