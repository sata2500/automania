import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const USERS_DIR = path.join(DATA_DIR, 'users');

async function ensureDirs() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(USERS_DIR, { recursive: true });
  } catch {
    // Ignore if directory exists
  }
}

function getFilePath(userId?: string | null, isPreset?: boolean): string {
  if (isPreset) {
    return path.join(DATA_DIR, 'custom-preset.json');
  }
  if (userId) {
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(USERS_DIR, `${safeUserId}-db.json`);
  }
  return path.join(DATA_DIR, 'pod-db.json');
}

export async function GET(request: Request) {
  try {
    await ensureDirs();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const isPreset = searchParams.get('preset') === 'default';

    const filePath = getFilePath(userId, isPreset);
    const data = await fs.readFile(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json({ mockups: [], designs: [], folders: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDirs();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const isPreset = searchParams.get('preset') === 'default';

    const filePath = getFilePath(userId, isPreset);
    const body = await request.json();
    await fs.writeFile(filePath, JSON.stringify(body), 'utf-8');
    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown storage error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureDirs();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const isPreset = searchParams.get('preset') === 'default';

    const filePath = getFilePath(userId, isPreset);
    await fs.unlink(filePath);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
