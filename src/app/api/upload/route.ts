import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

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

  // 1. Handle Multipart / FormData (Direct File Uploads)
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uniqueName = `upload-${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.name) || '.webp'}`;

      // Try Vercel Blob if token is configured
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (token) {
        try {
          const blob = await put(uniqueName, buffer, {
            access: 'public',
            contentType: file.type || 'image/webp',
            token,
          });
          return NextResponse.json({ success: true, url: blob.url });
        } catch (blobErr) {
          console.warn('[Upload Route] Vercel Blob direct put failed, falling back to local storage:', blobErr);
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

  // 2. Handle JSON Requests (Base64 dataUrl or Vercel Blob client token handshake)
  try {
    const body = await request.json();

    // 2a. Direct Base64 dataUrl upload
    if (body.dataUrl && typeof body.dataUrl === 'string') {
      const dataUrl = body.dataUrl;
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const buffer = Buffer.from(base64Data, 'base64');
      const mime = body.mimeType || (dataUrl.includes(';') ? dataUrl.split(';')[0].replace('data:', '') : 'image/webp');
      const ext = mime.split('/')[1] || 'webp';
      const uniqueName = body.filename || `upload-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (token) {
        try {
          const blob = await put(uniqueName, buffer, {
            access: 'public',
            contentType: mime,
            token,
          });
          return NextResponse.json({ success: true, url: blob.url });
        } catch (blobErr) {
          console.warn('[Upload Route] Vercel Blob base64 put failed, falling back to local storage:', blobErr);
        }
      }

      const localUrl = await saveFileLocally(uniqueName, buffer);
      return NextResponse.json({ success: true, url: localUrl });
    }

    // 2b. Vercel Blob Client Token Generation Handshake
    if (body.type === 'blob.generate-client-token') {
      const jsonResponse = await handleUpload({
        body: body as HandleUploadBody,
        request,
        onBeforeGenerateToken: async () => {
          return {
            allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
            tokenPayload: JSON.stringify({}),
          };
        },
      });

      return NextResponse.json(jsonResponse);
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

