import { pgTable, varchar, jsonb, timestamp, integer, boolean, numeric, text, bigint, index, uniqueIndex } from 'drizzle-orm/pg-core';

import { sql } from 'drizzle-orm';
import { MockupItem, DesignItem, MockupFolder, RenderedMatch } from '@/types/pod';

export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).unique(),
  avatarUrl: varchar('avatar_url', { length: 1000 }),
  role: varchar('role', { length: 50 }).default('user'),
  status: varchar('status', { length: 50 }).default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
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
  etsyProductTypes: varchar('etsy_product_types', { length: 1000 }),
  etsyUserNotes: text('etsy_user_notes'),
  etsyVariationTemplates: jsonb('etsy_variation_templates').default([]),
  etsyDefaultTemplates: jsonb('etsy_default_templates').$type<Record<number, string>>().default({}),
  etsyCustomSizes: jsonb('etsy_custom_sizes').$type<string[]>().default([]),
  etsyCustomColors: jsonb('etsy_custom_colors').$type<string[]>().default([]),
  etsyGeneratedMockups: jsonb('etsy_generated_mockups').$type<RenderedMatch[]>().default([]),
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
  userIdIdempotencyIdx: uniqueIndex('job_runs_user_id_idempotency_idx').on(table.userId, table.idempotencyKey),
  statusIdx: index('job_runs_status_idx').on(table.status),
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
  images: jsonb('images').$type<any[]>().default([]),
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
});


