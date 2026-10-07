/**
 * POST /api/designs/remove-bg
 * =============================
 * Chroma key algoritmasıyla arka planı kaldırır.
 * Body: { imageData?: base64, imageUrl?: string, mimeType?, threshold?, feather?, keyColor? }
 * Response: { pngBase64, bgRemovedUrl?, removedRatio, processingTimeMs, quality }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { removeGreenBackground, evaluateChromaKeyQuality } from '@/lib/chroma-key';
import { uploadToR2, isR2Configured } from '@/lib/r2';
import { createOwnedUploadName } from '@/lib/upload-security';
import { consumeRateLimit } from '@/lib/request-rate-limit';
import { loadImageForUser, MAX_REMOTE_IMAGE_BYTES, MediaSourceError } from '@/lib/media-source';

export const maxDuration = 60;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = consumeRateLimit(`image:remove-bg:${session.id}`, 30, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Arka plan kaldırma limiti aşıldı. Lütfen biraz sonra tekrar deneyin.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { imageData, imageUrl, threshold, feather, keyColor } = body as {
      imageData?: unknown; // base64 (data URL veya ham)
      imageUrl?: unknown;  // Kullanıcının kendi depolama URL'si
      threshold?: unknown;
      feather?: unknown;
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
      input = await loadImageForUser(session.id, imageUrl, { appOrigin: req.nextUrl.origin });
    } else {
      return NextResponse.json({ error: 'imageData veya imageUrl zorunludur.' }, { status: 400 });
    }

    const result = await removeGreenBackground(input, {
      threshold: clampNumber(threshold, 0, 441, 80),
      feather: clampNumber(feather, 0, 200, 40),
      keyColor: {
        r: clampNumber(keyColor?.r, 0, 255, 0),
        g: clampNumber(keyColor?.g, 0, 255, 255),
        b: clampNumber(keyColor?.b, 0, 255, 0),
      },
    });

    const quality = evaluateChromaKeyQuality(result);
    let bgRemovedUrl: string | undefined;

    // imageUrl verildiyse ve R2 kuruluysa sonucu kullanıcının alanına yükleyip URL dönelim
    if (imageUrl && isR2Configured()) {
      const fileName = createOwnedUploadName(session.id, 'bg-removed', 'image/png');
      const uploadResult = await uploadToR2(result.pngBuffer, fileName, 'image/png');
      bgRemovedUrl = uploadResult.url;
    }

    return NextResponse.json({
      pngBase64: result.pngBuffer.toString('base64'),
      bgRemovedUrl,
      removedRatio: result.removedRatio,
      processingTimeMs: result.processingTimeMs,
      quality: quality.quality,
      qualityMessage: quality.message,
    });
  } catch (error: unknown) {
    if (error instanceof MediaSourceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/designs/remove-bg] Error:', error);
    return NextResponse.json({ error: 'Arka plan kaldırılırken bir hata oluştu.' }, { status: 500 });
  }
}
