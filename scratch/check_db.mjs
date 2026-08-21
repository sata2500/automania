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

// Columns in user_workspaces
const cols = await sql`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'user_workspaces'
  ORDER BY ordinal_position
`;
console.log('Columns:', cols.map(c => `${c.column_name} (${c.data_type})`).join(', '));

// Count and summary
const rows = await sql`
  SELECT 
    user_id,
    jsonb_array_length(mockups) as mockup_count,
    jsonb_array_length(designs) as design_count,
    jsonb_array_length(folders) as folder_count
  FROM user_workspaces
`;
console.log('\nWorkspace rows:');
for (const r of rows) {
  console.log(`  user_id=${r.user_id}, mockups=${r.mockup_count}, designs=${r.design_count}, folders=${r.folder_count}`);
}

// Users table
const users = await sql`SELECT id, email, status FROM users LIMIT 10`;
console.log('\nUsers:', JSON.stringify(users));
