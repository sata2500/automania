/**
 * Mevcut düz metin gizli değerleri DATA_ENCRYPTION_KEY ile şifreler.
 *
 *   npx tsx scripts/encrypt-secrets.ts            # yalnızca rapor (dry run)
 *   npx tsx scripts/encrypt-secrets.ts --apply    # değişiklikleri uygula
 *
 * İdempotenttir: zaten şifreli değerlere dokunmaz.
 */
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function main() {
  const apply = process.argv.includes('--apply');
  const { neon } = await import('@neondatabase/serverless');
  const { isEncryptionConfigured, isSealed, sealSecret } = await import('../src/lib/secret-box');
  const { SECRET_SETTING_KEYS } = await import('../src/lib/setting-security');

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (!isEncryptionConfigured()) throw new Error('DATA_ENCRYPTION_KEY (>= 32 chars) is required.');
  const sql = neon(process.env.DATABASE_URL);

  const settings = await sql`SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY(${[...SECRET_SETTING_KEYS]})`;
  const plainSettings = settings.filter((row) => row.setting_value && !isSealed(row.setting_value));

  const workspaces = await sql`
    SELECT user_id, etsy_access_token, etsy_refresh_token
    FROM user_workspaces
    WHERE etsy_access_token IS NOT NULL OR etsy_refresh_token IS NOT NULL
  `;
  const plainWorkspaces = workspaces.filter((row) =>
    (row.etsy_access_token && !isSealed(row.etsy_access_token)) ||
    (row.etsy_refresh_token && !isSealed(row.etsy_refresh_token)));

  const [{ count: legacyScrapingKeys }] = await sql`
    SELECT COUNT(*)::int AS count FROM user_workspaces WHERE scraping_api_key IS NOT NULL
  `;

  console.log(`app_settings secrets to encrypt: ${plainSettings.length}`);
  console.log(`workspaces with plaintext Etsy tokens: ${plainWorkspaces.length}`);
  console.log(`legacy per-user scraping_api_key copies to clear: ${legacyScrapingKeys}`);

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to write changes.');
    return;
  }

  // Refresh token'lar şifrelendiğinde VARCHAR(500) sınırını aşabilir.
  await sql`ALTER TABLE user_workspaces ALTER COLUMN etsy_refresh_token TYPE TEXT`;

  for (const row of plainSettings) {
    await sql`
      UPDATE app_settings SET setting_value = ${sealSecret(row.setting_value)}, updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = ${row.setting_key} AND setting_value = ${row.setting_value}
    `;
  }

  for (const row of plainWorkspaces) {
    const access = row.etsy_access_token && !isSealed(row.etsy_access_token) ? sealSecret(row.etsy_access_token) : row.etsy_access_token;
    const refresh = row.etsy_refresh_token && !isSealed(row.etsy_refresh_token) ? sealSecret(row.etsy_refresh_token) : row.etsy_refresh_token;
    // Eşzamanlı bir token yenilemesinin üzerine yazmamak için yalnızca okunan değer hâlâ duruyorsa güncellenir.
    await sql`
      UPDATE user_workspaces
      SET etsy_access_token = ${access}, etsy_refresh_token = ${refresh}
      WHERE user_id = ${row.user_id}
        AND etsy_access_token IS NOT DISTINCT FROM ${row.etsy_access_token}
        AND etsy_refresh_token IS NOT DISTINCT FROM ${row.etsy_refresh_token}
    `;
  }

  await sql`UPDATE user_workspaces SET scraping_api_key = NULL WHERE scraping_api_key IS NOT NULL`;
  console.log('Done.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
