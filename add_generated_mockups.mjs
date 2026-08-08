import { sql } from '@vercel/postgres';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function addGeneratedMockups() {
  try {
    await sql`ALTER TABLE user_workspaces ADD COLUMN IF NOT EXISTS etsy_generated_mockups JSONB DEFAULT '[]'::jsonb`;
    console.log('Added etsy_generated_mockups column');
  } catch(e) {
    console.error(e);
  }
}
addGeneratedMockups();
