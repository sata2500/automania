/**
 * Şablon Sistemi TypeScript Tip Tanımları
 * =========================================
 * POD şablonları, otomasyon çalıştırmaları ve Etsy mağaza yönetimi için tip tanımları.
 */

import type { SeoEvaluationResult } from '@/lib/etsy-seo-evaluator';


// ─── Şablon Yapılandırma Tipleri ─────────────────────────────────────────────

/** Mockup ve görsel konfigürasyonu */
export interface PodTemplateMockupConfig {
  /** Şablonun bağlı olduğu mockup klasörü (klasör menüsündeki "Otomasyon Şablonu" bu kaydı açar) */
  folderId?: string;
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
  /** Etsy SEO sekmesinde kaydedilen varyasyon şablonu: çalıştırmada güncel hali kullanılır (satırlar yedektir) */
  sourceTemplateId?: string;
  sourceTemplateName?: string;
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
  /** 'auto': niş, hedef kitle ve stil her çalıştırmada yapay zekâ araştırmasıyla belirlenir */
  nicheMode?: 'auto' | 'manual';
  /** Otomatik modda araştırmayı yönlendiren genel çerçeve (isteğe bağlı, ör. "aile ve evcil hayvan esprileri") */
  researchFocus?: string;
  /** Klasördeki ürünlerin kitlesi: tasarım, niş araştırması ve ilan metni buna göre hazırlanır */
  audienceGroup?: AudienceGroup;
  /** İlandaki ürün modelleri (ör. "Comfort Colors 1717"); ilki ilk görseldeki/videodaki üründür */
  garments?: string[];
  /** Ana tasarımın hangi kumaş rengi için hazırlanacağı */
  designFabric?: DesignFabric;
  /** Klasörde diğer kumaş renginde mockup varsa o kumaş için yapay zekâ ile ayrı bir versiyon üretilsin mi */
  fabricVariant?: boolean;
}

export type AudienceGroup = 'men' | 'women' | 'unisex' | 'kids' | 'baby';
/** 'universal': hem açık hem koyu kumaşta iyi duran tek tasarım; 'light'/'dark': o kumaş rengi için */
export type DesignFabric = 'universal' | 'light' | 'dark';

/** Otomasyonun Etsy'de açacağı taslak ilanın mağaza ayarları */
export interface PodTemplateEtsyListingSettings {
  /** Kargo profili (zorunlu; yoksa ilan adımı atlanır) */
  shippingProfileId: string;
  /** Hazırlık süresi (zorunlu) */
  readinessStateId: string;
  returnPolicyId?: string;
  shopSectionId?: string;
  /** Etsy kategori (taxonomy) kimliği */
  taxonomyId: number;
  /** Varyasyon yoksa kullanılacak fiyat */
  price: number;
  whoMade: 'i_did' | 'someone_else' | 'collective';
  whenMade: string;
  /** Üretim ortakları (baskı firması); Etsy baskı hizmetiyle üretilen ürünlerde ister */
  productionPartnerIds?: string[];
  /** Süresi dolunca ilan otomatik yenilensin mi (Etsy yenileme ücreti alır) */
  shouldAutoRenew?: boolean;
  /** Paketli ürün ağırlığı ve ölçüleri (hesaplanan kargo ve alıcı bilgisi için) */
  itemWeight?: number;
  itemWeightUnit?: 'oz' | 'lb' | 'g' | 'kg';
  itemLength?: number;
  itemWidth?: number;
  itemHeight?: number;
  itemDimensionsUnit?: 'in' | 'cm';
}

/** Tanıtım videosunun çekim tarzı */
export type AutomationVideoStyle = 'mannequin' | 'flatlay' | 'lifestyle';

/** Otomasyonun ürettiği tanıtım videosu ayarları */
export interface AutomationVideoSettings {
  /** Videonun yönü: yatay (16:9) veya dikey (9:16). Video modelleri kare desteklemez. */
  aspectRatio?: '16:9' | '9:16';
  /** Eski kayıtlar: model artık admin panelinden okunur */
  model?: string;
  style?: AutomationVideoStyle;
  notes?: string;
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
  /** Yayın modu: otomasyon güvenlik için her zaman taslak oluşturur ('active' eski kayıtlarla uyumluluk için). */
  publishMode: 'draft' | 'active';
  /** Her çalıştırmada video üretilsin mi? (Maliyetli; varsayılan kapalı) */
  generateVideo?: boolean;
  /** SEO metni üretilip Etsy'de taslak ilan açılsın mı? Kapalı/yoksa "kuru çalıştırma": yalnızca görseller üretilir. */
  createListing?: boolean;
  /**
   * İlan nasıl gönderilsin: 'review' (varsayılan) ilanı Hazır İlanlar'da incelemeye bekletir, onaylanınca
   * (hemen veya zamanlanmış olarak) Etsy'de yayına alınır; 'draft' doğrudan Etsy'de taslak açar.
   */
  listingMode?: 'review' | 'draft';
  /** Etsy taslak ilan ayarları */
  etsy?: PodTemplateEtsyListingSettings;
  /** Tanıtım videosu ayarları (generateVideo açıkken) */
  video?: AutomationVideoSettings;
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
  /** Adımın kaç kez başlatıldığı: süre sınırında kesilip sürdürülen adım sonsuza dek denenmez. */
  attempts?: number;
}

/** Tüm otomasyon adımları */
export interface AutomationRunSteps {
  nicheResearch?: AutomationStepResult;
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
  /** Yapay zekânın mağaza bölümleri arasından seçtiği bölüm (yoksa null) */
  shopSectionId?: string | null;
  shopSectionTitle?: string | null;
  /** Yapay zekânın seçtiği Etsy malzemeleri ve stilleri */
  materials?: string[];
  styles?: string[];
  /** İlan fotoğraflarının alt metinleri (sırayla) */
  imageAltTexts?: string[];
  /** Üretim anındaki SEO değerlendirmesi (v2: kurallar, Etsy verisi, yapay zekâ incelemesi) */
  evaluation?: SeoEvaluationResult;
}

/** Hazır İlanlar (inceleme kuyruğu) durumu */
export type ListingReviewStatus = 'awaiting' | 'scheduled' | 'publishing' | 'published' | 'rejected' | 'failed';

/** İnceleme kuyruğundaki ilanın durumu; ilan adımının çıktısında (`steps.listingCreation.output.review`) tutulur. */
export interface ListingReviewState {
  status: ListingReviewStatus;
  /** Zamanlanmış yayın anı (ISO) */
  scheduledAt?: string | null;
  publishedAt?: string | null;
  listingUrl?: string | null;
  error?: string | null;
  /** İlana eklenecek fotoğraflar, sıralı (yoksa üretilen tüm fotoğraflar) */
  photos?: string[];
  /** Video ilana eklensin mi (varsayılan: evet) */
  includeVideo?: boolean;
  /** İncelemede elle değiştirilmiş ilan SKU'su (yoksa otomasyonun ürettiği) */
  sku?: string;
  updatedAt: string;
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

/** Pipeline adım adları */
export type AutomationStepName = keyof AutomationRunSteps;
