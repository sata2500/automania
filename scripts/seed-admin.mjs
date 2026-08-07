/**
 * Seed Admin Script
 * =================
 * Creates or promotes a user to 'admin' role in the Neon PostgreSQL database.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.mjs <email>
 *
 * Example:
 *   npx tsx scripts/seed-admin.mjs owner@mystore.com
 *
 * This script should be run ONCE after your first deployment to designate the first admin.
 * After that, admins can promote other users via the Admin Dashboard.
 */

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  const email = process.argv[2];

  if (!email || !email.includes('@')) {
    console.error('❌ Usage: npx tsx scripts/seed-admin.mjs <email>');
    console.error('   Example: npx tsx scripts/seed-admin.mjs owner@mystore.com');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const cleanEmail = email.trim().toLowerCase();

  try {
    // Ensure users table exists
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(50) DEFAULT 'active',
        provider VARCHAR(50) DEFAULT 'google',
        avatar_url VARCHAR(1000),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Check if user already exists
    const existing = await sql`SELECT id, name, role FROM users WHERE email = ${cleanEmail}`;

    if (existing.length > 0) {
      const user = existing[0];
      if (user.role === 'admin') {
        console.log(`✅ User "${user.name}" (${cleanEmail}) is already an admin.`);
      } else {
        await sql`UPDATE users SET role = 'admin' WHERE email = ${cleanEmail}`;
        console.log(`✅ User "${user.name}" (${cleanEmail}) promoted to admin successfully.`);
        console.log('   → The user must log out and log back in for the new role to take effect.');
      }
    } else {
      // Create a placeholder admin record — will be filled in on first Google login
      const userId = 'user-' + Buffer.from(cleanEmail).toString('base64').replace(/=/g, '').toLowerCase();
      const name = cleanEmail.split('@')[0];
      await sql`
        INSERT INTO users (id, name, email, role, status, provider)
        VALUES (${userId}, ${name}, ${cleanEmail}, 'admin', 'active', 'google')
      `;
      console.log(`✅ Admin placeholder created for "${cleanEmail}".`);
      console.log('   → Log in with this Google account to activate the session.');
    }

    console.log('\n📋 Current admin users:');
    const admins = await sql`SELECT name, email, status FROM users WHERE role = 'admin' ORDER BY created_at`;
    admins.forEach((a) => {
      console.log(`   • ${a.name} <${a.email}> [${a.status}]`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
