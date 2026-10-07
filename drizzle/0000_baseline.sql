-- Baseline migration. Idempotent on purpose: production databases were created by
-- older bootstrap scripts, so every table, column and index is created only if missing.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_settings" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"setting_key" varchar(100) NOT NULL,
	"setting_value" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "app_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "setting_key" varchar(100);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "setting_value" text;
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100),
	"resource_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "action" varchar(100);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "resource_type" varchar(100);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "resource_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_runs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"template_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"steps" jsonb DEFAULT '{"designGeneration":{"status":"pending"},"backgroundRemoval":{"status":"pending"},"mockupRender":{"status":"pending"},"videoGeneration":{"status":"pending"},"seoGeneration":{"status":"pending"},"listingCreation":{"status":"pending"}}'::jsonb,
	"generated_design_id" varchar(255),
	"generated_design_url" text,
	"generated_mockup_urls" jsonb DEFAULT '[]'::jsonb,
	"generated_video_url" text,
	"generated_seo" jsonb DEFAULT '{}'::jsonb,
	"generated_listing_id" varchar(100),
	"etsy_listing_id" varchar(100),
	"error_message" text,
	"trigger_type" varchar(50) DEFAULT 'manual',
	"created_at" timestamp DEFAULT now(),
	"started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "template_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "status" varchar(30) DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "steps" jsonb DEFAULT '{"designGeneration":{"status":"pending"},"backgroundRemoval":{"status":"pending"},"mockupRender":{"status":"pending"},"videoGeneration":{"status":"pending"},"seoGeneration":{"status":"pending"},"listingCreation":{"status":"pending"}}'::jsonb;
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "generated_design_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "generated_design_url" text;
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "generated_mockup_urls" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "generated_video_url" text;
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "generated_seo" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "generated_listing_id" varchar(100);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "etsy_listing_id" varchar(100);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "error_message" text;
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "trigger_type" varchar(50) DEFAULT 'manual';
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "started_at" timestamp;
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "etsy_taxonomy_cache" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(500) NOT NULL,
	"path" varchar(1000),
	"is_active" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "etsy_taxonomy_cache" ADD COLUMN IF NOT EXISTS "name" varchar(500);
--> statement-breakpoint
ALTER TABLE "etsy_taxonomy_cache" ADD COLUMN IF NOT EXISTS "path" varchar(1000);
--> statement-breakpoint
ALTER TABLE "etsy_taxonomy_cache" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "etsy_taxonomy_cache" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_runs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"job_type" varchar(100) NOT NULL,
	"status" varchar(30) DEFAULT 'queued' NOT NULL,
	"idempotency_key" varchar(255),
	"request_hash" varchar(128),
	"progress" jsonb DEFAULT '{"completed":0,"total":0}'::jsonb,
	"result" jsonb DEFAULT '{}'::jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now(),
	"started_at" timestamp,
	"finished_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "job_type" varchar(100);
--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "status" varchar(30) DEFAULT 'queued' NOT NULL;
--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(255);
--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "request_hash" varchar(128);
--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "progress" jsonb DEFAULT '{"completed":0,"total":0}'::jsonb;
--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "result" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "error" text;
--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "started_at" timestamp;
--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "finished_at" timestamp;
--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "keyword_pool" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"keyword" varchar(255) NOT NULL,
	"usage_count" integer DEFAULT 1,
	"etsy_score" integer DEFAULT 0,
	"last_evaluated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"total_listings" integer DEFAULT 0,
	"competition_level" varchar(50) DEFAULT 'Henüz Taranmadı',
	"bestseller_count" integer DEFAULT 0,
	"is_etsy_suggested" boolean DEFAULT false,
	"autocomplete_rank" integer DEFAULT 0,
	"char_length" integer DEFAULT 0,
	"tag_eligible" boolean DEFAULT true,
	"opportunity_score" integer DEFAULT 0,
	"avg_price" numeric(10, 2) DEFAULT '0',
	"last_scrape_error" varchar(1000),
	"raw_metrics" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "keyword_pool_keyword_unique" UNIQUE("keyword")
);
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "keyword" varchar(255);
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "usage_count" integer DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "etsy_score" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "last_evaluated_at" timestamp;
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "total_listings" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "competition_level" varchar(50) DEFAULT 'Henüz Taranmadı';
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "bestseller_count" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "is_etsy_suggested" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "autocomplete_rank" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "char_length" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "tag_eligible" boolean DEFAULT true;
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "opportunity_score" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "avg_price" numeric(10, 2) DEFAULT '0';
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "last_scrape_error" varchar(1000);
--> statement-breakpoint
ALTER TABLE "keyword_pool" ADD COLUMN IF NOT EXISTS "raw_metrics" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pod_templates" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"mockup_config" jsonb DEFAULT '{"printAreaMockupIds":[],"staticMockupIds":[],"videoMockupIds":[],"fabricType":"all","multiPrintAreaSupport":false}'::jsonb,
	"variation_config" jsonb DEFAULT '{"rows":[],"sizes":[],"colors":[]}'::jsonb,
	"seo_hints" jsonb DEFAULT '{"productType":"","targetAudience":"","customNotes":"","primaryNiche":""}'::jsonb,
	"automation_schedule" jsonb DEFAULT '{"enabled":false,"cronExpression":"0 9 * * *","timezone":"America/New_York","nextRunAt":null,"listingsPerRun":1,"publishMode":"draft"}'::jsonb,
	"is_active" boolean DEFAULT true,
	"last_run_at" timestamp,
	"total_listings_generated" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE "pod_templates" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "pod_templates" ADD COLUMN IF NOT EXISTS "name" varchar(255);
--> statement-breakpoint
ALTER TABLE "pod_templates" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "pod_templates" ADD COLUMN IF NOT EXISTS "mockup_config" jsonb DEFAULT '{"printAreaMockupIds":[],"staticMockupIds":[],"videoMockupIds":[],"fabricType":"all","multiPrintAreaSupport":false}'::jsonb;
--> statement-breakpoint
ALTER TABLE "pod_templates" ADD COLUMN IF NOT EXISTS "variation_config" jsonb DEFAULT '{"rows":[],"sizes":[],"colors":[]}'::jsonb;
--> statement-breakpoint
ALTER TABLE "pod_templates" ADD COLUMN IF NOT EXISTS "seo_hints" jsonb DEFAULT '{"productType":"","targetAudience":"","customNotes":"","primaryNiche":""}'::jsonb;
--> statement-breakpoint
ALTER TABLE "pod_templates" ADD COLUMN IF NOT EXISTS "automation_schedule" jsonb DEFAULT '{"enabled":false,"cronExpression":"0 9 * * *","timezone":"America/New_York","nextRunAt":null,"listingsPerRun":1,"publishMode":"draft"}'::jsonb;
--> statement-breakpoint
ALTER TABLE "pod_templates" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
--> statement-breakpoint
ALTER TABLE "pod_templates" ADD COLUMN IF NOT EXISTS "last_run_at" timestamp;
--> statement-breakpoint
ALTER TABLE "pod_templates" ADD COLUMN IF NOT EXISTS "total_listings_generated" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "pod_templates" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "pod_templates" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_etsy_listings" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"listing_id" varchar(100) NOT NULL,
	"shop_id" varchar(100),
	"title" text,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"materials" jsonb DEFAULT '[]'::jsonb,
	"price" numeric(10, 2) DEFAULT '0',
	"currency_code" varchar(10) DEFAULT 'USD',
	"quantity" integer DEFAULT 999,
	"state" varchar(50) DEFAULT 'active',
	"url" text,
	"views" integer DEFAULT 0,
	"num_favorers" integer DEFAULT 0,
	"images" jsonb DEFAULT '[]'::jsonb,
	"primary_image_url" text,
	"taxonomy_id" integer,
	"taxonomy_path" varchar(500),
	"vision_analysis" jsonb DEFAULT '{}'::jsonb,
	"seo_score" integer DEFAULT 0,
	"seo_evaluation" jsonb DEFAULT '{}'::jsonb,
	"ai_optimized_title" text,
	"ai_optimized_description" text,
	"ai_optimized_tags" jsonb DEFAULT '[]'::jsonb,
	"ai_optimized_at" timestamp,
	"etsy_updated_timestamp" bigint,
	"last_synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "listing_id" varchar(100);
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "shop_id" varchar(100);
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "title" text;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "materials" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "price" numeric(10, 2) DEFAULT '0';
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "currency_code" varchar(10) DEFAULT 'USD';
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "quantity" integer DEFAULT 999;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "state" varchar(50) DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "url" text;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "views" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "num_favorers" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "images" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "primary_image_url" text;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "taxonomy_id" integer;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "taxonomy_path" varchar(500);
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "vision_analysis" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "seo_score" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "seo_evaluation" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "ai_optimized_title" text;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "ai_optimized_description" text;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "ai_optimized_tags" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "ai_optimized_at" timestamp;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "etsy_updated_timestamp" bigint;
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "user_etsy_listings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_etsy_shops" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"shop_id" varchar(100) NOT NULL,
	"shop_name" varchar(255),
	"shop_url" text,
	"icon_url" text,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"pkce_verifier" varchar(500),
	"pkce_state" varchar(500),
	"total_active_listings" integer DEFAULT 0,
	"total_draft_listings" integer DEFAULT 0,
	"avg_seo_score" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"is_primary" boolean DEFAULT false,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "shop_id" varchar(100);
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "shop_name" varchar(255);
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "shop_url" text;
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "icon_url" text;
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "access_token" text;
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "refresh_token" text;
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "token_expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "pkce_verifier" varchar(500);
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "pkce_state" varchar(500);
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "total_active_listings" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "total_draft_listings" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "avg_seo_score" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp;
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_workspaces" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"mockups" jsonb DEFAULT '[]'::jsonb,
	"designs" jsonb DEFAULT '[]'::jsonb,
	"folders" jsonb DEFAULT '[]'::jsonb,
	"active_folder_id" varchar(255),
	"selected_mockup_id" varchar(255),
	"openrouter_key" varchar(500),
	"openrouter_model" varchar(255),
	"etsy_product_types" text,
	"etsy_user_notes" text,
	"etsy_variation_templates" jsonb DEFAULT '[]'::jsonb,
	"etsy_default_templates" jsonb DEFAULT '{}'::jsonb,
	"etsy_custom_sizes" jsonb DEFAULT '[]'::jsonb,
	"etsy_custom_colors" jsonb DEFAULT '[]'::jsonb,
	"etsy_generated_mockups" jsonb DEFAULT '[]'::jsonb,
	"scraping_provider" varchar(100) DEFAULT 'scraperapi',
	"cloudflare_worker_url" varchar(500),
	"scraping_api_key" varchar(500),
	"etsy_access_token" text,
	"etsy_refresh_token" text,
	"etsy_token_expires_at" timestamp,
	"etsy_shop_id" varchar(200),
	"etsy_pkce_verifier" varchar(500),
	"etsy_pkce_state" varchar(500),
	"etsy_variation_template" jsonb,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "mockups" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "designs" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "folders" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "active_folder_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "selected_mockup_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "openrouter_key" varchar(500);
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "openrouter_model" varchar(255);
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_product_types" text;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_user_notes" text;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_variation_templates" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_default_templates" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_custom_sizes" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_custom_colors" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_generated_mockups" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "scraping_provider" varchar(100) DEFAULT 'scraperapi';
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "cloudflare_worker_url" varchar(500);
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "scraping_api_key" varchar(500);
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_access_token" text;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_refresh_token" text;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_token_expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_shop_id" varchar(200);
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_pkce_verifier" varchar(500);
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_pkce_state" varchar(500);
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "etsy_variation_template" jsonb;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255),
	"avatar_url" varchar(1000),
	"role" varchar(50) DEFAULT 'user',
	"status" varchar(50) DEFAULT 'active',
	"provider" varchar(50) DEFAULT 'google',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_login_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" varchar(255);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" varchar(255);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" varchar(1000);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" varchar(50) DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider" varchar(50) DEFAULT 'google';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp DEFAULT now();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_created" ON "audit_logs" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action_created" ON "audit_logs" USING btree ("action","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_runs_template_id_idx" ON "automation_runs" USING btree ("template_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_runs_user_status_idx" ON "automation_runs" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_runs_created_at_idx" ON "automation_runs" USING btree ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_job_runs_user_idempotency" ON "job_runs" USING btree ("user_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_runs_status" ON "job_runs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pod_templates_user_id_idx" ON "pod_templates" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pod_templates_active_idx" ON "pod_templates" USING btree ("is_active");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_etsy_listings_user_listing_idx" ON "user_etsy_listings" USING btree ("user_id","listing_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_etsy_listings_user_id" ON "user_etsy_listings" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_etsy_listings_listing_id" ON "user_etsy_listings" USING btree ("listing_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_etsy_listings_state" ON "user_etsy_listings" USING btree ("state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_etsy_listings_seo_score" ON "user_etsy_listings" USING btree ("seo_score");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_etsy_listings_etsy_updated" ON "user_etsy_listings" USING btree ("etsy_updated_timestamp");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_etsy_shops_user_id_idx" ON "user_etsy_shops" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_etsy_shops_shop_id_idx" ON "user_etsy_shops" USING btree ("user_id","shop_id");
--> statement-breakpoint
ALTER TABLE "user_workspaces" ALTER COLUMN "etsy_refresh_token" TYPE text;
--> statement-breakpoint
ALTER TABLE "user_workspaces" ALTER COLUMN "etsy_product_types" TYPE text;
--> statement-breakpoint
ALTER TABLE "user_etsy_shops" ALTER COLUMN "refresh_token" TYPE text;
