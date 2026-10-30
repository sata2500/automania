/**
 * Kargo profilinin ABD alıcısı için ücretsiz olup olmadığı (ilan açıklamasında "free shipping" yazılabilmesi
 * için). ABD'ye özel hedef varsa ona, yoksa "her yer" hedefine bakılır; bilinmiyorsa null. Saf modül.
 */
import type { EtsyShippingProfile } from '@/types/etsy';

export function isFreeShippingProfile(profile: EtsyShippingProfile | null | undefined): boolean | null {
  const destinations = profile?.shipping_profile_destinations ?? [];
  const us = destinations.filter((d) => d.destination_country_iso === 'US');
  const everywhere = destinations.filter((d) => !d.destination_country_iso && (!d.destination_region || d.destination_region === 'none'));
  const relevant = us.length > 0 ? us : everywhere;
  if (relevant.length === 0) return null;
  return relevant.every((d) => d.primary_cost && Number(d.primary_cost.amount) === 0);
}
