/**
 * POST /api/designs/remove-bg
 * =============================
 * Chroma key algoritmasıyla arka planı kaldırır.
 * Body: { imageData: base64, mimeType, threshold?, feather?, keyColor? }
 * Response: { pngBase64, removedRatio, processingTimeMs, quality }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { removeGreenBackground, evaluateChromaKeyQuality } from '@/lib/chroma-key';
import { uploadToR2, isR2Configured } from '@/lib/r2';
import { createOwnedUploadName } from '@/lib/upload-security';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      imageData,
      imageUrl,
      threshold,
      feather,
      keyColor,
    } = body as {
      imageData?: string; // base64
      imageUrl?: string;  // Dış URL veya R2 URL'si
      mimeType?: string;
      threshold?: number;
      feather?: number;
      keyColor?: { r: number; g: number; b: number };
    };

    if (!imageData && !imageUrl) {
      return NextResponse.json({ error: 'imageData veya imageUrl zorunludur.' }, { status: 400 });
    }

    let inputToProcess: string | Buffer | undefined = imageData;

    if (!inputToProcess && imageUrl) {
      try {
        // Next.js (Node.js) fetch require absolute URL.
        const absoluteUrl = imageUrl.startsWith('/') 
          ? new URL(imageUrl, req.nextUrl.origin).href 
          : imageUrl;
          
        const fetchHeaders: HeadersInit = {};
        const cookieStr = req.headers.get('cookie');
        if (cookieStr) {
          fetchHeaders['cookie'] = cookieStr;
        }

        const imageRes = await fetch(absoluteUrl, { headers: fetchHeaders });
        if (!imageRes.ok) throw new Error(`URL fetch hatası: ${imageRes.statusText}`);
        const arrayBuf = await imageRes.arrayBuffer();
        inputToProcess = Buffer.from(arrayBuf);
      } catch (e: any) {
        return NextResponse.json({ error: `Görsel indirilemedi: ${e.message}` }, { status: 400 });
      }
    }

    if (typeof inputToProcess === 'string' && inputToProcess.includes('base64,')) {
      inputToProcess = inputToProcess.split('base64,')[1];
    }

    const result = await removeGreenBackground(inputToProcess!, {
      threshold: threshold ?? 80,
      feather: feather ?? 40,
      keyColor: keyColor ?? { r: 0, g: 255, b: 0 },
    });

    const quality = evaluateChromaKeyQuality(result);
    const pngBase64 = result.pngBuffer.toString('base64');
    let bgRemovedUrl: string | undefined;

    // Eğer imageUrl verildiyse ve R2 kuruluysa direkt R2'ye yükleyip url dönelim
    if (imageUrl && isR2Configured()) {
      const fileName = createOwnedUploadName(session.id, 'bg-removed', 'image/png');
      const uploadResult = await uploadToR2(result.pngBuffer, fileName, 'image/png');
      bgRemovedUrl = uploadResult.url;
    }

    return NextResponse.json({
      pngBase64,
      bgRemovedUrl,
      removedRatio: result.removedRatio,
      processingTimeMs: result.processingTimeMs,
      quality: quality.quality,
      qualityMessage: quality.message,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('[POST /api/designs/remove-bg] Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
