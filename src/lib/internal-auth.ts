import { createHmac, timingSafeEqual } from 'node:crypto';

const MIN_TOKEN_LENGTH = 32;

/**
 * Sunucu içi / zamanlanmış çağrılar için paylaşılan gizli anahtarı döner.
 * Tanımlı değilse veya çok kısaysa null döner; bu durumda iç uç noktalar kapalı kalır.
 */
export function getConfiguredSecret(envName: 'INTERNAL_API_TOKEN' | 'CRON_SECRET'): string | null {
  const value = process.env[envName]?.trim();
  if (value && value.length >= MIN_TOKEN_LENGTH) return value;
  // İç çağrı anahtarı ayrıca tanımlanmamışsa oturum anahtarından türetilir: otomasyon, kullanıcı sekmeyi
  // kapatsa bile süre sınırına gelen çalıştırmayı sunucuda yeni bir çağrıyla sürdürebilir.
  if (envName === 'INTERNAL_API_TOKEN') {
    const base = process.env.JWT_SECRET?.trim();
    if (base && base.length >= MIN_TOKEN_LENGTH) return createHmac('sha256', base).update('automania:internal-api').digest('hex');
  }
  return null;
}

/** Sabit zamanlı karşılaştırma ile gizli anahtar doğrulaması. */
export function secretsMatch(provided: string | null | undefined, expected: string | null): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isValidInternalToken(provided: string | null | undefined): boolean {
  return secretsMatch(provided, getConfiguredSecret('INTERNAL_API_TOKEN'));
}

/** Vercel Cron, `Authorization: Bearer <CRON_SECRET>` başlığı gönderir. */
export function isValidCronAuthorization(authorizationHeader: string | null | undefined): boolean {
  const match = /^Bearer\s+(.+)$/.exec(authorizationHeader ?? '');
  return secretsMatch(match?.[1], getConfiguredSecret('CRON_SECRET'));
}
