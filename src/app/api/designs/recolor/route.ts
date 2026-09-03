import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { recolorDesign } from '@/lib/recolor';
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
      imageUrl,
      mode,
    } = body as {
      imageUrl?: string; 
      mode: 'light_garment' | 'dark_garment';
    };

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl zorunludur.' }, { status: 400 });
    }

    if (mode !== 'light_garment' && mode !== 'dark_garment') {
      return NextResponse.json({ error: 'Geçersiz mod.' }, { status: 400 });
    }

    let inputToProcess: Buffer;

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

    const result = await recolorDesign(inputToProcess, mode);

    let recoloredUrl: string | undefined;

    // R2'ye yükle
    if (isR2Configured()) {
      const fileName = createOwnedUploadName(session.id, `recolor-${mode}`, 'image/png');
      const uploadResult = await uploadToR2(result.pngBuffer, fileName, 'image/png');
      recoloredUrl = uploadResult.url;
    } else {
       // R2 ayarlı değilse base64 dönebiliriz. Genelde ayarlı olmalı.
       recoloredUrl = `data:image/png;base64,${result.pngBuffer.toString('base64')}`;
    }

    return NextResponse.json({
      recoloredUrl,
      processingTimeMs: result.processingTimeMs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('[POST /api/designs/recolor] Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
