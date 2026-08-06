import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }
  
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS keyword_pool (
        id VARCHAR(255) PRIMARY KEY,
        keyword VARCHAR(255) UNIQUE NOT NULL,
        usage_count INT DEFAULT 1,
        etsy_score INT DEFAULT 0,
        last_evaluated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('Table keyword_pool created or already exists.');
  } catch (error) {
    console.error('Error creating table:', error);
  }
}

main();
