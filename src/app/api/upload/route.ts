import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { isR2Configured, uploadToR2 } from '@/lib/r2';

const DATA_DIR = path.join(process.cwd(), '.data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

async function ensureUploadsDir() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch {}
}

async function saveFileLocally(filename: string, buffer: Buffer): Promise<string> {
  await ensureUploadsDir();
  const safeFilename = path.basename(filename);
  const filePath = path.join(UPLOADS_DIR, safeFilename);
  await fs.writeFile(filePath, buffer);
  return `/api/uploads/${safeFilename}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  const contentType = request.headers.get('content-type') || '';

  // 1. Handle Multipart / FormData (Direct File Uploads from Client)
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = path.extname(file.name) || (file.type.startsWith('video/') ? '.mp4' : '.webp');
      const uniqueName = `upload-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
      const fileMime = file.type || (uniqueName.endsWith('.mp4') ? 'video/mp4' : 'image/webp');

      // Primary: Cloudflare R2 Upload
      if (isR2Configured()) {
        try {
          const result = await uploadToR2(buffer, uniqueName, fileMime);
          return NextResponse.json({ success: true, url: result.url });
        } catch (r2Err) {
          console.error('[Upload Route] Cloudflare R2 direct put failed:', r2Err);
        }
      }

      // Fallback: Local file system
      const localUrl = await saveFileLocally(uniqueName, buffer);
      return NextResponse.json({ success: true, url: localUrl });
    } catch (err: any) {
      console.error('[Upload Route] FormData upload error:', err);
      return NextResponse.json({ error: err.message || 'File upload failed' }, { status: 500 });
    }
  }

  // 2. Handle JSON Requests (Base64 dataUrl)
  try {
    const body = await request.json();

    if (body.dataUrl && typeof body.dataUrl === 'string') {
      const dataUrl = body.dataUrl;
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const buffer = Buffer.from(base64Data, 'base64');
      const mime = body.mimeType || (dataUrl.includes(';') ? dataUrl.split(';')[0].replace('data:', '') : 'image/webp');
      const ext = mime.split('/')[1] || 'webp';
      const uniqueName = body.filename || `upload-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      // Primary: Cloudflare R2 Upload
      if (isR2Configured()) {
        try {
          const result = await uploadToR2(buffer, uniqueName, mime);
          return NextResponse.json({ success: true, url: result.url });
        } catch (r2Err) {
          console.error('[Upload Route] Cloudflare R2 base64 put failed:', r2Err);
        }
      }

      // Fallback: Local file system
      const localUrl = await saveFileLocally(uniqueName, buffer);
      return NextResponse.json({ success: true, url: localUrl });
    }

    return NextResponse.json({ error: 'Unrecognized request body format' }, { status: 400 });
  } catch (error: any) {
    console.error('[Upload Route] JSON handling error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload processing failed' },
      { status: 400 }
    );
  }
}
