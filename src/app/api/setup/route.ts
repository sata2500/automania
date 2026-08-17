import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');



    await sql`
      CREATE TABLE IF NOT EXISTS user_workspaces (
        user_id VARCHAR(255) PRIMARY KEY,
        mockups JSONB DEFAULT '[]'::jsonb,
        designs JSONB DEFAULT '[]'::jsonb,
        folders JSONB DEFAULT '[]'::jsonb,
        active_folder_id VARCHAR(255),
        selected_mockup_id VARCHAR(255),
        openrouter_key VARCHAR(500),
        openrouter_model VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(50) DEFAULT 'active',
        provider VARCHAR(50) DEFAULT 'google',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

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

    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS openrouter_key VARCHAR(500)`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS openrouter_model VARCHAR(255)`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS scraping_api_key VARCHAR(500)`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS scraping_provider VARCHAR(100) DEFAULT 'scraperapi'`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS cloudflare_worker_url VARCHAR(500)`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_product_types TEXT`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_user_notes TEXT`;

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
        last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_user_etsy_listings_user_id ON user_etsy_listings(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_etsy_listings_listing_id ON user_etsy_listings(listing_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_etsy_listings_state ON user_etsy_listings(state)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_etsy_listings_seo_score ON user_etsy_listings(seo_score)`;

    // Seed default admin user into PostgreSQL users table if not existing
    await sql`
      INSERT INTO users (id, name, email, role, status, provider)
      VALUES ('user-demo-101', 'Salih TANRISEVEN', 'salihtanriseven25@gmail.com', 'admin', 'active', 'google')
      ON CONFLICT (email) DO NOTHING
    `;
    
    return NextResponse.json({ success: true, message: 'Veritabanı tabloları başarıyla oluşturuldu/kontrol edildi.' });
  } catch (error: any) {
    console.error('Setup Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
