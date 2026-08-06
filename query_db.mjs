import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    const keywords = await sql`SELECT keyword, usage_count FROM keyword_pool ORDER BY created_at DESC LIMIT 20`;
    console.log('--- EN SON EKLENEN ANAHTAR KELİMELER ---');
    console.table(keywords);
    
  } catch (error) {
    console.error('Error querying table:', error);
  }
}

main();
