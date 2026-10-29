import type { GeneratedSeoData, ListingReviewState } from '@/types/templates';

/** `/api/listing-review` yanıtındaki ilan (sunucudaki `ReviewItem`in JSON hali). */
export type ReviewItemView = {
  runId: string;
  templateId: string;
  templateName: string;
  createdAt: string | null;
  review: ListingReviewState;
  seo: GeneratedSeoData | null;
  photos: string[];
  videoUrl: string | null;
  designUrl: string | null;
  etsyListingId: string | null;
  price: number | null;
  warning: string | null;
  sku: string | null;
  /** Manuel üretimden gelen ilanın metni arka planda hazırlanıyor */
  preparing?: boolean;
  /** Manuel üretim ilanının varyasyonları (yayından önce seçilir); otomasyon ilanlarında null. */
  variations?: { templateId: string | null; templateName: string | null; count: number; enabled: number } | null;
};
