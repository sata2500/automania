import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const [key, ...vals] = line.split('=');
  if (key && !key.startsWith('#')) {
    env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const sql = neon(env.DATABASE_URL);

// Find orphaned workspaces (user_id not in users table)
const orphaned = await sql`
  SELECT user_id,
    jsonb_array_length(mockups) as mockup_count,
    jsonb_array_length(designs) as design_count,
    jsonb_array_length(folders) as folder_count
  FROM user_workspaces
  WHERE user_id NOT IN (SELECT id FROM users)
    AND user_id != 'user-default'
`;
console.log('Orphaned workspaces to delete:', JSON.stringify(orphaned, null, 2));

if (orphaned.length === 0) {
  console.log('No orphaned workspaces found.');
  process.exit(0);
}

// Delete them
const deleted = await sql`
  DELETE FROM user_workspaces
  WHERE user_id NOT IN (SELECT id FROM users)
    AND user_id != 'user-default'
  RETURNING user_id
`;
console.log('Deleted:', JSON.stringify(deleted));

// Verify final state
const remaining = await sql`
  SELECT user_id,
    jsonb_array_length(mockups) as mockup_count,
    jsonb_array_length(designs) as design_count,
    jsonb_array_length(folders) as folder_count
  FROM user_workspaces
`;
console.log('\nRemaining workspaces after cleanup:');
for (const r of remaining) {
  console.log(`  user_id=${r.user_id}, mockups=${r.mockup_count}, designs=${r.design_count}, folders=${r.folder_count}`);
}

// Also check totals (what admin stats would show)
const totals = await sql`
  SELECT 
    COALESCE(SUM(jsonb_array_length(mockups)), 0) as total_mockups,
    COALESCE(SUM(jsonb_array_length(designs)), 0) as total_designs,
    COALESCE(SUM(jsonb_array_length(folders)), 0) as total_folders
  FROM user_workspaces
`;
console.log('\nAdmin stats totals would now show:', JSON.stringify(totals[0]));
