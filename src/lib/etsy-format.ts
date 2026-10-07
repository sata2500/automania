import type { EtsyReturnPolicy } from '@/types/etsy';

/** Etsy iade politikaları başlık içermez; seçim listesi için okunabilir bir etiket üretir. */
export function formatReturnPolicy(policy: EtsyReturnPolicy): string {
  const parts: string[] = [];
  if (policy.accepts_returns) parts.push('İade');
  if (policy.accepts_exchanges) parts.push('Değişim');
  const label = parts.length > 0 ? `${parts.join(' + ')} kabul` : 'İade/değişim yok';
  const deadline = policy.return_deadline ? ` · ${policy.return_deadline} gün` : '';
  return `${label}${deadline} (ID: ${policy.return_policy_id})`;
}
