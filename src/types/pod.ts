import type { AudienceGroup, PodTemplateEtsyListingSettings } from './templates';
export type ApparelType = 'light' | 'dark' | 'any';
export type TargetApparel = 'light' | 'dark' | 'both';
export type ExportFormatType = 'image/webp' | 'image/jpeg' | 'image/png' | 'video/mp4' | string;

export interface PrintArea {
  id: string;
  name: string;
  /** X position as percentage (0 - 100) */
  x: number;
  /** Y position as percentage (0 - 100) */
  y: number;
  /** Width as percentage (0 - 100) */
  width: number;
  /** Height as percentage (0 - 100) */
  height: number;
  /** Rotation angle in degrees (-180 to 180) */
  rotation: number;
}

export interface MockupFolder {
  id: string;
  name: string;
  isCustom?: boolean;
  type?: 'mockup' | 'design'; // if undefined, assume 'mockup'
  /** Mockup klasörü = bir Etsy ilanı: ürünün Etsy kategorisi (admin panelindeki aktif kategorilerden) */
  taxonomyId?: number;
  /** Kategorinin adı (ör. "Hoodies"); ürün tipi ve SKU ön eki buradan */
  categoryName?: string;
  /** Varsayılan varyasyon şablonu (Ayarlar › Varyasyonlar); manuel ilanlar ve otomasyonlar kullanır */
  variationTemplateId?: string;
  variationTemplateName?: string;
  /** Ürünlerin kitlesi: tasarım, niş araştırması ve ilan metni buna göre hazırlanır */
  audienceGroup?: AudienceGroup;
  /** İlandaki ürün modelleri (ör. "Comfort Colors 1717"); ilki ilk görseldeki/videodaki üründür */
  garments?: string[];
  /** Ürün bilgisi (kumaş, kalıp…; İngilizce): yapay zekâ açıklamada ürün özelliği olarak yalnızca bunu kullanır */
  productInfo?: string;
  /** Etsy mağaza ayarları (kargo profili, hazırlık süresi, iade, üretici, otomatik yenileme) */
  etsy?: FolderEtsySettings;
}

/** Klasörün Etsy mağaza ayarları (bkz. folder-listing). */
export type FolderEtsySettings = Partial<Pick<PodTemplateEtsyListingSettings,
  'whoMade' | 'shippingProfileId' | 'readinessStateId' | 'returnPolicyId' | 'productionPartnerIds' | 'shouldAutoRenew'>>;

export interface MockupItem {
  id: string;
  name: string;
  src: string;
  folderId?: string;
  apparelType: ApparelType;
  printAreas: PrintArea[];
  opacity: number;
  width: number;
  height: number;

  /**
   * When false, the mockup is treated as a static visual asset (like size chart, color chart)
   * and print area placement is disabled during rendering.
   * Default: true
   */
  hasPrintArea?: boolean;

  /**
   * When true, this item is a video file (MP4, WebM, MOV) rather than a still image.
   */
  isVideo?: boolean;
  mimeType?: string;

  /**
   * Controls whether rendered export preserves original image aspect ratio ('original')
   * or forces a 1:1 square canvas ('square').
   * Default: 'original'
   */
  exportAspect?: 'original' | 'square';
}

export interface EvaluatedKeyword {
  id: string;
  keyword: string;
  etsy_score?: number | null;
  opportunity_score?: number | null;
  total_listings?: number | null;
  competition_level?: string | null;
  bestseller_count?: number | null;
  is_etsy_suggested?: boolean | null;
  autocomplete_rank?: number | null;
  avg_price?: number | string | null;
  char_length?: number | null;
  tag_eligible?: boolean | null;
  raw_metrics?: Record<string, unknown> | null;
  last_scrape_error?: string | null;
}

export interface DesignItem {
  id: string;
  name: string;
  src: string;
  /**
   * Tasarımın hangi kumaş rengine uygun olduğu, tasarımın tonu üzerinden ifade edilir:
   * 'dark' = koyu tonlu tasarım → AÇIK kumaş; 'light' = açık tonlu tasarım → KOYU kumaş; 'both' = tüm kumaşlar.
   * Arayüzde her zaman kumaş adıyla gösterilir (SLOT_LABELS).
   */
  targetApparel?: TargetApparel;
  isSelected?: boolean;
  width: number;
  height: number;
  /**
   * Yalnızca otomasyon tasarımlarını ayırt etmek için kullanılır (AUTOMATION_DESIGN_FOLDER_ID); eski
   * tasarım klasörü kimlikleri yok sayılır.
   */
  folderId?: string;

  /** Saydam boşlukları kırpılıp kayıpsız PNG olarak yeniden işlendiği zaman (eski tasarımlar bir kez işlenir). */
  optimizedAt?: number;

  /** Üretimde aktif mi? (slot sistemi) */
  isProductionActive?: boolean;

  /** Oluşturulma zamanı */
  createdAt?: number;

  /** Etiketler */
  tags?: string[];

  /** Bu tasarımla açılan ilanların SKU'ları (Tasarımlar sekmesinde SKU ile aranır). */
  skus?: string[];

  /** Yapay zeka tarafından mı üretildi? */
  generatedByAI?: boolean;

  /** Üretimde kullanılan prompt */
  promptUsed?: string;

  /** Sunucuda süren yapay zekâ analizinin başlangıcı (sekme kapansa da sürer; bitince silinir). */
  analysisPendingAt?: number;
  /** Son sunucu analizinin hatası (yeni analizde silinir). */
  analysisError?: string;

  /** AI Analysis results for the design */
  analysis?: {
    description: string;
    keywords: string[];
    analyzedAt: number;
    evaluatedKeywords?: EvaluatedKeyword[];
    discoveredCompetitorTags?: string[];
    primarySubject?: string;
    primaryAesthetic?: string;
    niche?: string;
    userNotes?: string;
    productType?: string;
    taxonomyId?: number | null;
    /** 'vision': görsel yapay zekâ ile analiz edildi; 'automation': otomasyonun konu ve kelimelerinden derlendi. */
    source?: 'vision' | 'automation';
  };

  /** Generated SEO Listing for the design */
  seo?: {
    title: string;
    description: string;
    tags: string[];
    generatedAt: number;
  };
}

export interface MockupPreset {
  id: string;
  title: string;
  apparelType: ApparelType;
  printArea: Omit<PrintArea, 'id' | 'name'>;
}

export interface RenderedMatch {
  id: string;
  mockupId: string;
  mockupName: string;
  mockupApparel: ApparelType;
  folderId: string;
  folderName?: string;
  folderOrderIndex?: number;
  designId: string;
  designName: string;
  designTarget: TargetApparel;
  previewUrl: string;
  exportFileName: string;
  format: ExportFormatType;
  isVideo?: boolean;
  mimeType?: string;
}

/** Etsy varyasyon tablosundaki bir satır (beden × renk). */
export interface EtsyVariationRow {
  id: string;
  size: string;
  color: string;
  price: number;
  quantity: number;
  sku: string;
  enabled: boolean;
}

/** Kullanıcının kaydettiği varyasyon şablonu. */
export interface EtsyVariationTemplate {
  id: string;
  name: string;
  updatedAt?: string;
  variations: EtsyVariationRow[];
}
