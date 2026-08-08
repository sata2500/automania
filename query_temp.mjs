import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local'});
const sql = neon(process.env.DATABASE_URL);
sql`SELECT etsy_variation_templates FROM user_workspaces LIMIT 1;`.then(res => console.log(JSON.stringify(res, null, 2))).catch(console.error);
