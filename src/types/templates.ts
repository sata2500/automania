/**
 * Şablon Sistemi TypeScript Tip Tanımları
 * =========================================
 * POD şablonları, otomasyon çalıştırmaları ve Etsy mağaza yönetimi için tip tanımları.
 */

import { ApparelType } from './pod';

// ─── Şablon Yapılandırma Tipleri ─────────────────────────────────────────────

/** Mockup ve görsel konfigürasyonu */
export interface PodTemplateMockupConfig {
  /** Baskı alanı olan mockupların ID listesi (ETSY limiti: max 18) */
  printAreaMockupIds: string[];
  /** Baskı alanı olmayan mockupların ID listesi (size chart, color chart vb.) */
  staticMockupIds: string[];
  /** Video mockupların ID listesi (ETSY limiti: max 2) */
  videoMockupIds: string[];
  /** Hedeflenen kumaş rengi türü */
  fabricType: 'light' | 'dark' | 'all';
  /** Birden fazla baskı alanı desteği */
  multiPrintAreaSupport: boolean;
}

/** Tek bir varyasyon satırı */
export interface TemplateVariationRow {
  id: string;
  size: string;
  color: string;
  price: number;
  quantity: number;
  sku: string;
  enabled: boolean;
}

/** Varyasyon konfigürasyonu */
export interface PodTemplateVariationConfig {
  /** Varyasyon satırları (renk + beden + fiyat + adet kombinasyonları) */
  rows: TemplateVariationRow[];
  /** Mevcut beden listesi */
  sizes: string[];
  /** Mevcut renk listesi */
  colors: string[];
  /** Temel fiyat (varyasyon satırları bu fiyattan türetilir) */
  basePrice?: number;
}

/** SEO ipuçları ve ürün notları */
export interface PodTemplateSeoHints {
  /** Ürün tipi (örn: "T-Shirt", "Hoodie", "Mug") */
  productType: string;
  /** Hedef kitle (örn: "Dog lovers", "Gamers", "Mom gifts") */
  targetAudience: string;
  /** Özel notlar (AI prompt'unu zenginleştirecek bilgiler) */
  customNotes: string;
  /** Birincil niş (örn: "Funny Pet Quotes", "Vintage Retro") */
  primaryNiche: string;
}

/** Otomasyon zamanlama konfigürasyonu */
export interface PodTemplateAutomationSchedule {
  /** Otomasyon aktif mi? */
  enabled: boolean;
  /** Cron ifadesi (örn: "0 9 * * *" = her gün saat 09:00) */
  cronExpression: string;
  /** Saat dilimi (örn: "America/New_York") */
  timezone: string;
  /** Bir sonraki çalışma zamanı (null = henüz hesaplanmadı) */
  nextRunAt: string | null;
  /** Her çalışmada üretilecek listing sayısı */
  listingsPerRun: number;
  /** Yayın modu: 'draft' = taslak, 'active' = direkt yayın */
  publishMode: 'draft' | 'active';
}

// ─── Şablon Ana Tipi ─────────────────────────────────────────────────────────

/** Tam şablon objesi (DB'den dönen) */
export interface PodTemplate {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  mockupConfig: PodTemplateMockupConfig;
  variationConfig: PodTemplateVariationConfig;
  seoHints: PodTemplateSeoHints;
  automationSchedule: PodTemplateAutomationSchedule;
  isActive: boolean;
  lastRunAt: string | null;
  totalListingsGenerated: number;
  createdAt: string;
  updatedAt: string;
}

/** Şablon oluşturma/güncelleme için input tipi */
export interface PodTemplateInput {
  name: string;
  description?: string;
  mockupConfig: PodTemplateMockupConfig;
  variationConfig: PodTemplateVariationConfig;
  seoHints: PodTemplateSeoHints;
  automationSchedule: PodTemplateAutomationSchedule;
  isActive?: boolean;
}

// ─── Otomasyon Çalıştırma Tipleri ────────────────────────────────────────────

/** Tek bir otomasyon adımının durumu */
export interface AutomationStepResult {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: Record<string, unknown>;
}

/** Tüm otomasyon adımları */
export interface AutomationRunSteps {
  designGeneration: AutomationStepResult;
  backgroundRemoval: AutomationStepResult;
  mockupRender: AutomationStepResult;
  videoGeneration: AutomationStepResult;
  seoGeneration: AutomationStepResult;
  listingCreation: AutomationStepResult;
}

/** Üretilen SEO verisi */
export interface GeneratedSeoData {
  title: string;
  description: string;
  tags: string[];
  taxonomyId: number | null;
  taxonomyProperties: Record<string, unknown>;
  keywords: string[];
}

/** Tam otomasyon çalıştırma kaydı */
export interface AutomationRun {
  id: string;
  templateId: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: AutomationRunSteps;
  generatedDesignId: string | null;
  generatedDesignUrl: string | null;
  generatedMockupUrls: string[];
  generatedVideoUrl: string | null;
  generatedSeo: GeneratedSeoData | null;
  generatedListingId: string | null;
  etsyListingId: string | null;
  errorMessage: string | null;
  triggerType: 'manual' | 'scheduled' | 'cron';
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

// ─── Etsy Mağaza Tipleri ─────────────────────────────────────────────────────

/** Etsy mağaza kaydı */
export interface UserEtsyShop {
  id: string;
  userId: string;
  shopId: string;
  shopName: string | null;
  shopUrl: string | null;
  iconUrl: string | null;
  isActive: boolean;
  isPrimary: boolean;
  totalActiveListings: number;
  totalDraftListings: number;
  avgSeoScore: number;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Yardımcı Tipler ─────────────────────────────────────────────────────────

/** Şablon listesi API yanıtı */
export interface TemplatesListResponse {
  templates: PodTemplate[];
  total: number;
}

/** Şablon oluşturma API yanıtı */
export interface TemplateCreateResponse {
  template: PodTemplate;
  message: string;
}

/** Otomasyon başlatma yanıtı */
export interface AutomationRunResponse {
  runId: string;
  status: string;
  message: string;
}

/** Pipeline adım adları */
export type AutomationStepName = keyof AutomationRunSteps;
