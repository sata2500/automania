import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@/db/schema';

// Şema değişiklikleri istek sırasında değil, `npm run db:migrate` (drizzle/) ile uygulanır.
const client = neon(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });

// Keep the raw sql export for backwards compatibility where needed
export const sql = client;

/** Ham `sql` sorgularının döndürdüğü satır tipi. */
export type DbRow = Awaited<ReturnType<typeof client>>[number];

export default client;
