/**
 * Veritabanındaki düz metin gizli değerlerin (Etsy token'ları, admin API anahtarları)
 * DATA_ENCRYPTION_KEY ile şifrelenmesi. Hem admin panelindeki bakım kartı hem de
 * `scripts/encrypt-secrets.ts` tarafından kullanılır. İdempotenttir.
 */
import { isEncryptionConfigured, isSealed, sealSecret } from './secret-box';
import { SECRET_SETTING_KEYS } from './setting-security';

/** Parametreli SQL çalıştıran ve satırları dönen sürücüden bağımsız arayüz. */
export type QueryFn = (text: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>;

export type SecretInventory = {
  encryptionConfigured: boolean;
  plaintextSettings: number;
  plaintextWorkspaces: number;
  legacyScrapingKeys: number;
};

type SettingRow = { setting_key: string; setting_value: string | null };
type WorkspaceRow = { user_id: string; etsy_access_token: string | null; etsy_refresh_token: string | null };

const isPlain = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && !isSealed(value);

async function loadPlaintext(query: QueryFn) {
  const settings = (await query(
    'SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1)',
    [[...SECRET_SETTING_KEYS]],
  )) as unknown as SettingRow[];
  const workspaces = (await query(
    'SELECT user_id, etsy_access_token, etsy_refresh_token FROM user_workspaces WHERE etsy_access_token IS NOT NULL OR etsy_refresh_token IS NOT NULL',
  )) as unknown as WorkspaceRow[];

  return {
    settings: settings.filter((row) => isPlain(row.setting_value)),
    workspaces: workspaces.filter((row) => isPlain(row.etsy_access_token) || isPlain(row.etsy_refresh_token)),
  };
}

async function countLegacyScrapingKeys(query: QueryFn): Promise<number> {
  try {
    const [row] = await query('SELECT COUNT(*)::int AS count FROM user_workspaces WHERE scraping_api_key IS NOT NULL');
    return Number(row?.count ?? 0);
  } catch {
    return 0; // Kolon hiç yoksa temizlenecek bir şey de yoktur.
  }
}

export async function inspectSecrets(query: QueryFn): Promise<SecretInventory> {
  const plain = await loadPlaintext(query);
  return {
    encryptionConfigured: isEncryptionConfigured(),
    plaintextSettings: plain.settings.length,
    plaintextWorkspaces: plain.workspaces.length,
    legacyScrapingKeys: await countLegacyScrapingKeys(query),
  };
}

/** Düz metin değerleri şifreler ve eski kullanıcı bazlı scraping anahtarı kopyalarını temizler. */
export async function encryptStoredSecrets(query: QueryFn): Promise<SecretInventory> {
  if (!isEncryptionConfigured()) {
    throw new Error('DATA_ENCRYPTION_KEY (en az 32 karakter) tanımlı değil.');
  }

  // Şifreli refresh token'lar VARCHAR(500) sınırını aşabilir.
  await query('ALTER TABLE user_workspaces ALTER COLUMN etsy_refresh_token TYPE TEXT');

  const plain = await loadPlaintext(query);

  for (const row of plain.settings) {
    await query(
      'UPDATE app_settings SET setting_value = $1, updated_at = CURRENT_TIMESTAMP WHERE setting_key = $2 AND setting_value = $3',
      [sealSecret(row.setting_value as string), row.setting_key, row.setting_value],
    );
  }

  for (const row of plain.workspaces) {
    const access = isPlain(row.etsy_access_token) ? sealSecret(row.etsy_access_token) : row.etsy_access_token;
    const refresh = isPlain(row.etsy_refresh_token) ? sealSecret(row.etsy_refresh_token) : row.etsy_refresh_token;
    // Eşzamanlı bir token yenilemesinin üzerine yazmamak için yalnızca okunan değer hâlâ duruyorsa güncellenir.
    await query(
      `UPDATE user_workspaces SET etsy_access_token = $1, etsy_refresh_token = $2
       WHERE user_id = $3
         AND etsy_access_token IS NOT DISTINCT FROM $4
         AND etsy_refresh_token IS NOT DISTINCT FROM $5`,
      [access, refresh, row.user_id, row.etsy_access_token, row.etsy_refresh_token],
    );
  }

  if ((await countLegacyScrapingKeys(query)) > 0) {
    await query('UPDATE user_workspaces SET scraping_api_key = NULL WHERE scraping_api_key IS NOT NULL');
  }

  return inspectSecrets(query);
}
