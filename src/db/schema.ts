import { pgTable, varchar, jsonb, timestamp, integer, boolean, numeric, text } from 'drizzle-orm/pg-core';
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
