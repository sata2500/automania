import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';

const DEFAULT_SQLITE_PATH = path.join(process.cwd(), '.data', 'automania.local.sqlite');

const SCHEMA_SQL = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'disabled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_workspaces (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mockups TEXT NOT NULL DEFAULT '[]',
    designs TEXT NOT NULL DEFAULT '[]',
    folders TEXT NOT NULL DEFAULT '[]',
    active_folder_id TEXT,
    selected_mockup_id TEXT,
    openrouter_model TEXT,
    etsy_product_types TEXT,
    etsy_user_notes TEXT,
    etsy_variation_templates TEXT NOT NULL DEFAULT '[]',
    etsy_default_templates TEXT NOT NULL DEFAULT '{}',
    etsy_custom_sizes TEXT NOT NULL DEFAULT '[]',
    etsy_custom_colors TEXT NOT NULL DEFAULT '[]',
    etsy_generated_mockups TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS keyword_pool (
    id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL UNIQUE,
    usage_count INTEGER NOT NULL DEFAULT 1,
    etsy_score INTEGER NOT NULL DEFAULT 0,
    opportunity_score INTEGER NOT NULL DEFAULT 0,
    raw_metrics TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS etsy_taxonomy_cache (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT,
    is_active INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS job_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    idempotency_key TEXT,
    request_hash TEXT,
    progress TEXT NOT NULL DEFAULT '{"completed":0,"total":0}',
    result TEXT NOT NULL DEFAULT '{}',
    error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TEXT,
    finished_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_etsy_listings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id TEXT NOT NULL,
    shop_id TEXT,
    title TEXT,
    description TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    materials TEXT NOT NULL DEFAULT '[]',
    price REAL NOT NULL DEFAULT 0,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    quantity INTEGER NOT NULL DEFAULT 999,
    state TEXT NOT NULL DEFAULT 'active',
    url TEXT,
    views INTEGER NOT NULL DEFAULT 0,
    num_favorers INTEGER NOT NULL DEFAULT 0,
    images TEXT NOT NULL DEFAULT '[]',
    primary_image_url TEXT,
    taxonomy_id INTEGER,
    taxonomy_path TEXT,
    vision_analysis TEXT NOT NULL DEFAULT '{}',
    seo_score INTEGER NOT NULL DEFAULT 0,
    seo_evaluation TEXT NOT NULL DEFAULT '{}',
    ai_optimized_title TEXT,
    ai_optimized_description TEXT,
    ai_optimized_tags TEXT NOT NULL DEFAULT '[]',
    ai_optimized_at TEXT,
    etsy_updated_timestamp INTEGER,
    last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, listing_id)
  );

  CREATE INDEX IF NOT EXISTS idx_sqlite_audit_logs_user_created ON audit_logs(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_sqlite_audit_logs_action_created ON audit_logs(action, created_at);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sqlite_job_runs_user_idempotency ON job_runs(user_id, idempotency_key);
  CREATE INDEX IF NOT EXISTS idx_sqlite_job_runs_status ON job_runs(status);
  CREATE INDEX IF NOT EXISTS idx_sqlite_workspace_updated_at ON user_workspaces(updated_at);
  CREATE INDEX IF NOT EXISTS idx_sqlite_listings_user_id ON user_etsy_listings(user_id);
  CREATE INDEX IF NOT EXISTS idx_sqlite_listings_state ON user_etsy_listings(user_id, state);
  CREATE INDEX IF NOT EXISTS idx_sqlite_keywords_score ON keyword_pool(opportunity_score, etsy_score);
`;

let sqlPromise: Promise<SqlJsStatic> | null = null;
let sharedDatabase: SqlJsDatabase | null = null;
let sharedDatabasePath: string | null = null;

function resolveDatabasePath(explicitPath?: string): string {
  const configured = explicitPath || process.env.SQLITE_DATABASE_PATH || DEFAULT_SQLITE_PATH;
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
    });
  }
  return await sqlPromise;
}

export async function createLocalSqliteDatabase(databasePath?: string): Promise<SqlJsDatabase> {
  const resolvedPath = resolveDatabasePath(databasePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const SQL = await getSqlJs();
  const database = fs.existsSync(resolvedPath)
    ? new SQL.Database(new Uint8Array(fs.readFileSync(resolvedPath)))
    : new SQL.Database();
  database.run(SCHEMA_SQL);
  return database;
}

export async function persistLocalSqliteDatabase(database: SqlJsDatabase, databasePath?: string): Promise<void> {
  const resolvedPath = resolveDatabasePath(databasePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, Buffer.from(database.export()));
}

export async function getLocalSqliteDatabase(): Promise<SqlJsDatabase> {
  const resolvedPath = resolveDatabasePath();
  if (!sharedDatabase || sharedDatabasePath !== resolvedPath) {
    if (sharedDatabase) {
      await persistLocalSqliteDatabase(sharedDatabase, sharedDatabasePath || resolvedPath);
      sharedDatabase.close();
    }
    sharedDatabase = await createLocalSqliteDatabase(resolvedPath);
    sharedDatabasePath = resolvedPath;
  }
  return sharedDatabase;
}

export async function closeLocalSqliteDatabase(): Promise<void> {
  if (sharedDatabase && sharedDatabasePath) {
    await persistLocalSqliteDatabase(sharedDatabase, sharedDatabasePath);
    sharedDatabase.close();
  }
  sharedDatabase = null;
  sharedDatabasePath = null;
}

export function sqliteJson<T>(value: T): string {
  return JSON.stringify(value ?? null);
}

export function parseSqliteJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return value as T ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
