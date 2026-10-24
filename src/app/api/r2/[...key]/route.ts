import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getBucketName, getR2Client, isR2Configured } from '@/lib/r2';
import fs from 'fs';
import path from 'path';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { isAllowedUploadMime, isOwnedUploadName } from '@/lib/upload-security';
import { parseByteRange } from '@/lib/media-range';

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

// Anahtarlar UUID içerdiği için bir anahtarın içeriği hiç değişmez: tarayıcı bir yıl önbellekleyebilir.
// Dosyalar kullanıcıya özel olduğundan paylaşılan önbelleklere (CDN) izin verilmez.
const IMMUTABLE_PRIVATE_CACHE = 'private, max-age=31536000, immutable';

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

    const rangeHeader = request.headers.get('range');
    const ifNoneMatch = request.headers.get('if-none-match');

    // 1. Try Cloudflare R2 first if configured
    if (isR2Configured()) {
      try {
        const client = getR2Client();
        const bucket = getBucketName();

        // Range isteği R2'ye aynen iletilir: video oynatıcı dosyanın tamamını indirmeden ileri sarabilir.
        const response = await client.send(new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          ...(rangeHeader ? { Range: rangeHeader } : {}),
          ...(ifNoneMatch ? { IfNoneMatch: ifNoneMatch } : {}),
        }));

        if (response.Body) {
          const contentType = (response.ContentType || getContentType(objectKey)).split(';')[0].trim().toLowerCase();
          if (!isAllowedUploadMime(contentType)) return new NextResponse('Unsupported media type', { status: 415 });

          const headers: Record<string, string> = {
            'Content-Type': contentType,
            'Cache-Control': IMMUTABLE_PRIVATE_CACHE,
            'Accept-Ranges': 'bytes',
            'X-Content-Type-Options': 'nosniff',
          };
          if (response.ContentLength !== undefined) headers['Content-Length'] = String(response.ContentLength);
          if (response.ETag) headers.ETag = response.ETag;
          if (response.ContentRange) headers['Content-Range'] = response.ContentRange;

          // Gövde belleğe alınmadan akıtılır.
          return new NextResponse(response.Body.transformToWebStream(), {
            status: response.ContentRange ? 206 : 200,
            headers,
          });
        }
      } catch (r2Error: unknown) {
        const errorRecord = r2Error && typeof r2Error === 'object' ? r2Error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } } : {};
        const errorName = typeof errorRecord.name === 'string' ? errorRecord.name : '';
        const httpStatus = errorRecord.$metadata?.httpStatusCode;
        if (httpStatus === 304 || errorName === 'NotModified') {
          return new NextResponse(null, { status: 304, headers: { 'Cache-Control': IMMUTABLE_PRIVATE_CACHE, ETag: ifNoneMatch || '' } });
        }
        if (httpStatus === 416 || errorName === 'InvalidRange') {
          return new NextResponse('Range Not Satisfiable', { status: 416 });
        }
        // Fall through to local fallback if the object is not found in R2.
        if (errorName !== 'NoSuchKey' && httpStatus !== 404) {
          console.warn(`[R2 API Route] R2 fetch error for ${objectKey}.`);
        }
      }
    }

    // 2. Local Fallback (.data/uploads)
    const localPath = path.join(process.cwd(), '.data', 'uploads', path.basename(objectKey));
    if (fs.existsSync(localPath)) {
      const contentType = getContentType(objectKey);
      if (!isAllowedUploadMime(contentType)) return new NextResponse('Unsupported media type', { status: 415 });

      const fileBuffer = fs.readFileSync(localPath);
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Cache-Control': IMMUTABLE_PRIVATE_CACHE,
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
      };
      const range = parseByteRange(rangeHeader, fileBuffer.length);
      if (range === 'unsatisfiable') {
        return new NextResponse('Range Not Satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${fileBuffer.length}` } });
      }
      if (range) {
        const chunk = fileBuffer.subarray(range.start, range.end + 1);
        return new NextResponse(chunk, {
          status: 206,
          headers: { ...headers, 'Content-Length': String(chunk.length), 'Content-Range': `bytes ${range.start}-${range.end}/${fileBuffer.length}` },
        });
      }
      return new NextResponse(fileBuffer, { status: 200, headers: { ...headers, 'Content-Length': String(fileBuffer.length) } });
    }

    return new NextResponse('Object not found in R2 or local storage', { status: 404 });
  } catch (error) {
    console.error('[R2 API Route] Unexpected error:', error instanceof Error ? error.message : 'unknown error');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
