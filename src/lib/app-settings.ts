/**
 * `app_settings` tablosu için tek okuma noktası.
 * Gizli ayarlar (SECRET_SETTING_KEYS) şifreli saklanır ve burada çözülür.
 */
import sql from '@/lib/db';
import { SECRET_SETTING_KEYS } from '@/lib/setting-security';
import { openSecretOrNull, sealSecret } from '@/lib/secret-box';

/** Eksik veya çözülemeyen değerler boş string olarak döner. */
export type SettingRow = { setting_key: string; setting_value: string };

export function decodeSettingValue(key: string, value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return SECRET_SETTING_KEYS.has(key) ? openSecretOrNull(value) : value;
}

export function encodeSettingValue(key: string, value: string): string {
  return SECRET_SETTING_KEYS.has(key) && value ? sealSecret(value) : value;
}

/**
 * Ayar satırlarını (gizli olanlar çözülmüş olarak) döner.
 * `keys` verilmezse tüm ayarlar okunur.
 */
export async function loadSettingRows(keys?: readonly string[]): Promise<SettingRow[]> {
  if (keys && keys.length === 0) return [];
  const rows = keys
    ? await sql`SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY(${keys as string[]})`
    : await sql`SELECT setting_key, setting_value FROM app_settings`;

  return rows.map((row) => {
    const key = String(row.setting_key ?? '');
    return { setting_key: key, setting_value: decodeSettingValue(key, row.setting_value) ?? '' };
  });
}

/** Ayarları `{ anahtar: değer }` nesnesi olarak döner (boş değerler hariç). */
export async function loadSettings(keys?: readonly string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const row of await loadSettingRows(keys)) {
    if (row.setting_value) result[row.setting_key] = row.setting_value;
  }
  return result;
}

export async function loadSetting(key: string): Promise<string | null> {
  const settings = await loadSettings([key]);
  return settings[key] ?? null;
}
