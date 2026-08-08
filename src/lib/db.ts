import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@/db/schema';

// Fetch the DATABASE_URL from environment variables
const client = neon(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });

// Keep the raw sql export for backwards compatibility where needed
export const sql = client;

export async function ensureKeywordPoolColumns() {
  console.log('Database init warning: Schema migrations should be handled by Drizzle ORM.');
}

export default client;
