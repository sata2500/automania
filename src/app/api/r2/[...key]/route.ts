import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getBucketName, getR2Client, isR2Configured } from '@/lib/r2';
import fs from 'fs';
import path from 'path';

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.webp') return 'image/webp';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  return 'application/octet-stream';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = (await params) || {};
    const rawKey = Array.isArray(key) ? key.join('/') : (key || '');
    const objectKey = decodeURIComponent(rawKey);

    if (!objectKey) {
      return new NextResponse('File key is missing', { status: 400 });
    }

    // 1. Try Cloudflare R2 first if configured
    if (isR2Configured()) {
      try {
        const client = getR2Client();
        const bucket = getBucketName();

        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        });

        const response = await client.send(command);

        if (response.Body) {
          const contentType = response.ContentType || getContentType(objectKey);
          const bytes = await response.Body.transformToByteArray();

          return new NextResponse(Buffer.from(bytes), {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': bytes.length.toString(),
              'Cache-Control': 'public, max-age=31536000, immutable',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            },
          });
        }
      } catch (r2Error: any) {
        // Fallthrough to local fallback if not found in R2
        if (r2Error.name !== 'NoSuchKey' && r2Error.$metadata?.httpStatusCode !== 404) {
          console.warn(`[R2 API Route] R2 fetch error for ${objectKey}:`, r2Error.message);
        }
      }
    }

    // 2. Local Fallback (.data/uploads)
    const localPath = path.join(process.cwd(), '.data', 'uploads', path.basename(objectKey));
    if (fs.existsSync(localPath)) {
      const fileBuffer = fs.readFileSync(localPath);
      const contentType = getContentType(objectKey);

      // Async sync to R2 in background if configured
      if (isR2Configured()) {
        try {
          const client = getR2Client();
          const bucket = getBucketName();
          client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: objectKey,
              Body: fileBuffer,
              ContentType: contentType,
              CacheControl: 'public, max-age=31536000, immutable',
            })
          ).catch((e) => console.warn('[R2 Sync Error]', e.message));
        } catch {}
      }

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        },
      });
    }

    return new NextResponse('Object not found in R2 or local storage', { status: 404 });
  } catch (error: any) {
    console.error('[R2 API Route] Unexpected error:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
