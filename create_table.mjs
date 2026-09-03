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
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_pkce_verifier VARCHAR(500)`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_pkce_state VARCHAR(500)`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_refresh_token VARCHAR(500)`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_token_expires_at TIMESTAMP`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_access_token TEXT`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_shop_id VARCHAR(200)`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_variation_template JSONB`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_variation_templates JSONB`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_default_templates JSONB DEFAULT '{}'::jsonb`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_custom_sizes JSONB DEFAULT '[]'::jsonb`;
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_custom_colors JSONB DEFAULT '[]'::jsonb`;

    // Ensure app_settings table exists
    await sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        id VARCHAR(50) PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS etsy_taxonomy_cache (
        id INT PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        path VARCHAR(1000),
        is_active BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100),
        resource_id VARCHAR(255),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at)`;

    await sql`
      CREATE TABLE IF NOT EXISTS job_runs (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        job_type VARCHAR(100) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'queued',
        idempotency_key VARCHAR(255),
        request_hash VARCHAR(128),
        progress JSONB NOT NULL DEFAULT '{"completed":0,"total":0}'::jsonb,
        result JSONB NOT NULL DEFAULT '{}'::jsonb,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        finished_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_user_idempotency ON job_runs(user_id, idempotency_key)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_job_runs_status ON job_runs(status)`;

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

    // Ensure user_etsy_listings table exists
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

    // ─── YENİ: Şablon Sistemi Tabloları ─────────────────────────────────────

    await sql`
      CREATE TABLE IF NOT EXISTS pod_templates (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        mockup_config JSONB NOT NULL DEFAULT '{
          "printAreaMockupIds": [],
          "staticMockupIds": [],
          "videoMockupIds": [],
          "fabricType": "all",
          "multiPrintAreaSupport": false
        }'::jsonb,
        variation_config JSONB NOT NULL DEFAULT '{
          "rows": [],
          "sizes": [],
          "colors": []
        }'::jsonb,
        seo_hints JSONB NOT NULL DEFAULT '{
          "productType": "",
          "targetAudience": "",
          "customNotes": "",
          "primaryNiche": ""
        }'::jsonb,
        automation_schedule JSONB NOT NULL DEFAULT '{
          "enabled": false,
          "cronExpression": "0 9 * * *",
          "timezone": "America/New_York",
          "nextRunAt": null,
          "listingsPerRun": 1,
          "publishMode": "draft"
        }'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        last_run_at TIMESTAMP,
        total_listings_generated INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS pod_templates_user_id_idx ON pod_templates(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS pod_templates_active_idx ON pod_templates(is_active)`;

    await sql`
      CREATE TABLE IF NOT EXISTS automation_runs (
        id VARCHAR(255) PRIMARY KEY,
        template_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        steps JSONB NOT NULL DEFAULT '{
          "designGeneration": {"status":"pending"},
          "backgroundRemoval": {"status":"pending"},
          "mockupRender": {"status":"pending"},
          "videoGeneration": {"status":"pending"},
          "seoGeneration": {"status":"pending"},
          "listingCreation": {"status":"pending"}
        }'::jsonb,
        generated_design_id VARCHAR(255),
        generated_design_url TEXT,
        generated_mockup_urls JSONB DEFAULT '[]'::jsonb,
        generated_video_url TEXT,
        generated_seo JSONB DEFAULT '{}'::jsonb,
        generated_listing_id VARCHAR(100),
        etsy_listing_id VARCHAR(100),
        error_message TEXT,
        trigger_type VARCHAR(50) DEFAULT 'manual',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS automation_runs_template_id_idx ON automation_runs(template_id)`;
    await sql`CREATE INDEX IF NOT EXISTS automation_runs_user_status_idx ON automation_runs(user_id, status)`;
    await sql`CREATE INDEX IF NOT EXISTS automation_runs_created_at_idx ON automation_runs(created_at)`;

    await sql`
      CREATE TABLE IF NOT EXISTS user_etsy_shops (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        shop_id VARCHAR(100) NOT NULL,
        shop_name VARCHAR(255),
        shop_url TEXT,
        icon_url TEXT,
        access_token TEXT,
        refresh_token VARCHAR(500),
        token_expires_at TIMESTAMP,
        pkce_verifier VARCHAR(500),
        pkce_state VARCHAR(500),
        total_active_listings INT DEFAULT 0,
        total_draft_listings INT DEFAULT 0,
        avg_seo_score INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        is_primary BOOLEAN DEFAULT FALSE,
        last_synced_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS user_etsy_shops_user_id_idx ON user_etsy_shops(user_id)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS user_etsy_shops_shop_id_idx ON user_etsy_shops(user_id, shop_id)`;

    // ─────────────────────────────────────────────────────────────────────────

    console.log('✅ Tüm tablolar başarıyla oluşturuldu/güncellendi.');
    console.log('   - pod_templates (Şablon sistemi)');
    console.log('   - automation_runs (Otomasyon çalıştırma kayıtları)');
    console.log('   - user_etsy_shops (Çoklu mağaza desteği)');
  } catch (error) {
    console.error('Error creating/updating table:', error instanceof Error ? error.message : 'unknown error');
    process.exitCode = 1;
  }
}

main();

