import { pgTable, varchar, jsonb, timestamp, integer, boolean, numeric, text, bigint, index, uniqueIndex } from 'drizzle-orm/pg-core';

import { sql } from 'drizzle-orm';
import { MockupItem, DesignItem, MockupFolder, RenderedMatch } from '@/types/pod';
import {
  PodTemplateMockupConfig,
  PodTemplateVariationConfig,
  PodTemplateSeoHints,
  PodTemplateAutomationSchedule,
  AutomationRunSteps,
} from '@/types/templates';

export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).unique(),
  avatarUrl: varchar('avatar_url', { length: 1000 }),
  role: varchar('role', { length: 50 }).default('user'),
  status: varchar('status', { length: 50 }).default('active'),
  provider: varchar('provider', { length: 50 }).default('google'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at').defaultNow(),
});

export const userWorkspaces = pgTable('user_workspaces', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  mockups: jsonb('mockups').$type<MockupItem[]>().default([]),
  designs: jsonb('designs').$type<DesignItem[]>().default([]),
  folders: jsonb('folders').$type<MockupFolder[]>().default([]),
  activeFolderId: varchar('active_folder_id', { length: 255 }),
  selectedMockupId: varchar('selected_mockup_id', { length: 255 }),
  openrouterKey: varchar('openrouter_key', { length: 500 }),
  openrouterModel: varchar('openrouter_model', { length: 255 }),
  etsyProductTypes: text('etsy_product_types'),
  etsyUserNotes: text('etsy_user_notes'),
  etsyVariationTemplates: jsonb('etsy_variation_templates').default([]),
  etsyDefaultTemplates: jsonb('etsy_default_templates').$type<Record<number, string>>().default({}),
  etsyCustomSizes: jsonb('etsy_custom_sizes').$type<string[]>().default([]),
  etsyCustomColors: jsonb('etsy_custom_colors').$type<string[]>().default([]),
  etsyGeneratedMockups: jsonb('etsy_generated_mockups').$type<RenderedMatch[]>().default([]),

  /** Scraper ayarları (API anahtarı yalnızca şifreli global ayarlarda tutulur) */
  scrapingProvider: varchar('scraping_provider', { length: 100 }).default('scraperapi'),
  cloudflareWorkerUrl: varchar('cloudflare_worker_url', { length: 500 }),
  /** @deprecated Eski düz metin kopya; `npm run db:encrypt-secrets` ile temizlenir. */
  scrapingApiKey: varchar('scraping_api_key', { length: 500 }),

  /** Etsy OAuth (token'lar secret-box ile şifreli saklanır) */
  etsyAccessToken: text('etsy_access_token'),
  etsyRefreshToken: text('etsy_refresh_token'),
  etsyTokenExpiresAt: timestamp('etsy_token_expires_at'),
  etsyShopId: varchar('etsy_shop_id', { length: 200 }),
  etsyPkceVerifier: varchar('etsy_pkce_verifier', { length: 500 }),
  etsyPkceState: varchar('etsy_pkce_state', { length: 500 }),
  /** @deprecated Tekil eski alan; `etsy_variation_templates` kullanılır. */
  etsyVariationTemplate: jsonb('etsy_variation_template'),

  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const keywordPool = pgTable('keyword_pool', {
  id: varchar('id', { length: 255 }).primaryKey(),
  keyword: varchar('keyword', { length: 255 }).unique().notNull(),
  usageCount: integer('usage_count').default(1),
  etsyScore: integer('etsy_score').default(0),
  lastEvaluatedAt: timestamp('last_evaluated_at'),
  createdAt: timestamp('created_at').defaultNow(),
  totalListings: integer('total_listings').default(0),
  competitionLevel: varchar('competition_level', { length: 50 }).default('Henüz Taranmadı'),
  bestsellerCount: integer('bestseller_count').default(0),
  isEtsySuggested: boolean('is_etsy_suggested').default(false),
  autocompleteRank: integer('autocomplete_rank').default(0),
  charLength: integer('char_length').default(0),
  tagEligible: boolean('tag_eligible').default(true),
  opportunityScore: integer('opportunity_score').default(0),
  avgPrice: numeric('avg_price', { precision: 10, scale: 2 }).default('0'),
  lastScrapeError: varchar('last_scrape_error', { length: 1000 }),
  rawMetrics: jsonb('raw_metrics').default({}),
});

export const appSettings = pgTable('app_settings', {
  id: varchar('id', { length: 50 }).primaryKey(),
  settingKey: varchar('setting_key', { length: 100 }).unique().notNull(),
  settingValue: text('setting_value'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const etsyTaxonomyCache = pgTable('etsy_taxonomy_cache', {
  id: integer('id').primaryKey(),
  name: varchar('name', { length: 500 }).notNull(),
  path: varchar('path', { length: 1000 }),
  isActive: boolean('is_active').default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 100 }),
  resourceId: varchar('resource_id', { length: 255 }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userCreatedIdx: index('idx_audit_logs_user_created').on(table.userId, table.createdAt),
  actionCreatedIdx: index('idx_audit_logs_action_created').on(table.action, table.createdAt),
}));

export const jobRuns = pgTable('job_runs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  jobType: varchar('job_type', { length: 100 }).notNull(),
  status: varchar('status', { length: 30 }).default('queued').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  requestHash: varchar('request_hash', { length: 128 }),
  progress: jsonb('progress').$type<{ completed: number; total: number; message?: string }>().default({ completed: 0, total: 0 }),
  result: jsonb('result').default({}),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdempotencyIdx: uniqueIndex('idx_job_runs_user_idempotency').on(table.userId, table.idempotencyKey),
  statusIdx: index('idx_job_runs_status').on(table.status),
}));

export const userEtsyListings = pgTable('user_etsy_listings', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  listingId: varchar('listing_id', { length: 100 }).notNull(),
  shopId: varchar('shop_id', { length: 100 }),
  title: text('title'),
  description: text('description'),
  tags: jsonb('tags').$type<string[]>().default([]),
  materials: jsonb('materials').$type<string[]>().default([]),
  price: numeric('price', { precision: 10, scale: 2 }).default('0'),
  currencyCode: varchar('currency_code', { length: 10 }).default('USD'),
  quantity: integer('quantity').default(999),
  state: varchar('state', { length: 50 }).default('active'),
  url: text('url'),
  views: integer('views').default(0),
  numFavorers: integer('num_favorers').default(0),
  images: jsonb('images').$type<Array<Record<string, unknown>>>().default([]),
  primaryImageUrl: text('primary_image_url'),
  taxonomyId: integer('taxonomy_id'),
  taxonomyPath: varchar('taxonomy_path', { length: 500 }),
  visionAnalysis: jsonb('vision_analysis').default({}),
  seoScore: integer('seo_score').default(0),
  seoEvaluation: jsonb('seo_evaluation').default({}),
  aiOptimizedTitle: text('ai_optimized_title'),
  aiOptimizedDescription: text('ai_optimized_description'),
  aiOptimizedTags: jsonb('ai_optimized_tags').$type<string[]>().default([]),
  aiOptimizedAt: timestamp('ai_optimized_at'),
  etsyUpdatedTimestamp: bigint('etsy_updated_timestamp', { mode: 'number' }),
  lastSyncedAt: timestamp('last_synced_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userListingIdx: uniqueIndex('user_etsy_listings_user_listing_idx').on(table.userId, table.listingId),
  userIdIdx: index('idx_user_etsy_listings_user_id').on(table.userId),
  listingIdIdx: index('idx_user_etsy_listings_listing_id').on(table.listingId),
  stateIdx: index('idx_user_etsy_listings_state').on(table.state),
  seoScoreIdx: index('idx_user_etsy_listings_seo_score').on(table.seoScore),
  etsyUpdatedIdx: index('idx_user_etsy_listings_etsy_updated').on(table.etsyUpdatedTimestamp),
}));

// ─── Şablon Sistemi ──────────────────────────────────────────────────────────

/**
 * POD Şablon Tablosu — Kullanıcının tasarladığı otomasyon şablonları
 * Her şablon: mockup seçimi, varyasyonlar, SEO ipuçları ve zamanlama içerir.
 */
export const podTemplates = pgTable('pod_templates', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  /** Mockup ve görsel konfigürasyonu */
  mockupConfig: jsonb('mockup_config').$type<PodTemplateMockupConfig>().default({
    printAreaMockupIds: [],
    staticMockupIds: [],
    videoMockupIds: [],
    fabricType: 'all',
    multiPrintAreaSupport: false,
  }),

  /** Varyasyon konfigürasyonu (renk/beden/fiyat/adet) */
  variationConfig: jsonb('variation_config').$type<PodTemplateVariationConfig>().default({
    rows: [],
    sizes: [],
    colors: [],
  }),

  /** SEO ipuçları ve ürün notları */
  seoHints: jsonb('seo_hints').$type<PodTemplateSeoHints>().default({
    productType: '',
    targetAudience: '',
    customNotes: '',
    primaryNiche: '',
  }),

  /** Otomasyon zamanlama konfigürasyonu */
  automationSchedule: jsonb('automation_schedule').$type<PodTemplateAutomationSchedule>().default({
    enabled: false,
    cronExpression: '0 9 * * *',
    timezone: 'America/New_York',
    nextRunAt: null,
    listingsPerRun: 1,
    publishMode: 'draft',
  }),

  /** Şablon aktif mi? (devre dışı bırakılabilir) */
  isActive: boolean('is_active').default(true),

  /** Son otomatik çalışma zamanı */
  lastRunAt: timestamp('last_run_at'),

  /** Toplam üretilen listing sayısı */
  totalListingsGenerated: integer('total_listings_generated').default(0),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userIdIdx: index('pod_templates_user_id_idx').on(table.userId),
  activeIdx: index('pod_templates_active_idx').on(table.isActive),
}));

/**
 * Otomasyon Çalıştırma Kaydı — Her otomatik listing üretiminin izlenmesi
 */
export const automationRuns = pgTable('automation_runs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  templateId: varchar('template_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),

  /** Çalışma durumu */
  status: varchar('status', { length: 30 }).default('pending').notNull(),
  // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

  /** Her adımın sonucu */
  steps: jsonb('steps').$type<AutomationRunSteps>().default({
    designGeneration: { status: 'pending' },
    backgroundRemoval: { status: 'pending' },
    mockupRender: { status: 'pending' },
    videoGeneration: { status: 'pending' },
    seoGeneration: { status: 'pending' },
    listingCreation: { status: 'pending' },
  }),

  /** Üretilen kaynaklar */
  generatedDesignId: varchar('generated_design_id', { length: 255 }),
  generatedDesignUrl: text('generated_design_url'),
  generatedMockupUrls: jsonb('generated_mockup_urls').$type<string[]>().default([]),
  generatedVideoUrl: text('generated_video_url'),
  generatedSeo: jsonb('generated_seo').default({}),
  generatedListingId: varchar('generated_listing_id', { length: 100 }),
  etsyListingId: varchar('etsy_listing_id', { length: 100 }),

  /** Hata mesajı */
  errorMessage: text('error_message'),

  /** Tetiklenme türü */
  triggerType: varchar('trigger_type', { length: 50 }).default('manual'),
  // 'manual' | 'scheduled' | 'cron'

  createdAt: timestamp('created_at').defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  templateIdIdx: index('automation_runs_template_id_idx').on(table.templateId),
  userIdStatusIdx: index('automation_runs_user_status_idx').on(table.userId, table.status),
  createdAtIdx: index('automation_runs_created_at_idx').on(table.createdAt),
}));

/**
 * Kullanıcı Etsy Mağazaları — Çoklu mağaza desteği
 */
export const userEtsyShops = pgTable('user_etsy_shops', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),

  /** Etsy mağaza kimliği ve adı */
  shopId: varchar('shop_id', { length: 100 }).notNull(),
  shopName: varchar('shop_name', { length: 255 }),
  shopUrl: text('shop_url'),
  iconUrl: text('icon_url'),

  /** OAuth token'ları (bu mağaza için) */
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),

  /** PKCE flow geçici veriler */
  pkceVerifier: varchar('pkce_verifier', { length: 500 }),
  pkceState: varchar('pkce_state', { length: 500 }),

  /** Mağaza istatistikleri (son sync'ten) */
  totalActiveListings: integer('total_active_listings').default(0),
  totalDraftListings: integer('total_draft_listings').default(0),
  avgSeoScore: integer('avg_seo_score').default(0),

  /** Bağlantı durumu */
  isActive: boolean('is_active').default(true),
  isPrimary: boolean('is_primary').default(false),
  lastSyncedAt: timestamp('last_synced_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('user_etsy_shops_user_id_idx').on(table.userId),
  shopIdIdx: uniqueIndex('user_etsy_shops_shop_id_idx').on(table.userId, table.shopId),
}));


