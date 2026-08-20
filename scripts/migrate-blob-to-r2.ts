import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import fs from 'fs';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error('❌ Cloudflare R2 environment variables are missing!');
  console.error('Account:', accountId, 'Bucket:', bucketName, 'Key:', accessKeyId ? 'OK' : 'MISSING');
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

function getContentType(filename: string): string {
  if (filename.endsWith('.webp')) return 'image/webp';
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  if (filename.endsWith('.mp4')) return 'video/mp4';
  if (filename.endsWith('.webm')) return 'video/webm';
  return 'image/webp';
}

async function uploadBufferToR2(buffer: Buffer, key: string, contentType: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  });
  await s3Client.send(command);
}

async function main() {
  console.log('==============================================');
  console.log('🚀 CLOUDFLARE R2 ASSET MIGRATION TOOL (FULL)');
  console.log('==============================================');
  console.log(`📦 Target Bucket: ${bucketName}`);
  console.log('----------------------------------------------');

  // 1. Get all already-uploaded keys in R2 to avoid re-uploading
  console.log('Fetching existing keys in R2 bucket...');
  const existingR2Keys = new Set<string>();
  let hasMore = true;
  let cursor: string | undefined = undefined;
  while (hasMore) {
    const res = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000,
        ContinuationToken: cursor,
      })
    );
    (res.Contents || []).forEach(c => c.Key && existingR2Keys.add(c.Key));
    hasMore = Boolean(res.IsTruncated);
    cursor = res.NextContinuationToken;
  }
  console.log(`Found ${existingR2Keys.size} objects already in Cloudflare R2.`);

  // 2. Extract all keys needed from sample-data.ts and DB
  const sampleDataPath = path.join(process.cwd(), 'src/lib/sample-data.ts');
  const sampleDataContent = fs.readFileSync(sampleDataPath, 'utf8');

  const allKeysToMigrate = new Set<string>();

  // Extract from sample-data.ts (matches both /api/r2/xxx and vercel blob xxx)
  const sampleMatches = sampleDataContent.match(/(?:mockup-optimized|upload-|design-)[a-zA-Z0-9-]+\.(?:webp|png|jpg|jpeg|mp4)/g) || [];
  sampleMatches.forEach(k => allKeysToMigrate.add(k));

  console.log(`🔍 Found ${allKeysToMigrate.size} unique keys in sample-data.ts`);

  // Extract from Neon DB workspaces
  if (process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql`SELECT mockups, designs, etsy_generated_mockups FROM user_workspaces`;
      rows.forEach(row => {
        const rowStr = JSON.stringify(row);
        const matches = rowStr.match(/(?:mockup-optimized|upload-|design-)[a-zA-Z0-9-]+\.(?:webp|png|jpg|jpeg|mp4)/g) || [];
        matches.forEach(k => allKeysToMigrate.add(k));
      });
      console.log(`🔍 Total unique keys after checking Neon DB: ${allKeysToMigrate.size}`);
    } catch (e) {
      console.warn('DB check error:', e);
    }
  }

  const vercelBase = 'https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com';
  const keysList = Array.from(allKeysToMigrate);

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  console.log('----------------------------------------------');
  console.log(`Starting migration for ${keysList.length} files...`);

  for (let i = 0; i < keysList.length; i++) {
    const key = keysList[i];
    if (existingR2Keys.has(key)) {
      skippedCount++;
      continue;
    }

    const downloadUrl = `${vercelBase}/${key}`;
    try {
      const res = await fetch(downloadUrl, {
        headers: process.env.BLOB_READ_WRITE_TOKEN
          ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
          : undefined,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = getContentType(key);

      await uploadBufferToR2(buffer, key, contentType);
      existingR2Keys.add(key);
      successCount++;
      console.log(`[${i + 1}/${keysList.length}] ✅ Uploaded -> ${key} (${(buffer.length / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      console.error(`[${i + 1}/${keysList.length}] ❌ Failed: ${key} -> ${err.message}`);
      failedCount++;
    }
  }

  console.log('----------------------------------------------');
  console.log(`✨ Migration Done: ${successCount} uploaded, ${skippedCount} already existed, ${failedCount} failed.`);
  console.log('----------------------------------------------');

  // 3. Update sample-data.ts to ensure all URLs use /api/r2/<key>
  let updatedSampleData = sampleDataContent;
  updatedSampleData = updatedSampleData.replace(/https:\/\/[^\s"',]*blob\.vercel-storage\.com\/([^\s"',]+)/g, '/api/r2/$1');
  updatedSampleData = updatedSampleData.replace(/https:\/\/[^\s"',]*r2\.dev\/([^\s"',]+)/g, '/api/r2/$1');
  fs.writeFileSync(sampleDataPath, updatedSampleData, 'utf8');
  console.log('✅ src/lib/sample-data.ts verified with /api/r2 paths!');

  // 4. Update Neon DB to ensure all URLs use /api/r2/<key>
  if (process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql`SELECT user_id, mockups, designs, etsy_generated_mockups FROM user_workspaces`;

      for (const row of rows) {
        let mockupsStr = JSON.stringify(row.mockups || []);
        let designsStr = JSON.stringify(row.designs || []);
        let etsyStr = JSON.stringify(row.etsy_generated_mockups || []);

        mockupsStr = mockupsStr.replace(/https:\/\/[^\s"',]*blob\.vercel-storage\.com\/([^\s"',]+)/g, '/api/r2/$1');
        mockupsStr = mockupsStr.replace(/https:\/\/[^\s"',]*r2\.dev\/([^\s"',]+)/g, '/api/r2/$1');

        designsStr = designsStr.replace(/https:\/\/[^\s"',]*blob\.vercel-storage\.com\/([^\s"',]+)/g, '/api/r2/$1');
        designsStr = designsStr.replace(/https:\/\/[^\s"',]*r2\.dev\/([^\s"',]+)/g, '/api/r2/$1');

        etsyStr = etsyStr.replace(/https:\/\/[^\s"',]*blob\.vercel-storage\.com\/([^\s"',]+)/g, '/api/r2/$1');
        etsyStr = etsyStr.replace(/https:\/\/[^\s"',]*r2\.dev\/([^\s"',]+)/g, '/api/r2/$1');

        await sql`
          UPDATE user_workspaces
          SET 
            mockups = ${JSON.parse(mockupsStr)},
            designs = ${JSON.parse(designsStr)},
            etsy_generated_mockups = ${JSON.parse(etsyStr)},
            updated_at = NOW()
          WHERE user_id = ${row.user_id}
        `;
      }
      console.log('✅ Neon DB workspaces verified with /api/r2 paths!');
    } catch (e) {
      console.error('DB update error:', e);
    }
  }

  console.log('==============================================');
  console.log('🎉 ALL DONE!');
  console.log('==============================================');
}

main().catch(console.error);
