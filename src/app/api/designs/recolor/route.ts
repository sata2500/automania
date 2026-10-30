import { NextRequest, NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { recolorDesign } from '@/lib/recolor';
import { optimizeImageForStorage } from '@/lib/media-optimizer';
import { uploadToR2, isR2Configured } from '@/lib/r2';
import { createOwnedUploadName } from '@/lib/upload-security';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { loadImageForUser, MediaSourceError } from '@/lib/media-source';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(`image:recolor:${session.id}`, 30, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Renk dönüştürme limiti aşıldı. Lütfen biraz sonra tekrar deneyin.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { imageUrl, mode } = body as { imageUrl?: unknown; mode?: unknown };

    if (typeof imageUrl !== 'string' || !imageUrl) {
      return NextResponse.json({ error: 'imageUrl zorunludur.' }, { status: 400 });
    }

    if (mode !== 'light_garment' && mode !== 'dark_garment') {
      return NextResponse.json({ error: 'Geçersiz mod.' }, { status: 400 });
    }

    const input = await loadImageForUser(session.id, imageUrl, { appOrigin: req.nextUrl.origin });
    const result = await recolorDesign(input, mode);
    if (!result.hasTransparency) {
      return NextResponse.json({ error: 'Tasarımın arka planı saydam değil. Kumaşa uyarlamadan önce "Arka planı kaldır" ile zemini kaldırın.' }, { status: 422 });
    }
    // Değişecek bir şey yoksa yeni kopya oluşturulmaz.
    if (result.changedRatio < 0.002) {
      return NextResponse.json({ unchanged: true, message: `Bu tasarım zaten ${mode === 'dark_garment' ? 'koyu' : 'açık'} kumaşta iyi görünüyor; değiştirilecek renk bulunamadı.` });
    }

    let recoloredUrl: string;
    if (isR2Configured()) {
      const stored = await optimizeImageForStorage(result.pngBuffer, 'image/png', 'design');
      const fileName = createOwnedUploadName(session.id, `recolor-${mode}`, stored.mimeType);
      const uploadResult = await uploadToR2(stored.buffer, fileName, stored.mimeType);
      recoloredUrl = uploadResult.url;
    } else {
      // R2 ayarlı değilse base64 dönülür (yerel geliştirme).
      recoloredUrl = `data:image/png;base64,${result.pngBuffer.toString('base64')}`;
    }

    return NextResponse.json({
      recoloredUrl,
      processingTimeMs: result.processingTimeMs,
      changedRatio: result.changedRatio,
    });
  } catch (error: unknown) {
    if (error instanceof MediaSourceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/designs/recolor] Error:', error);
    return NextResponse.json({ error: 'Renk dönüşümü sırasında bir hata oluştu.' }, { status: 500 });
  }
}
