import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), '.data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

async function ensureUploadsDir() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }
}

export async function POST(request: Request) {
  try {
    await ensureUploadsDir();

    const contentType = request.headers.get('content-type') || '';

    let buffer: Buffer;
    let fileExtension = 'webp';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
      }

      const fileBuffer = await file.arrayBuffer();
      buffer = Buffer.from(fileBuffer);
      const nameParts = file.name.split('.');
      if (nameParts.length > 1) {
        fileExtension = nameParts.pop()?.toLowerCase() || 'webp';
      }
    } else {
      // JSON body with base64 data URL
      const body = await request.json();
      const { dataUrl, mimeType } = body;

      if (!dataUrl || typeof dataUrl !== 'string') {
        return NextResponse.json({ success: false, error: 'Invalid dataUrl' }, { status: 400 });
      }

      // Check if it's already a URL path (e.g. /api/uploads/...)
      if (dataUrl.startsWith('/api/uploads/') || dataUrl.startsWith('http')) {
        return NextResponse.json({ success: true, url: dataUrl });
      }

      const matches = dataUrl.match(/^data:([a-zA-Z0-9\/\-+.]+);base64,(.+)$/);
      if (!matches) {
        return NextResponse.json({ success: false, error: 'Invalid Base64 format' }, { status: 400 });
      }

      const extractedMime = mimeType || matches[1];
      const base64Data = matches[2];
      buffer = Buffer.from(base64Data, 'base64');

      if (extractedMime.includes('png')) fileExtension = 'png';
      else if (extractedMime.includes('jpeg') || extractedMime.includes('jpg')) fileExtension = 'jpg';
      else if (extractedMime.includes('webm')) fileExtension = 'webm';
      else if (extractedMime.includes('mp4')) fileExtension = 'mp4';
      else if (extractedMime.includes('mov')) fileExtension = 'mov';
      else fileExtension = 'webp';
    }

    const uniqueId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const filename = `${uniqueId}.${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    await fs.writeFile(filePath, buffer);

    const publicUrl = `/api/uploads/${filename}`;
    return NextResponse.json({ success: true, url: publicUrl, filename });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
