/**
 * Admin panelinden elle tetiklenen veritabanı bakım işlemleri:
 * migration durumu/uygulama ve gizli değerlerin şifrelenmesi.
 * İşlemler bir bakım kilidi altında çalışır; aynı anda yalnızca biri yürütülebilir.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import client, { db } from '@/lib/db';
import { encryptStoredSecrets, inspectSecrets, type QueryFn, type SecretInventory } from '@/lib/secret-migration';

export const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle');
const LOCK_KEY = '__db_maintenance_lock';
const LOCK_TTL_MINUTES = 10;

export const query: QueryFn = (text, params) =>
  client.query(text, params ?? []) as Promise<Array<Record<string, unknown>>>;

export type JournalEntry = { idx: number; tag: string; when: number };

export type MigrationStatus = {
  total: number;
  applied: Array<{ tag: string; appliedAt: string }>;
  pending: Array<{ tag: string }>;
};

/** Drizzle migrator ile aynı kural: son uygulanan migration'ın zamanından yeni olanlar bekler. */
export function computeMigrationStatus(entries: JournalEntry[], lastAppliedMillis: number | null): MigrationStatus {
  const sorted = [...entries].sort((a, b) => a.idx - b.idx);
  const isApplied = (entry: JournalEntry) => lastAppliedMillis !== null && entry.when <= lastAppliedMillis;
  return {
    total: sorted.length,
    applied: sorted.filter(isApplied).map((e) => ({ tag: e.tag, appliedAt: new Date(e.when).toISOString() })),
    pending: sorted.filter((e) => !isApplied(e)).map((e) => ({ tag: e.tag })),
  };
}

async function readJournal(): Promise<JournalEntry[]> {
  const raw = await fs.readFile(path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8');
  return (JSON.parse(raw) as { entries: JournalEntry[] }).entries;
}

async function lastAppliedMigrationMillis(): Promise<number | null> {
  try {
    const [row] = await query('SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1');
    return row ? Number(row.created_at) : null;
  } catch {
    return null; // Tablo henüz yok: hiç migration uygulanmamış.
  }
}

export async function getMigrationStatus(): Promise<MigrationStatus> {
  const [entries, last] = await Promise.all([readJournal(), lastAppliedMigrationMillis()]);
  return computeMigrationStatus(entries, last);
}

export type MaintenanceStatus = {
  migrations: MigrationStatus;
  secrets: SecretInventory;
  lockedSince: string | null;
};

async function currentLock(): Promise<string | null> {
  const [row] = await query(
    `SELECT updated_at FROM app_settings WHERE setting_key = $1 AND updated_at > NOW() - make_interval(mins => $2::int)`,
    [LOCK_KEY, LOCK_TTL_MINUTES],
  );
  return row?.updated_at ? new Date(String(row.updated_at)).toISOString() : null;
}

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const [migrations, secrets, lockedSince] = await Promise.all([getMigrationStatus(), inspectSecrets(query), currentLock()]);
  return { migrations, secrets, lockedSince };
}

export class MaintenanceLockedError extends Error {
  constructor() {
    super('Başka bir bakım işlemi şu anda çalışıyor. Lütfen birkaç dakika sonra tekrar deneyin.');
    this.name = 'MaintenanceLockedError';
  }
}

/** Bakım kilidini alıp işlemi çalıştırır; süresi dolmuş (takılı kalmış) kilitler temizlenir. */
export async function withMaintenanceLock<T>(task: () => Promise<T>, run: QueryFn = query): Promise<T> {
  const owner = randomUUID();
  await run(
    `DELETE FROM app_settings WHERE setting_key = $1 AND updated_at < NOW() - make_interval(mins => $2::int)`,
    [LOCK_KEY, LOCK_TTL_MINUTES],
  );
  const acquired = await run(
    `INSERT INTO app_settings (id, setting_key, setting_value, updated_at)
     VALUES ($1, $1, $2, NOW())
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [LOCK_KEY, owner],
  );
  if (acquired.length === 0) throw new MaintenanceLockedError();

  try {
    return await task();
  } finally {
    await run('DELETE FROM app_settings WHERE setting_key = $1 AND setting_value = $2', [LOCK_KEY, owner]).catch(() => {});
  }
}

export async function runMigrations(): Promise<MigrationStatus> {
  return withMaintenanceLock(async () => {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    return getMigrationStatus();
  });
}

export async function runSecretEncryption(): Promise<SecretInventory> {
  return withMaintenanceLock(() => encryptStoredSecrets(query));
}
