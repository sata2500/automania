import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    const ws = await sql`SELECT etsy_access_token IS NOT NULL as has_token, etsy_shop_id FROM user_workspaces`;
    console.table(ws);
  } catch (error) {
    console.error('Error querying table:', error);
  }
}

main();
