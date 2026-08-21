import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { isOwnedUploadName } from '@/lib/upload-security';

const UPLOADS_DIR = path.join(process.cwd(), '.data', 'uploads');

const MIME_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) return new NextResponse('Not found', { status: 404 });

    const { filename } = await params;
    const safeFilename = path.basename(filename);
    if (!isOwnedUploadName(session.id, safeFilename)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const contentType = MIME_TYPES[ext];
    if (!contentType) return new NextResponse('Not found', { status: 404 });

    const fileBuffer = await fs.readFile(path.join(UPLOADS_DIR, safeFilename));
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
