import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const requiredSchema = {
  users: ['id', 'name', 'email', 'role', 'status', 'provider'],
  user_workspaces: [
    'user_id',
    'mockups',
    'designs',
    'folders',
    'openrouter_key',
    'openrouter_model',
    'etsy_product_types',
    'etsy_user_notes',
    'etsy_variation_templates',
    'etsy_default_templates',
    'etsy_custom_sizes',
    'etsy_custom_colors',
    'etsy_generated_mockups',
  ],
  keyword_pool: ['id', 'keyword', 'total_listings', 'opportunity_score', 'raw_metrics'],
  app_settings: ['id', 'setting_key', 'setting_value'],
  etsy_taxonomy_cache: ['id', 'name', 'path', 'is_active'],
  audit_logs: ['id', 'user_id', 'action', 'metadata', 'created_at'],
  job_runs: [
    'id',
    'user_id',
    'job_type',
    'status',
    'idempotency_key',
    'request_hash',
    'progress',
    'result',
    'updated_at',
  ],
  user_etsy_listings: ['id', 'user_id', 'listing_id', 'state', 'seo_score'],
};

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `;

  const columnsByTable = new Map();
  for (const row of rows) {
    const tableName = String(row.table_name);
    const columnName = String(row.column_name);
    const columns = columnsByTable.get(tableName) ?? new Set();
    columns.add(columnName);
    columnsByTable.set(tableName, columns);
  }

  const missing = [];
  const summary = [];
  for (const [tableName, columns] of Object.entries(requiredSchema)) {
    const actual = columnsByTable.get(tableName) ?? new Set();
    const missingColumns = columns.filter((column) => !actual.has(column));
    summary.push({
      table: tableName,
      present: columns.length - missingColumns.length,
      expected: columns.length,
    });
    for (const column of missingColumns) missing.push(`${tableName}.${column}`);
  }

  console.log(JSON.stringify({
    readOnly: true,
    tablesInspected: Object.keys(requiredSchema).length,
    summary,
    missing,
    status: missing.length === 0 ? 'ready' : 'migration_required',
  }, null, 2));

  if (missing.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'schema inspection failed');
  process.exitCode = 1;
});
