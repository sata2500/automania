import { neon } from '@neondatabase/serverless';
import { list, del } from '@vercel/blob';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// We mock isProtectedUrl so we don't have to compile Next.js aliases
const sampleDataPath = path.join(process.cwd(), 'src/lib/sample-data.ts');
const sampleDataContent = fs.readFileSync(sampleDataPath, 'utf8');

// A very naive but effective way to get all sample URLs from sample-data.ts
const urlMatches = sampleDataContent.match(/https:\/\/[^\s"',]+/g) || [];
const sampleUrls = new Set(urlMatches);

function isProtectedUrl(url: string) {
  return sampleUrls.has(url);
}

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('--- BLOB GARBAGE COLLECTION ---');
  
  // 1. Get all active blobs from the database
  console.log('Fetching active workspaces from Neon DB...');
  const rows = await sql`SELECT mockups, designs, etsy_generated_mockups FROM user_workspaces`;
  
  const activeUrls = new Set<string>();
  
  rows.forEach(row => {
    try {
      const mockups = typeof row.mockups === 'string' ? JSON.parse(row.mockups) : row.mockups;
      const designs = typeof row.designs === 'string' ? JSON.parse(row.designs) : row.designs;
      const etsyMockups = typeof row.etsy_generated_mockups === 'string' ? JSON.parse(row.etsy_generated_mockups) : row.etsy_generated_mockups;
      
      if (Array.isArray(mockups)) {
        mockups.forEach((m: any) => m.src && activeUrls.add(m.src));
      }
      if (Array.isArray(designs)) {
        designs.forEach((d: any) => d.src && activeUrls.add(d.src));
      }
      if (Array.isArray(etsyMockups)) {
        etsyMockups.forEach((m: any) => m.previewUrl && activeUrls.add(m.previewUrl));
      }
    } catch (e) {
      console.error('Failed to parse a row', e);
    }
  });

  console.log(`Found ${activeUrls.size} active URLs in the database.`);
  console.log(`Found ${sampleUrls.size} protected sample URLs.`);

  // 2. Get all blobs from Vercel
  console.log('Fetching all blobs from Vercel Blob...');
  let hasMore = true;
  let cursor: string | undefined = undefined;
  
  const allBlobs: any[] = [];
  
  while (hasMore) {
    const response = await list({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      limit: 1000,
      cursor
    });
    
    allBlobs.push(...response.blobs);
    hasMore = response.hasMore;
    cursor = response.cursor;
  }
  
  console.log(`Found ${allBlobs.length} blobs in Vercel.`);
  
  // 3. Find orphaned blobs
  const orphanedBlobs = allBlobs.filter(b => {
    // Keep it if it's in the DB
    if (activeUrls.has(b.url)) return false;
    // Keep it if it's protected (sample data)
    if (isProtectedUrl(b.url)) return false;
    // Otherwise, it's orphaned
    return true;
  });
  
  console.log(`Found ${orphanedBlobs.length} orphaned blobs to delete.`);
  
  // 4. Delete orphaned blobs
  if (orphanedBlobs.length > 0) {
    console.log('Deleting orphaned blobs...');
    const urlsToDelete = orphanedBlobs.map(b => b.url);
    
    // Delete in chunks of 500
    for (let i = 0; i < urlsToDelete.length; i += 500) {
      const chunk = urlsToDelete.slice(i, i + 500);
      await del(chunk, { token: process.env.BLOB_READ_WRITE_TOKEN });
      console.log(`Deleted chunk of ${chunk.length} blobs.`);
    }
    console.log('Garbage collection complete!');
  } else {
    console.log('No orphaned blobs found. Storage is clean.');
  }
}

main().catch(console.error);
