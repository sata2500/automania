import { NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { isOptimizeKind } from '@/lib/media-optimizer';
import { getUploadLimit } from '@/lib/upload-security';
import { persistUpload } from '@/lib/upload-store';

export const maxDuration = 120;

function parseBase64DataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), base64: match[2].replace(/\s/g, '') };
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Dosya yüklenmedi.' }, { status: 400 });
      }

      const mimeType = file.type.toLowerCase();
      if (file.size > getUploadLimit(mimeType)) {
        return NextResponse.json({ error: 'Dosya boyutu izin verilen sınırı aşıyor.' }, { status: 413 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const optimize = formData.get('optimize');
      return await persistUpload(session.id, file.name, mimeType, buffer, isOptimizeKind(optimize) ? optimize : undefined);
    } catch (error) {
      console.error('[Upload Route] FormData upload error:', error instanceof Error ? error.message : 'unknown error');
      return NextResponse.json({ error: 'Dosya yüklenemedi.' }, { status: 400 });
    }
  }

  try {
    const body = await request.json();
    if (typeof body?.dataUrl !== 'string') {
      return NextResponse.json({ error: 'Geçersiz upload gövdesi.' }, { status: 400 });
    }

    if (body.dataUrl.length > 70 * 1024 * 1024) {
      return NextResponse.json({ error: 'Upload gövdesi izin verilen sınırı aşıyor.' }, { status: 413 });
    }

    const parsed = parseBase64DataUrl(body.dataUrl);
    if (!parsed) return NextResponse.json({ error: 'Yalnızca base64 data URL kabul edilir.' }, { status: 400 });

    const requestedMime = typeof body.mimeType === 'string' ? body.mimeType.toLowerCase() : parsed.mimeType;
    if (requestedMime !== parsed.mimeType) {
      return NextResponse.json({ error: 'MIME türü data URL ile eşleşmiyor.' }, { status: 400 });
    }

    const buffer = Buffer.from(parsed.base64, 'base64');
    return await persistUpload(session.id, typeof body.filename === 'string' ? body.filename : 'upload', requestedMime, buffer, isOptimizeKind(body.optimize) ? body.optimize : undefined);
  } catch (error) {
    console.error('[Upload Route] JSON upload error:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Upload işlenemedi.' }, { status: 400 });
  }
}
