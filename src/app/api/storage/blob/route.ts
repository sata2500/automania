import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { isProtectedUrl } from '@/lib/sample-data';
import {
  extractKeyFromUrlOrKey,
  isR2Configured,
  deleteFromR2,
} from '@/lib/r2';
import { isOwnedUploadName } from '@/lib/upload-security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_URLS_PER_REQUEST = 100;
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), '.data', 'uploads');

function getLocalOwnedFilename(userId: string, value: string): string | null {
  try {
    const parsed = new URL(value, 'http://local.invalid');
    if (parsed.pathname.startsWith('/api/uploads/')) {
      const filename = path.basename(decodeURIComponent(parsed.pathname.slice('/api/uploads/'.length)));
      return isOwnedUploadName(userId, filename) ? filename : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function DELETE(request: Request) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    if (!Array.isArray(body?.urls)) {
      return NextResponse.json({ error: 'Geçersiz veri formatı. "urls" dizisi bekleniyor.' }, { status: 400 });
    }
    if (body.urls.length > MAX_URLS_PER_REQUEST) {
      return NextResponse.json({ error: `Tek istekte en fazla ${MAX_URLS_PER_REQUEST} dosya silinebilir.` }, { status: 413 });
    }

    const urls: string[] = [...new Set((body.urls as unknown[]).filter((url): url is string => typeof url === 'string' && url.length > 0 && url.length <= 2048))];
    const skippedCount = body.urls.length - urls.length;
    const r2Keys: string[] = [];
    const localFilenames: string[] = [];

    for (const url of urls) {
      if (isProtectedUrl(url)) continue;

      const localFilename = getLocalOwnedFilename(session.id, url);
      if (localFilename) {
        localFilenames.push(localFilename);
        continue;
      }

      const key = extractKeyFromUrlOrKey(url);
      if (key && isOwnedUploadName(session.id, key)) r2Keys.push(key);
    }

    let deletedCount = 0;
    let failedCount = 0;

    if (r2Keys.length > 0 && isR2Configured()) {
      try {
        const result = await deleteFromR2(r2Keys);
        deletedCount += result.deletedCount;
      } catch (error) {
        failedCount += r2Keys.length;
        console.error('[Storage Delete] R2 deletion failed:', error instanceof Error ? error.message : 'unknown error');
      }
    }

    for (const filename of localFilenames) {
      try {
        await fs.unlink(path.join(LOCAL_UPLOADS_DIR, filename));
        deletedCount += 1;
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
        if (code !== 'ENOENT') {
          failedCount += 1;
          console.error('[Storage Delete] Local deletion failed:', error instanceof Error ? error.message : 'unknown error');
        }
      }
    }

    return NextResponse.json({
      success: failedCount === 0,
      deletedCount,
      failedCount,
      skippedCount: skippedCount + urls.length - r2Keys.length - localFilenames.length,
    });
  } catch (error) {
    console.error('[Storage Delete] Invalid request:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Silme isteği işlenemedi.' }, { status: 400 });
  }
}
