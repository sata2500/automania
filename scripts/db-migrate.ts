/**
 * drizzle/ klasöründeki migration'ları uygular.
 *
 *   npm run db:migrate
 *
 * Yeni migration üretmek için önce src/db/schema.ts güncellenir, ardından
 * `npm run db:generate -- --name <açıklama>` çalıştırılır.
 */
import * as dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const db = drizzle(neon(process.env.DATABASE_URL));
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('Migrations applied.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
