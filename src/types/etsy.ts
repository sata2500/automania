import type { SeoEvaluationResult, VisionAnalysisData } from '@/lib/etsy-seo-evaluator';

/**
 * Etsy OpenAPI v3 yanıtlarından uygulamada kullanılan alanlar.
 * Etsy ek alanlar da döndürebilir; burada yalnızca okunanlar tiplenmiştir.
 */

export interface EtsyShippingProfile {
  shipping_profile_id: number | string;
  title: string;
}

export interface EtsyReadinessState {
  readiness_state_id: number | string;
  readiness_state?: string;
  processing_days_display_label?: string;
  min_processing_time?: number;
  max_processing_time?: number;
}

export interface EtsyShopSection {
  shop_section_id: number | string;
  title: string;
}

export interface EtsyReturnPolicy {
  return_policy_id: number | string;
  accepts_returns?: boolean;
  accepts_exchanges?: boolean;
  return_deadline?: number | null;
}

export interface EtsyTaxonomyPropertyValue {
  value_id: number;
  name: string;
}

export interface EtsyTaxonomyProperty {
  property_id: number;
  name: string;
  display_name?: string;
  is_required?: boolean;
  is_multivalued?: boolean;
  supports_attributes?: boolean;
  supports_variations?: boolean;
  possible_values?: EtsyTaxonomyPropertyValue[];
  selected_values?: EtsyTaxonomyPropertyValue[];
  scales?: Array<{ scale_id: number; display_name: string }>;
}

/** Bir listing'e atanmış özellik değeri. */
export interface EtsyListingPropertyValue {
  property_id: number;
  property_name?: string;
  value_ids?: number[];
  values?: string[];
  scale_id?: number | null;
}

export interface EtsyMoney {
  amount: number;
  divisor: number;
  currency_code?: string;
}

export interface EtsyInventoryOffering {
  price?: EtsyMoney;
  quantity?: number;
  is_enabled?: boolean;
}

export interface EtsyInventoryProduct {
  sku?: string;
  is_deleted?: boolean;
  property_values?: EtsyListingPropertyValue[];
  offerings?: EtsyInventoryOffering[];
}

/** /api/etsy/listings tarafından döndürülen (veritabanından okunan) listing satırı. */
export interface StoredEtsyListing {
  id?: string;
  listing_id: string;
  title?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  materials?: string[] | null;
  price?: string | number | null;
  currency_code?: string | null;
  quantity?: number | null;
  state?: string | null;
  url?: string | null;
  views?: number | string | null;
  num_favorers?: number | string | null;
  primary_image_url?: string | null;
  images?: Array<{ url_570xN?: string; url_fullxfull?: string; url_170x135?: string }> | null;
  taxonomy_id?: number | null;
  taxonomy_path?: string | null;
  shop_section_id?: number | string | null;
  seo_score?: number | string | null;
  /** JSONB; eski kayıtlarda JSON string olarak gelebilir. */
  seo_evaluation?: SeoEvaluationResult | string | null;
  /** JSONB; eski kayıtlarda JSON string olarak gelebilir. */
  vision_analysis?: (VisionAnalysisData & Record<string, unknown>) | string | null;
  ai_optimized_title?: string | null;
  ai_optimized_description?: string | null;
  ai_optimized_tags?: string[] | string | null;
  ai_optimized_at?: string | null;
  last_synced_at?: string | null;
  [key: string]: unknown;
}

/** Toplu işlem uç noktalarının (optimize, evaluate-seo, update...) ilan başına sonucu. */
export interface ListingBatchResult {
  listingId?: string;
  success: boolean;
  error?: string;
  [key: string]: unknown;
}
