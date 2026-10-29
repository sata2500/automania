/**
 * Kullanıcı ayarlarının sunucu tarafı deposu (`user_settings` tablosu). Tablo yoksa ilk erişimde
 * oluşturulur (yalnızca ham SQL ile okunur; Drizzle şemasına eklenmediği için mevcut sorguları etkilemez).
 */
import sql from '@/lib/db';
import { normalizeListingDefaults, type ListingDefaults } from '@/lib/listing-defaults';

let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  tableReady ??= sql`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id varchar(255) PRIMARY KEY,
      listing_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamp DEFAULT CURRENT_TIMESTAMP
    )
  `.then(() => undefined).catch((error: unknown) => {
    tableReady = null;
    throw error;
  });
  return tableReady;
}

/** Kayıt yoksa (veya tablo oluşturulamazsa) varsayılanlar döner; `saved` ilk kurulumu ayırt eder. */
export async function loadListingDefaults(userId: string): Promise<ListingDefaults & { saved: boolean }> {
  try {
    await ensureTable();
    const rows = await sql`SELECT listing_defaults FROM user_settings WHERE user_id = ${userId} LIMIT 1`;
    const stored = rows[0]?.listing_defaults;
    return { ...normalizeListingDefaults(stored), saved: Boolean(stored && Object.keys(stored).length > 0) };
  } catch (error) {
    console.warn('[Settings] Listing defaults could not be loaded', error instanceof Error ? error.message : error);
    return { ...normalizeListingDefaults(null), saved: false };
  }
}

export async function saveListingDefaults(userId: string, input: unknown): Promise<ListingDefaults> {
  const defaults = normalizeListingDefaults(input);
  await ensureTable();
  await sql`
    INSERT INTO user_settings (user_id, listing_defaults, updated_at)
    VALUES (${userId}, ${JSON.stringify(defaults)}::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE SET listing_defaults = EXCLUDED.listing_defaults, updated_at = CURRENT_TIMESTAMP
  `;
  return defaults;
}
