/**
 * Veritabanında saklanan gizli değerler (Etsy token'ları, API anahtarları) için
 * uygulama seviyesinde AES-256-GCM şifreleme.
 *
 * Anahtar `DATA_ENCRYPTION_KEY` ortam değişkeninden (en az 32 karakter) türetilir.
 * Şifreli değerler `enc:v1:<iv>:<tag>:<ciphertext>` (base64url) biçimindedir.
 * Önekli olmayan değerler eski düz metin kayıtlar olarak kabul edilir ve aynen döner;
 * böylece mevcut veriler `scripts/encrypt-secrets.ts` çalıştırılana kadar okunabilir kalır.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';
const MIN_KEY_LENGTH = 32;

let warnedMissingKey = false;

function resolveKey(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  if (raw.length < MIN_KEY_LENGTH) {
    throw new Error('DATA_ENCRYPTION_KEY must be at least 32 characters long.');
  }
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function isEncryptionConfigured(): boolean {
  try {
    return resolveKey() !== null;
  } catch {
    return false;
  }
}

export function isSealed(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Değeri şifreler. Anahtar yoksa (yalnızca uyarı vererek) düz metin döner. */
export function sealSecret(plaintext: string): string {
  if (!plaintext || isSealed(plaintext)) return plaintext;
  const key = resolveKey();
  if (!key) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn('[secret-box] DATA_ENCRYPTION_KEY is not set; secrets are stored as plaintext.');
    }
    return plaintext;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

/** Şifreli değeri çözer; düz metin değerleri aynen döner. Çözülemezse hata fırlatır. */
export function openSecret(value: string): string {
  if (!isSealed(value)) return value;
  const key = resolveKey();
  if (!key) throw new Error('DATA_ENCRYPTION_KEY is required to decrypt stored secrets.');

  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted value.');
  const [iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** `null`/boş değerleri koruyarak çözer; çözülemeyen değerler için `null` döner. */
export function openSecretOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    return openSecret(value);
  } catch (error) {
    console.error('[secret-box] Failed to decrypt a stored secret:', error instanceof Error ? error.message : error);
    return null;
  }
}

export function sealSecretOrNull(value: string | null | undefined): string | null {
  return value ? sealSecret(value) : null;
}
