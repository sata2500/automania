import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openSecret, isSealed } from './secret-box';
import { encryptStoredSecrets, inspectSecrets, type QueryFn } from './secret-migration';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE app_settings (id VARCHAR(50) PRIMARY KEY, setting_key VARCHAR(100) UNIQUE NOT NULL, setting_value TEXT, updated_at TIMESTAMP);
    CREATE TABLE user_workspaces (user_id VARCHAR(255) PRIMARY KEY, etsy_access_token TEXT, etsy_refresh_token VARCHAR(500), scraping_api_key VARCHAR(500));
    INSERT INTO app_settings VALUES ('gemini_api_key', 'gemini_api_key', 'AIza-plain', NULL), ('active_ai_provider', 'active_ai_provider', 'google', NULL);
    INSERT INTO user_workspaces VALUES ('u1', 'access-plain', 'refresh-plain', 'scraper-copy'), ('u2', NULL, NULL, NULL);
  `);
  const query: QueryFn = async (text, params) => (await db.query<Record<string, unknown>>(text, params)).rows;
  return { db, query };
}

describe('secret migration', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reports and encrypts plaintext secrets idempotently', async () => {
    vi.stubEnv('DATA_ENCRYPTION_KEY', 'k'.repeat(48));
    const { db, query } = await setup();

    expect(await inspectSecrets(query)).toEqual({
      encryptionConfigured: true, plaintextSettings: 1, plaintextWorkspaces: 1, legacyScrapingKeys: 1,
    });

    const after = await encryptStoredSecrets(query);
    expect(after).toMatchObject({ plaintextSettings: 0, plaintextWorkspaces: 0, legacyScrapingKeys: 0 });

    const [setting] = await query(`SELECT setting_value FROM app_settings WHERE setting_key = 'gemini_api_key'`);
    expect(isSealed(setting.setting_value)).toBe(true);
    expect(openSecret(String(setting.setting_value))).toBe('AIza-plain');
    const [provider] = await query(`SELECT setting_value FROM app_settings WHERE setting_key = 'active_ai_provider'`);
    expect(provider.setting_value).toBe('google');

    const [ws] = await query(`SELECT etsy_access_token, etsy_refresh_token FROM user_workspaces WHERE user_id = 'u1'`);
    expect(openSecret(String(ws.etsy_access_token))).toBe('access-plain');
    expect(openSecret(String(ws.etsy_refresh_token))).toBe('refresh-plain');

    // İkinci çalıştırma hiçbir şeyi tekrar şifrelemez
    await encryptStoredSecrets(query);
    const [again] = await query(`SELECT etsy_access_token FROM user_workspaces WHERE user_id = 'u1'`);
    expect(again.etsy_access_token).toBe(ws.etsy_access_token);
    await db.close();
  }, 30_000);

  it('refuses to run without an encryption key', async () => {
    vi.stubEnv('DATA_ENCRYPTION_KEY', '');
    const { db, query } = await setup();
    await expect(encryptStoredSecrets(query)).rejects.toThrow(/DATA_ENCRYPTION_KEY/);
    await db.close();
  }, 30_000);
});
