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
};
