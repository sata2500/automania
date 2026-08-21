import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { isR2Configured, uploadToR2 } from '@/lib/r2';
import { getAuthoritativeSession } from '@/lib/auth-server';
import {
  createOwnedUploadName,
  detectMimeFromMagicBytes,
  getUploadLimit,
  isAllowedUploadMime,
  validateUploadSize,
} from '@/lib/upload-security';

const DATA_DIR = path.join(process.cwd(), '.data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

async function saveFileLocally(filename: string, buffer: Buffer): Promise<string> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const filePath = path.join(UPLOADS_DIR, path.basename(filename));
  await fs.writeFile(filePath, buffer, { mode: 0o600 });
  return `/api/uploads/${encodeURIComponent(path.basename(filename))}`;
}

async function persistUpload(userId: string, originalName: string, mimeType: string, buffer: Buffer) {
  if (!isAllowedUploadMime(mimeType)) {
    return NextResponse.json({ error: 'Desteklenmeyen dosya türü.' }, { status: 415 });
  }

  const sizeError = validateUploadSize(buffer.byteLength, mimeType);
  if (sizeError) return NextResponse.json({ error: sizeError }, { status: 413 });

  const detectedMime = detectMimeFromMagicBytes(buffer);
  if (detectedMime !== mimeType && !(mimeType === 'video/webm' && detectedMime === null)) {
    return NextResponse.json({ error: 'Dosya içeriği ile MIME türü eşleşmiyor.' }, { status: 415 });
  }

  const filename = createOwnedUploadName(userId, originalName, mimeType);

  if (isR2Configured()) {
    try {
      const result = await uploadToR2(buffer, filename, mimeType);
      return NextResponse.json({ success: true, url: result.url });
    } catch (error) {
      console.error('[Upload Route] R2 upload failed; using local fallback.', error instanceof Error ? error.message : 'unknown error');
    }
  }

  const localUrl = await saveFileLocally(filename, buffer);
  return NextResponse.json({ success: true, url: localUrl });
}

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
      return await persistUpload(session.id, file.name, mimeType, buffer);
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
    return await persistUpload(session.id, typeof body.filename === 'string' ? body.filename : 'upload', requestedMime, buffer);
  } catch (error) {
    console.error('[Upload Route] JSON upload error:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Upload işlenemedi.' }, { status: 400 });
  }
}
