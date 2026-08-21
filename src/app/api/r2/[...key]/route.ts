import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getBucketName, getR2Client, isR2Configured } from '@/lib/r2';
import fs from 'fs';
import path from 'path';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { isAllowedUploadMime, isOwnedUploadName } from '@/lib/upload-security';

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
    const session = await getAuthoritativeSession();
    if (!session) return new NextResponse('Unauthorized', { status: 401 });

    const { key } = (await params) || {};
    const rawKey = Array.isArray(key) ? key.join('/') : (key || '');
    const objectKey = decodeURIComponent(rawKey);

    if (!objectKey) {
      return new NextResponse('File key is missing', { status: 400 });
    }
    if (!isOwnedUploadName(session.id, objectKey)) {
      return new NextResponse('Forbidden', { status: 403 });
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
          const contentType = (response.ContentType || getContentType(objectKey)).split(';')[0].trim().toLowerCase();
          if (!isAllowedUploadMime(contentType)) return new NextResponse('Unsupported media type', { status: 415 });
          const bytes = await response.Body.transformToByteArray();

          return new NextResponse(Buffer.from(bytes), {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': bytes.length.toString(),
              'Cache-Control': 'private, max-age=3600',
              'Access-Control-Allow-Origin': request.headers.get('origin') || 'null',
              'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            },
          });
        }
      } catch (r2Error: unknown) {
        // Fall through to local fallback if the object is not found in R2.
        const errorRecord = r2Error && typeof r2Error === 'object' ? r2Error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } } : {};
        const errorName = typeof errorRecord.name === 'string' ? errorRecord.name : '';
        const httpStatus = errorRecord.$metadata?.httpStatusCode;
        if (errorName !== 'NoSuchKey' && httpStatus !== 404) {
          console.warn(`[R2 API Route] R2 fetch error for ${objectKey}.`);
        }
      }
    }

    // 2. Local Fallback (.data/uploads)
    const localPath = path.join(process.cwd(), '.data', 'uploads', path.basename(objectKey));
    if (fs.existsSync(localPath)) {
      const fileBuffer = fs.readFileSync(localPath);
      const contentType = getContentType(objectKey);
      if (!isAllowedUploadMime(contentType)) return new NextResponse('Unsupported media type', { status: 415 });

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
  } catch (error) {
    console.error('[R2 API Route] Unexpected error:', error instanceof Error ? error.message : 'unknown error');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
