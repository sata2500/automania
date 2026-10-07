import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.join(process.cwd(), 'drizzle');

function loadStatements(): string[] {
  const journal = JSON.parse(fs.readFileSync(path.join(migrationsDir, 'meta', '_journal.json'), 'utf8')) as {
    entries: Array<{ tag: string }>;
  };
  return journal.entries.flatMap(({ tag }) =>
    fs.readFileSync(path.join(migrationsDir, `${tag}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean),
  );
}

async function applyAll(db: PGlite) {
  for (const statement of loadStatements()) {
    await db.exec(statement);
  }
}

async function columnsOf(db: PGlite, table: string): Promise<string[]> {
  const result = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY column_name`,
    [table],
  );
  return result.rows.map((row) => row.column_name);
}

describe('drizzle migrations', () => {
  it('create the full schema on an empty database and can be re-applied', async () => {
    const db = new PGlite();
    await applyAll(db);
    await applyAll(db);

    expect(await columnsOf(db, 'user_workspaces')).toEqual(expect.arrayContaining([
      'etsy_access_token', 'etsy_refresh_token', 'etsy_shop_id', 'etsy_pkce_state', 'etsy_generated_mockups',
    ]));
    expect(await columnsOf(db, 'users')).toEqual(expect.arrayContaining(['avatar_url', 'provider', 'last_login_at']));
    await db.close();
  }, 60_000);

  it('upgrade a legacy bootstrap schema without losing rows', async () => {
    const db = new PGlite();
    // Eski /api/setup ve create_table.mjs betiklerinin oluşturduğu minimal şema
    await db.exec(`
      CREATE TABLE users (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'user', status VARCHAR(50) DEFAULT 'active');
      CREATE TABLE user_workspaces (user_id VARCHAR(255) PRIMARY KEY, mockups JSONB DEFAULT '[]'::jsonb,
        designs JSONB DEFAULT '[]'::jsonb, folders JSONB DEFAULT '[]'::jsonb, etsy_refresh_token VARCHAR(500));
      CREATE TABLE keyword_pool (id VARCHAR(255) PRIMARY KEY, keyword VARCHAR(255) UNIQUE NOT NULL);
      INSERT INTO users (id, name, email) VALUES ('u1', 'User', 'u1@example.com');
      INSERT INTO user_workspaces (user_id, etsy_refresh_token) VALUES ('u1', 'legacy-token');
      INSERT INTO keyword_pool (id, keyword) VALUES ('k1', 'cat shirt');
    `);

    await applyAll(db);

    const workspace = await db.query<{ etsy_refresh_token: string; etsy_custom_sizes: unknown }>(
      `SELECT etsy_refresh_token, etsy_custom_sizes FROM user_workspaces WHERE user_id = 'u1'`,
    );
    expect(workspace.rows[0]).toMatchObject({ etsy_refresh_token: 'legacy-token', etsy_custom_sizes: [] });

    const type = await db.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns WHERE table_name = 'user_workspaces' AND column_name = 'etsy_refresh_token'`,
    );
    expect(type.rows[0].data_type).toBe('text');

    const keyword = await db.query<{ opportunity_score: number }>(`SELECT opportunity_score FROM keyword_pool WHERE id = 'k1'`);
    expect(keyword.rows[0].opportunity_score).toBe(0);
    await db.close();
  }, 60_000);
});
