/**
 * PUT /api/upload/chunk?uploadId=…&index=…
 * Parçalı yüklemenin bir parçası (ham gövde, en fazla 4 MB). Bkz. `chunked-upload`.
 */
import { NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { isR2Configured } from '@/lib/r2';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { isValidUploadId, MAX_CHUNK_BYTES, MAX_CHUNKS, storeChunk } from '@/lib/chunked-upload';

export async function PUT(request: Request) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isR2Configured()) return NextResponse.json({ error: 'Parçalı yükleme için depolama yapılandırılmamış.' }, { status: 503 });

  const url = new URL(request.url);
  const uploadId = url.searchParams.get('uploadId');
  const index = Number(url.searchParams.get('index'));
  if (!isValidUploadId(uploadId) || !Number.isInteger(index) || index < 0 || index >= MAX_CHUNKS) {
    return NextResponse.json({ error: 'Geçersiz parça.' }, { status: 400 });
  }
  const rateLimit = await checkRateLimit(`upload:chunk:${session.id}`, 600, 10 * 60_000);
  if (!rateLimit.allowed) return NextResponse.json({ error: 'Yükleme sınırı aşıldı, biraz sonra deneyin.' }, { status: 429 });

  const data = Buffer.from(await request.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > MAX_CHUNK_BYTES) {
    return NextResponse.json({ error: 'Parça boyutu geçersiz.' }, { status: 413 });
  }
  try {
    await storeChunk(session.id, uploadId, index, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Upload Chunk]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Parça kaydedilemedi.' }, { status: 502 });
  }
}
