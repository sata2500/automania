/**
 * POST /api/designs/optimize — kayıtlı bir tasarımı yeniden işler: saydam kenar boşlukları kırpılır ve
 * kayıpsız, en yüksek sıkıştırmalı PNG olarak saklanır (bkz. media-optimizer). Bu kurallardan önce yüklenmiş
 * tasarımlar Tasarımlar sekmesi açıkken arka planda birer kez buradan geçer. Değişiklik yoksa yeni dosya
 * yazılmaz (`changed: false`). Eski dosya silinmez: otomasyon çalıştırmaları ona bağlı olabilir.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { optimizeImageForStorage } from '@/lib/media-optimizer';
import { uploadToR2, isR2Configured } from '@/lib/r2';
import { createOwnedUploadName } from '@/lib/upload-security';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { loadImageForUser, MediaSourceError } from '@/lib/media-source';
import { getErrorMessage } from '@/lib/errors';

export const maxDuration = 60;

const MAX_DESIGN_BYTES = 100 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isR2Configured()) return NextResponse.json({ error: 'Depolama yapılandırılmamış.' }, { status: 503 });

  const rateLimit = await checkRateLimit(`image:optimize:${session.id}`, 120, 10 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Çok fazla istek; biraz sonra devam edilecek.' }, {
      status: 429,
      headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    });
  }

  const { src } = (await req.json().catch(() => ({}))) as { src?: unknown };
  if (typeof src !== 'string' || !src || src.startsWith('data:') || src.startsWith('blob:')) {
    return NextResponse.json({ error: 'Geçerli bir tasarım adresi gerekli.' }, { status: 400 });
  }

  try {
    const input = await loadImageForUser(session.id, src, { appOrigin: req.nextUrl.origin, maxBytes: MAX_DESIGN_BYTES });
    const sharp = (await import('sharp')).default;
    const meta = await sharp(input).metadata();
    const mimeType = meta.format === 'jpeg' ? 'image/jpeg' : meta.format === 'webp' ? 'image/webp' : 'image/png';
    const result = await optimizeImageForStorage(input, mimeType, 'design');
    if (!result.optimized) {
      return NextResponse.json({ success: true, changed: false, width: result.width, height: result.height });
    }
    const { url } = await uploadToR2(result.buffer, createOwnedUploadName(session.id, 'design-optimized', result.mimeType), result.mimeType);
    return NextResponse.json({
      success: true,
      changed: true,
      url,
      width: result.width,
      height: result.height,
      savedBytes: Math.max(0, input.byteLength - result.buffer.byteLength),
    });
  } catch (error) {
    if (error instanceof MediaSourceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[Design Optimize] Failed', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
