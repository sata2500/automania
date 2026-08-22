import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
async function run() {
  const users = await sql`SELECT id, name, email, role, status FROM users`;
  console.log('Users:', users);
}
run().catch(console.error);
