import { neon } from '@neondatabase/serverless';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { list, del } from '@vercel/blob';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const sampleDataPath = path.join(process.cwd(), 'src/lib/sample-data.ts');
const sampleDataContent = fs.readFileSync(sampleDataPath, 'utf8');
const urlMatches = sampleDataContent.match(/https:\/\/[^\s"',]+/g) || [];
const sampleUrls = new Set(urlMatches);

function isProtectedUrl(url: string) {
  return sampleUrls.has(url);
}

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('--- STORAGE GARBAGE COLLECTION (R2 & Vercel Blob) ---');

  // 1. Get all active assets from the database
  console.log('Fetching active workspaces from Neon DB...');
  const rows = await sql`SELECT mockups, designs, etsy_generated_mockups FROM user_workspaces`;

  const activeUrls = new Set<string>();

  rows.forEach(row => {
    try {
      const mockups = typeof row.mockups === 'string' ? JSON.parse(row.mockups) : row.mockups;
      const designs = typeof row.designs === 'string' ? JSON.parse(row.designs) : row.designs;
      const etsyMockups =
        typeof row.etsy_generated_mockups === 'string'
          ? JSON.parse(row.etsy_generated_mockups)
          : row.etsy_generated_mockups;

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

  // 2. Cloudflare R2 Cleanup
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (accountId && accessKeyId && secretAccessKey && bucketName) {
    console.log('\n--- Checking Cloudflare R2 Bucket ---');
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    let r2Cursor: string | undefined = undefined;
    let r2HasMore = true;
    const r2Keys: string[] = [];

    while (r2HasMore) {
      const command: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000,
        ContinuationToken: r2Cursor,
      });
      const res = await s3Client.send(command);
      (res.Contents || []).forEach(c => {
        if (c.Key) r2Keys.push(c.Key);
      });
      r2HasMore = Boolean(res.IsTruncated);
      r2Cursor = res.NextContinuationToken;
    }

    console.log(`Found ${r2Keys.length} total objects in R2 bucket.`);

    const orphanedR2Keys = r2Keys.filter(key => {
      const matchesActive = Array.from(activeUrls).some(u => u.includes(key));
      if (matchesActive) return false;
      const matchesProtected = Array.from(sampleUrls).some(u => u.includes(key));
      if (matchesProtected) return false;
      return true;
    });

    console.log(`Found ${orphanedR2Keys.length} orphaned objects in R2.`);

    if (orphanedR2Keys.length > 0) {
      for (let i = 0; i < orphanedR2Keys.length; i += 1000) {
        const batch = orphanedR2Keys.slice(i, i + 1000);
        await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: { Objects: batch.map(k => ({ Key: k })), Quiet: true },
          })
        );
      }
      console.log(`✅ Deleted ${orphanedR2Keys.length} orphaned objects from Cloudflare R2.`);
    }
  }

  // 3. Vercel Blob Cleanup (if token present)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    console.log('\n--- Checking Vercel Blob Storage ---');
    let hasMore = true;
    let cursor: string | undefined = undefined;
    const allBlobs: any[] = [];

    while (hasMore) {
      try {
        const response = await list({
          token: process.env.BLOB_READ_WRITE_TOKEN,
          limit: 1000,
          cursor,
        });
        allBlobs.push(...response.blobs);
        hasMore = response.hasMore;
        cursor = response.cursor;
      } catch (e) {
        console.warn('Vercel Blob list failed (possibly limit reached):', e);
        break;
      }
    }

    console.log(`Found ${allBlobs.length} blobs in Vercel.`);

    const orphanedBlobs = allBlobs.filter(b => {
      if (activeUrls.has(b.url)) return false;
      if (isProtectedUrl(b.url)) return false;
      return true;
    });

    console.log(`Found ${orphanedBlobs.length} orphaned blobs in Vercel.`);

    if (orphanedBlobs.length > 0) {
      const urlsToDelete = orphanedBlobs.map(b => b.url);
      for (let i = 0; i < urlsToDelete.length; i += 500) {
        const chunk = urlsToDelete.slice(i, i + 500);
        try {
          await del(chunk, { token: process.env.BLOB_READ_WRITE_TOKEN });
          console.log(`Deleted chunk of ${chunk.length} blobs from Vercel.`);
        } catch (e) {
          console.warn('Failed to delete chunk from Vercel:', e);
        }
      }
    }
  }

  console.log('\n✨ Storage garbage collection complete!');
}

main().catch(console.error);
