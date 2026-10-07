/**
 * Mevcut düz metin gizli değerleri DATA_ENCRYPTION_KEY ile şifreler.
 * (Aynı işlem admin panelindeki "Veritabanı Bakımı" kartından da yapılabilir.)
 *
 *   npx tsx scripts/encrypt-secrets.ts            # yalnızca rapor (dry run)
 *   npx tsx scripts/encrypt-secrets.ts --apply    # değişiklikleri uygula
 */
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function main() {
  const apply = process.argv.includes('--apply');
  const { neon } = await import('@neondatabase/serverless');
  const { encryptStoredSecrets, inspectSecrets } = await import('../src/lib/secret-migration');

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const sql = neon(process.env.DATABASE_URL);
  const query = (text: string, params?: unknown[]) => sql.query(text, params ?? []) as Promise<Array<Record<string, unknown>>>;

  const before = await inspectSecrets(query);
  console.log('Before:', before);
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to write changes.');
    return;
  }
  console.log('After:', await encryptStoredSecrets(query));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
