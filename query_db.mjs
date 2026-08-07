import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='keyword_pool'`;
    console.log('--- KEYWORD_POOL TABLO KOLONLARI ---');
    console.table(cols);
  } catch (error) {
    console.error('Error querying table:', error);
  }
}

main();
