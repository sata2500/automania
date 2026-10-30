/**
 * Yapay zekânın ilan açıklamasında kullanacağı mağaza bilgileri: ürün bilgisi (Ayarlar), kargonun ücretsiz olup
 * olmadığı (ilanın kargo profilinden) ve hazırlık süresi (Etsy hazırlık süresi tanımından). Etsy'den
 * alınamayan bilgi yazılmaz (hata olursa bilinmiyor sayılır).
 */
import { loadListingDefaults } from '@/lib/user-settings';
import { listingCopyFacts, processingTimeText } from '@/lib/listing-defaults';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { isFreeShippingProfile } from '@/lib/etsy-shipping';
import type { EtsyReadinessState, EtsyShippingProfile } from '@/types/etsy';

type EtsyAuth = { shopId: string; headers: Record<string, string> };

async function etsyAuth(userId: string): Promise<EtsyAuth | null> {
  const token = await getValidEtsyToken(userId).catch(() => null);
  if (!token?.success || !token.access_token || !token.shop_id) return null;
  return {
    shopId: String(token.shop_id),
    headers: { 'x-api-key': `${token.api_key || process.env.ETSY_API_KEY}:${token.shared_secret || process.env.ETSY_SHARED_SECRET || ''}`, Authorization: `Bearer ${token.access_token}` },
  };
}

async function fetchShopResource<T>(auth: EtsyAuth, path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://openapi.etsy.com/v3/application/shops/${auth.shopId}/${path}`, { headers: auth.headers });
    return res.ok ? await res.json() as T : null;
  } catch {
    return null;
  }
}

/** Yapay zekâya verilecek mağaza bilgileri metni. `shippingProfileId`: ilanın kargo profili (yoksa mağaza varsayılanı). */
export async function loadStoreCopyFacts(userId: string, shippingProfileId?: string | null): Promise<string> {
  const defaults = await loadListingDefaults(userId);
  const profileId = shippingProfileId || defaults.etsy.shippingProfileId;
  const readinessId = defaults.etsy.readinessStateId;
  const auth = profileId || readinessId ? await etsyAuth(userId) : null;
  const [profile, readiness] = auth
    ? await Promise.all([
        profileId ? fetchShopResource<EtsyShippingProfile>(auth, `shipping-profiles/${encodeURIComponent(profileId)}`) : null,
        readinessId ? fetchShopResource<EtsyReadinessState>(auth, `readiness-state-definitions/${encodeURIComponent(readinessId)}`) : null,
      ])
    : [null, null];
  return listingCopyFacts(defaults.copy, {
    freeShipping: profile ? isFreeShippingProfile(profile) : null,
    processing: processingTimeText(readiness),
  });
}
