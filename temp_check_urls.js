const { neon } = require('@neondatabase/serverless');
require('dotenv').config({path:'.env.local'});
const sql = neon(process.env.DATABASE_URL);
async function run() {
  const [{mockups, designs}] = await sql`SELECT mockups, designs FROM user_workspaces`;
  const mUrls = mockups.map(m=>m.src);
  const dUrls = designs.map(d=>d.src);
  const allUrls = [...mUrls, ...dUrls];
  const unique = new Set(allUrls);
  console.log('Total mockups:', mockups.length);
  console.log('Total designs:', designs.length);
  console.log('Total URLs in DB:', allUrls.length);
  console.log('Unique URLs in DB:', unique.size);
}
run().catch(console.error);
