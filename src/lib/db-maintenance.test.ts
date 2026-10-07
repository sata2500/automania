import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ default: { query: vi.fn() }, db: {} }));

import { computeMigrationStatus, MaintenanceLockedError, withMaintenanceLock } from './db-maintenance';
import type { QueryFn } from './secret-migration';

describe('computeMigrationStatus', () => {
  const entries = [
    { idx: 0, tag: '0000_baseline', when: 1000 },
    { idx: 1, tag: '0001_next', when: 2000 },
  ];

  it('treats everything as pending when nothing was applied', () => {
    expect(computeMigrationStatus(entries, null).pending.map((e) => e.tag)).toEqual(['0000_baseline', '0001_next']);
  });

  it('uses the last applied timestamp like the drizzle migrator', () => {
    const status = computeMigrationStatus(entries, 1000);
    expect(status.applied.map((e) => e.tag)).toEqual(['0000_baseline']);
    expect(status.pending.map((e) => e.tag)).toEqual(['0001_next']);
  });
});

describe('withMaintenanceLock', () => {
  async function setup() {
    const db = new PGlite();
    await db.exec(`CREATE TABLE app_settings (id VARCHAR(50) PRIMARY KEY, setting_key VARCHAR(100) UNIQUE NOT NULL, setting_value TEXT, updated_at TIMESTAMP)`);
    const run: QueryFn = async (text, params) => (await db.query<Record<string, unknown>>(text, params)).rows;
    return { db, run };
  }

  it('allows only one operation at a time and releases the lock afterwards', async () => {
    const { db, run } = await setup();
    let release!: () => void;
    const first = withMaintenanceLock(() => new Promise<string>((resolve) => { release = () => resolve('first'); }), run);
    await new Promise((r) => setTimeout(r, 50));

    await expect(withMaintenanceLock(async () => 'second', run)).rejects.toBeInstanceOf(MaintenanceLockedError);

    release();
    expect(await first).toBe('first');
    expect(await withMaintenanceLock(async () => 'third', run)).toBe('third');
    expect(await run(`SELECT * FROM app_settings`)).toEqual([]);
    await db.close();
  }, 30_000);

  it('releases the lock when the task fails and clears stale locks', async () => {
    const { db, run } = await setup();
    await expect(withMaintenanceLock(async () => { throw new Error('boom'); }, run)).rejects.toThrow('boom');
    await run(`INSERT INTO app_settings VALUES ('__db_maintenance_lock', '__db_maintenance_lock', 'old', NOW() - INTERVAL '1 hour')`);
    expect(await withMaintenanceLock(async () => 'ok', run)).toBe('ok');
    await db.close();
  }, 30_000);
});
