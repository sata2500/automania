import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkSettings() {
  const { default: sql } = await import('../src/lib/db');
  
  try {
    const workspaces = await sql`SELECT * FROM user_workspaces`;
    console.log("user_workspaces:", workspaces);
  } catch(e: any) {
    console.log("user_workspaces err:", e.message);
  }

  try {
    const appSettings = await sql`SELECT * FROM app_settings`;
    console.log("app_settings:", appSettings);
  } catch(e: any) {
    console.log("app_settings err:", e.message);
  }
}

checkSettings().catch(console.error);
