/**
 * POST /api/upload/complete
 * { uploadId, total, filename, mimeType, optimize? } — parçaları birleştirip doğrular, gerekirse sıkıştırır
 * ve kalıcı dosyayı yazar. Yanıt /api/upload ile aynıdır.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { isR2Configured } from '@/lib/r2';
import { isAllowedUploadMime } from '@/lib/upload-security';
import { persistUpload } from '@/lib/upload-store';
import {
  assembleChunks,
  deleteChunks,
  isValidUploadId,
  MAX_CHUNKED_IMAGE_BYTES,
  MAX_CHUNKED_VIDEO_BYTES,
  MAX_CHUNKS,
} from '@/lib/chunked-upload';

export const maxDuration = 120;

const schema = z.object({
  uploadId: z.string(),
  total: z.number().int().min(1).max(MAX_CHUNKS),
  filename: z.string().max(200).default('upload'),
  mimeType: z.string().max(100),
  optimize: z.enum(['design', 'photo']).optional(),
});

export async function POST(request: Request) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isR2Configured()) return NextResponse.json({ error: 'Parçalı yükleme için depolama yapılandırılmamış.' }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isValidUploadId(parsed.data.uploadId)) {
    return NextResponse.json({ error: 'Geçersiz yükleme isteği.' }, { status: 400 });
  }
  const { uploadId, total, filename, optimize } = parsed.data;
  const mimeType = parsed.data.mimeType.toLowerCase();
  if (!isAllowedUploadMime(mimeType)) return NextResponse.json({ error: 'Desteklenmeyen dosya türü.' }, { status: 415 });
  const limit = mimeType.startsWith('video/') ? MAX_CHUNKED_VIDEO_BYTES : MAX_CHUNKED_IMAGE_BYTES;

  try {
    const buffer = await assembleChunks(session.id, uploadId, total, limit);
    return await persistUpload(session.id, filename, mimeType, buffer, optimize, limit);
  } catch (error) {
    console.error('[Upload Complete]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dosya birleştirilemedi.' }, { status: 400 });
  } finally {
    await deleteChunks(session.id, uploadId, total).catch(() => {});
  }
}
