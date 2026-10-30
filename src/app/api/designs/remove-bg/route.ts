/**
 * POST /api/designs/remove-bg
 * =============================
 * Arka planı kaldırır. keyColor verilirse (yapay zekâ tasarımı) chroma key; verilmezse zemin türü görselden
 * belirlenir (perde rengi, düz renk; fotoğraf/desen zeminde 422 ile açıklama döner).
 * Body: { imageData?: base64, imageUrl?: string, mimeType?, keyColor? }
 * Response: { pngBase64, bgRemovedUrl?, removedRatio, processingTimeMs, quality }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { removeChromaBackground, evaluateChromaKeyQuality } from '@/lib/chroma-key';
import { BackgroundRemovalError, removeBackgroundAuto } from '@/lib/background-removal';
import { optimizeImageForStorage } from '@/lib/media-optimizer';
import { uploadToR2, isR2Configured } from '@/lib/r2';
import { createOwnedUploadName } from '@/lib/upload-security';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { loadImageForUser, MAX_REMOTE_IMAGE_BYTES, MediaSourceError } from '@/lib/media-source';

export const maxDuration = 60;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}


/** Misafir (oturumsuz) istek: yalnızca tarayıcıdan gönderilen görsel (data URL) işlenir, sonuç saklanmaz. */
function guestKey(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthoritativeSession();
    const rateLimit = session
      ? await checkRateLimit(`image:remove-bg:${session.id}`, 30, 10 * 60_000)
      : await checkRateLimit(`image:remove-bg:guest:${guestKey(req)}`, 10, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Arka plan kaldırma limiti aşıldı. Lütfen biraz sonra tekrar deneyin.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { imageData, imageUrl, keyColor } = body as {
      imageData?: unknown; // base64 (data URL veya ham)
      imageUrl?: unknown;  // Kullanıcının kendi depolama URL'si
      keyColor?: { r?: unknown; g?: unknown; b?: unknown };
    };

    let input: Buffer;
    if (typeof imageData === 'string' && imageData.length > 0) {
      const raw = imageData.includes('base64,') ? imageData.split('base64,')[1] : imageData;
      input = Buffer.from(raw, 'base64');
      if (input.byteLength === 0 || input.byteLength > MAX_REMOTE_IMAGE_BYTES) {
        return NextResponse.json({ error: 'Görsel boyutu geçersiz veya çok büyük.' }, { status: 413 });
      }
    } else if (typeof imageUrl === 'string' && imageUrl.length > 0) {
      if (!session && !imageUrl.startsWith('data:')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      input = await loadImageForUser(session?.id ?? 'guest', imageUrl, { appOrigin: req.nextUrl.origin });
    } else {
      return NextResponse.json({ error: 'imageData veya imageUrl zorunludur.' }, { status: 400 });
    }

    // Perde rengi verildiyse (yapay zekâ ile üretilen tasarım) chroma key; verilmediyse zemin türü
    // görselden belirlenir (perde, düz renk ya da işlenemeyecek karmaşık zemin).
    let pngBuffer: Buffer;
    let removedRatio: number;
    let processingTimeMs: number;
    let quality: ReturnType<typeof evaluateChromaKeyQuality>;
    const startedAt = Date.now();
    if (keyColor && typeof keyColor === 'object') {
      const result = await removeChromaBackground(input, {
        keyColor: {
          r: clampNumber(keyColor.r, 0, 255, 0),
          g: clampNumber(keyColor.g, 0, 255, 255),
          b: clampNumber(keyColor.b, 0, 255, 0),
        },
      });
      ({ pngBuffer, removedRatio, processingTimeMs } = result);
      quality = evaluateChromaKeyQuality(result);
    } else {
      const result = await removeBackgroundAuto(input);
      ({ pngBuffer, removedRatio } = result);
      processingTimeMs = Date.now() - startedAt;
      quality = {
        quality: removedRatio > 0.85 ? 'warning' : 'good',
        message: result.method === 'solid' ? 'Düz renkli zemin kaldırıldı.' : 'Perde rengi zemin kaldırıldı.',
      };
    }

    let bgRemovedUrl: string | undefined;
    // imageUrl verildiyse ve R2 kuruluysa sonucu kullanıcının alanına yükleyip URL dönelim
    if (session && imageUrl && isR2Configured()) {
      // Depoda kayıpsız, en yüksek sıkıştırmalı PNG olarak saklanır.
      const stored = await optimizeImageForStorage(pngBuffer, 'image/png', 'design');
      const fileName = createOwnedUploadName(session.id, 'bg-removed', stored.mimeType);
      const uploadResult = await uploadToR2(stored.buffer, fileName, stored.mimeType);
      bgRemovedUrl = uploadResult.url;
    }

    return NextResponse.json({
      pngBase64: pngBuffer.toString('base64'),
      bgRemovedUrl,
      removedRatio,
      processingTimeMs,
      quality: quality.quality,
      qualityMessage: quality.message,
    });
  } catch (error: unknown) {
    if (error instanceof BackgroundRemovalError) {
      return NextResponse.json({ error: error.message, kind: error.kind }, { status: 422 });
    }
    if (error instanceof MediaSourceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/designs/remove-bg] Error:', error);
    return NextResponse.json({ error: 'Arka plan kaldırılırken bir hata oluştu.' }, { status: 500 });
  }
}
