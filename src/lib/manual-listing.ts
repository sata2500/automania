/**
 * Manuel üretimden (Üretim sekmesi) açılan ilanlar: otomasyon çalıştırmalarıyla aynı tabloda,
 * `MANUAL_TEMPLATE_ID` ile saklanır. Görseller ve tasarım hazır gelir; çalıştırıcı yalnızca ilan metnini
 * (SEO) üretip ilanı Hazır İlanlar'a koyar. Şablonun yerini, oluşturulurken alınan ayar kopyası tutar
 * (Ayarlar sonradan değişse de hazırlanmış ilan etkilenmez).
 */
import type { AutomationRunSteps, PodTemplateEtsyListingSettings } from '@/types/templates';
import type { EtsyVariationRow } from '@/types/pod';

export const MANUAL_TEMPLATE_ID = 'manual';

/** İlanla birlikte saklanan Etsy ayarları ve varyasyonlar. */
export type ManualListingSettings = {
  etsy: PodTemplateEtsyListingSettings;
  variations: EtsyVariationRow[];
  sku?: string;
  productType?: string;
  notes?: string;
  /** İlan metni için tasarımın ana konusu */
  subject?: string;
};

/** Elle hazırlanan ilanın ayarları (eski stüdyo kayıtları `listingCreation`, üretim kayıtları `mockupRender` altında). */
export function manualSettingsOf(steps: unknown): ManualListingSettings | null {
  const s = steps as AutomationRunSteps | null;
  const manual = s?.listingCreation?.output?.manualListing ?? s?.mockupRender?.output?.listingSettings;
  return manual && typeof manual === 'object' ? manual as ManualListingSettings : null;
}

/**
 * Çalıştırıcı için şablon yerine geçen kayıt: inceleme modunda ilan, video yok, SEO ipuçları tasarımdan.
 * Dönen nesne `pod_templates` satırının çalıştırıcının okuduğu alanlarını taşır.
 */
export function manualTemplateFor(userId: string, steps: unknown) {
  const settings = manualSettingsOf(steps);
  if (!settings) return null;
  return {
    id: MANUAL_TEMPLATE_ID,
    userId,
    name: 'Manuel üretim',
    isActive: true,
    seoHints: {
      productType: settings.productType ?? 'T-shirt',
      targetAudience: '',
      customNotes: settings.notes ?? '',
      primaryNiche: settings.subject ?? '',
      nicheMode: 'manual' as const,
    },
    automationSchedule: {
      enabled: false,
      createListing: true,
      listingMode: 'review' as const,
      generateVideo: false,
      etsy: settings.etsy,
    },
    variationConfig: { rows: settings.variations },
    mockupConfig: null,
  };
}
