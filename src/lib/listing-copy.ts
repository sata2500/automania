/**
 * Yapay zekânın ilan açıklamasında kullanacağı mağaza bilgileri (Ayarlar › İlan metni bilgileri). Kargo
 * ücretsiz mi ayarı boş bırakıldıysa ilanın kargo profilinden anlaşılır (Etsy API; hata olursa bilinmiyor).
 */
import { loadListingDefaults } from '@/lib/user-settings';
import { listingCopyFacts } from '@/lib/listing-defaults';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { isFreeShippingProfile } from '@/lib/etsy-shipping';
import type { EtsyShippingProfile } from '@/types/etsy';

async function detectFreeShipping(userId: string, shippingProfileId: string | null | undefined): Promise<boolean | null> {
  if (!shippingProfileId) return null;
  try {
    const token = await getValidEtsyToken(userId);
    if (!token.success || !token.access_token || !token.shop_id) return null;
    const res = await fetch(`https://openapi.etsy.com/v3/application/shops/${token.shop_id}/shipping-profiles/${encodeURIComponent(shippingProfileId)}`, {
      headers: { 'x-api-key': `${token.api_key || process.env.ETSY_API_KEY}:${token.shared_secret || process.env.ETSY_SHARED_SECRET || ''}`, Authorization: `Bearer ${token.access_token}` },
    });
    if (!res.ok) return null;
    return isFreeShippingProfile(await res.json() as EtsyShippingProfile);
  } catch {
    return null;
  }
}

/** Yapay zekâya verilecek mağaza bilgileri metni. `shippingProfileId`: ilanın kargo profili (yoksa mağaza varsayılanı). */
export async function loadStoreCopyFacts(userId: string, shippingProfileId?: string | null): Promise<string> {
  const defaults = await loadListingDefaults(userId);
  const detected = defaults.copy.freeShipping === null
    ? await detectFreeShipping(userId, shippingProfileId || defaults.etsy.shippingProfileId)
    : null;
  return listingCopyFacts(defaults.copy, detected);
}
