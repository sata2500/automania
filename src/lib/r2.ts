import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

// Helper to determine if R2 credentials are configured
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

// Singleton S3 client instance for Cloudflare R2
let r2ClientInstance: S3Client | null = null;

export function getR2Client(): S3Client {
  if (r2ClientInstance) {
    return r2ClientInstance;
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 environment variables are missing (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).');
  }

  r2ClientInstance = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return r2ClientInstance;
}

export function getBucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not defined.');
  }
  return bucketName;
}

export function getPublicBaseUrl(): string {
  const publicUrl = process.env.R2_PUBLIC_URL || '/api/r2';
  // Ensure no trailing slash
  return publicUrl.replace(/\/+$/, '');
}

/**
 * Generates a public URL for a given object key in R2.
 */
export function getR2ObjectUrl(key: string): string {
  const baseUrl = getPublicBaseUrl();
  const cleanKey = key.startsWith('/') ? key.substring(1) : key;
  return `${baseUrl}/${cleanKey}`;
}

/**
 * Extracts the storage key from a full URL or key string.
 */
export function extractKeyFromUrlOrKey(urlOrKey: string): string {
  if (!urlOrKey) return '';
  if (!urlOrKey.startsWith('http://') && !urlOrKey.startsWith('https://')) {
    let clean = urlOrKey.startsWith('/') ? urlOrKey.substring(1) : urlOrKey;
    if (clean.startsWith('api/r2/')) {
      clean = clean.substring('api/r2/'.length);
    }
    return clean;
  }

  try {
    const parsed = new URL(urlOrKey);
    // Pathname starts with '/' -> e.g. /upload-12345.webp
    let pathname = parsed.pathname.startsWith('/') ? parsed.pathname.substring(1) : parsed.pathname;
    
    if (pathname.startsWith('api/r2/')) {
      pathname = pathname.substring('api/r2/'.length);
    }

    // If URL contains bucket name in path (e.g. /bucketName/upload-123.webp)
    const bucket = process.env.R2_BUCKET_NAME;
    if (bucket && pathname.startsWith(`${bucket}/`)) {
      return pathname.substring(bucket.length + 1);
    }
    
    return pathname;
  } catch {
    return urlOrKey;
  }
}

/**
 * Uploads a Buffer/Uint8Array to Cloudflare R2 bucket.
 */
export async function uploadToR2(
  buffer: Buffer | Uint8Array,
  filename: string,
  contentType: string = 'image/webp'
): Promise<{ url: string; key: string; size: number }> {
  const client = getR2Client();
  const bucket = getBucketName();
  const key = filename.startsWith('/') ? filename.substring(1) : filename;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  await client.send(command);

  const url = getR2ObjectUrl(key);
  return {
    url,
    key,
    size: buffer.length,
  };
}

/**
 * Deletes one or more objects from Cloudflare R2 bucket.
 */
export async function deleteFromR2(urlsOrKeys: string | string[]): Promise<{ deletedCount: number }> {
  const list = Array.isArray(urlsOrKeys) ? urlsOrKeys : [urlsOrKeys];
  const keys = list
    .map(extractKeyFromUrlOrKey)
    .filter(Boolean);

  if (keys.length === 0) {
    return { deletedCount: 0 };
  }

  const client = getR2Client();
  const bucket = getBucketName();

  if (keys.length === 1) {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: keys[0],
    });
    await client.send(command);
    return { deletedCount: 1 };
  }

  // Delete in batches of up to 1000 (S3 API limit)
  let deletedCount = 0;
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: batch.map(k => ({ Key: k })),
        Quiet: true,
      },
    });
    await client.send(command);
    deletedCount += batch.length;
  }

  return { deletedCount };
}

export interface R2ObjectItem {
  key: string;
  size: number;
  lastModified?: Date;
  url: string;
}

/**
 * Lists objects in Cloudflare R2 bucket with optional prefix and pagination.
 */
export async function listR2Objects(options?: {
  prefix?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ objects: R2ObjectItem[]; nextCursor?: string; hasMore: boolean }> {
  const client = getR2Client();
  const bucket = getBucketName();

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: options?.prefix,
    MaxKeys: options?.limit || 1000,
    ContinuationToken: options?.cursor,
  });

  const response = await client.send(command);

  const objects: R2ObjectItem[] = (response.Contents || []).map(item => ({
    key: item.Key || '',
    size: item.Size || 0,
    lastModified: item.LastModified,
    url: getR2ObjectUrl(item.Key || ''),
  }));

  return {
    objects,
    nextCursor: response.NextContinuationToken,
    hasMore: Boolean(response.IsTruncated),
  };
}

/**
 * Fetches total storage stats (used bytes, total count) across the R2 bucket.
 */
export async function getR2Stats(): Promise<{
  totalBytes: number;
  objectCount: number;
}> {
  if (!isR2Configured()) {
    return { totalBytes: 0, objectCount: 0 };
  }

  try {
    let totalBytes = 0;
    let objectCount = 0;
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const res = await listR2Objects({ cursor, limit: 1000 });
      for (const obj of res.objects) {
        totalBytes += obj.size;
        objectCount += 1;
      }
      hasMore = res.hasMore;
      cursor = res.nextCursor;
    }

    return { totalBytes, objectCount };
  } catch (err) {
    console.error('[Cloudflare R2] Failed to calculate bucket stats:', err);
    return { totalBytes: 0, objectCount: 0 };
  }
}
