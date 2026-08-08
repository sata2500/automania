import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local'});

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_custom_sizes JSONB DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_custom_colors JSONB DEFAULT '[]'::jsonb`;
  console.log("Columns added");
}
main();
