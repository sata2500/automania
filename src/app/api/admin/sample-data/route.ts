import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';
import { SAMPLE_MOCKUPS, SAMPLE_DESIGNS, DEFAULT_FOLDERS } from '@/lib/sample-data';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/admin/sample-data
 * Returns the current global sample data statistics from database (with fallback to static constants).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch user-default template from Neon PostgreSQL
    const rows = await sql`
      SELECT folders, mockups, designs 
      FROM user_workspaces 
      WHERE user_id = 'user-default'
    `;

    let folders: any[] = DEFAULT_FOLDERS;
    let mockups: any[] = SAMPLE_MOCKUPS;
    let designs: any[] = SAMPLE_DESIGNS;

    if (rows.length > 0) {
      const parse = (v: any) => {
        try { return typeof v === 'string' ? JSON.parse(v) : (Array.isArray(v) ? v : []); }
        catch { return []; }
      };
      folders = parse(rows[0].folders);
      mockups = parse(rows[0].mockups);
      designs = parse(rows[0].designs);
    }

    return NextResponse.json({
      success: true,
      stats: {
        mockupsCount: mockups.length,
        designsCount: designs.length,
        foldersCount: folders.length,
      },
      folders,
      mockups,
      designs,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    });
  } catch (error: any) {
    console.error('Admin Sample Data GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/sample-data
 * Replaces the global sample template with the admin's current workspace.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let folders: any[] = [];
    let mockups: any[] = [];
    let designs: any[] = [];

    const body = await request.json().catch(() => ({}));

    if (body.mockups && Array.isArray(body.mockups)) {
      folders = body.folders || [];
      mockups = body.mockups || [];
      designs = body.designs || [];
    } else {
      // Fetch the calling admin's workspace from Postgres
      const rows = await sql`
        SELECT folders, mockups, designs 
        FROM user_workspaces 
        WHERE user_id = ${session.id}
      `;

      if (rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Çalışma alanınızda kayıtlı herhangi bir veri bulunamadı. Lütfen önce çalışma alanınıza mockup ve tasarımlarınızı ekleyin.',
        }, { status: 400 });
      }

      const parse = (v: any) => {
        try { return typeof v === 'string' ? JSON.parse(v) : (Array.isArray(v) ? v : []); }
        catch { return []; }
      };
      folders = parse(rows[0].folders);
      mockups = parse(rows[0].mockups);
      designs = parse(rows[0].designs);
    }

    // Normalize types
    const cleanMockups = mockups.map((m: any) => ({
      id: m.id,
      name: m.name,
      src: m.src,
      width: m.width || 2400,
      height: m.height || 2000,
      opacity: m.opacity ?? 1,
      folderId: m.folderId,
      apparelType: m.apparelType || 'any',
      printAreas: m.printAreas || [],
      hasPrintArea: m.hasPrintArea ?? true,
      isVideo: m.isVideo ?? false,
      mimeType: m.mimeType,
    }));

    const cleanDesigns = designs.map((d: any) => ({
      id: d.id,
      name: d.name,
      src: d.src,
      width: d.width || 1024,
      height: d.height || 1024,
      targetApparel: d.targetApparel || (d.apparelType === 'dark' ? 'dark' : d.apparelType === 'light' ? 'light' : 'both'),
      folderId: d.folderId,
    }));

    // 1. Synchronize user-default workspace in Neon PostgreSQL (Primary Source of Truth)
    await sql`
      INSERT INTO user_workspaces (user_id, folders, mockups, designs, etsy_generated_mockups, updated_at)
      VALUES (
        'user-default',
        ${JSON.stringify(folders)}::jsonb,
        ${JSON.stringify(cleanMockups)}::jsonb,
        ${JSON.stringify(cleanDesigns)}::jsonb,
        '[]'::jsonb,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        folders = ${JSON.stringify(folders)}::jsonb,
        mockups = ${JSON.stringify(cleanMockups)}::jsonb,
        designs = ${JSON.stringify(cleanDesigns)}::jsonb,
        etsy_generated_mockups = '[]'::jsonb,
        updated_at = NOW()
    `;

    // 2. Best-effort update to local file if writable (fails gracefully on read-only serverless like Vercel)
    try {
      const sampleDataCode = `import { MockupItem, DesignItem, MockupFolder, MockupPreset } from '@/types/pod';

export const DEFAULT_FOLDERS: MockupFolder[] = ${JSON.stringify(folders, null, 2)};

export const SAMPLE_MOCKUPS: MockupItem[] = ${JSON.stringify(cleanMockups, null, 2)};

export const SAMPLE_DESIGNS: DesignItem[] = ${JSON.stringify(cleanDesigns, null, 2)};

export const SAMPLE_PRESETS: MockupPreset[] = [];

export function isProtectedUrl(url: string): boolean {
  if (!url) return false;
  const isProtectedMockup = SAMPLE_MOCKUPS.some(
    m => m.src === url || url.includes(m.src) || (m.src && url.endsWith(m.src.replace('/api/r2/', '')))
  );
  const isProtectedDesign = SAMPLE_DESIGNS.some(
    d => d.src === url || url.includes(d.src) || (d.src && url.endsWith(d.src.replace('/api/r2/', '')))
  );
  return isProtectedMockup || isProtectedDesign;
}
`;
      const sampleFilePath = path.join(process.cwd(), 'src', 'lib', 'sample-data.ts');
      fs.writeFileSync(sampleFilePath, sampleDataCode, 'utf8');
    } catch (fsErr) {
      // Ignored on serverless environments (read-only file system)
    }

    return NextResponse.json({
      success: true,
      message: 'Mevcut çalışma alanınız başarıyla sistem genelindeki örnek taslak olarak kaydedildi.',
      stats: {
        foldersCount: folders.length,
        mockupsCount: cleanMockups.length,
        designsCount: cleanDesigns.length,
      },
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error: any) {
    console.error('Admin Sample Data POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/sample-data
 * Clears the global sample data template.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Reset user-default workspace in Neon PostgreSQL
    await sql`
      INSERT INTO user_workspaces (user_id, folders, mockups, designs, etsy_generated_mockups, updated_at)
      VALUES (
        'user-default',
        '[]'::jsonb,
        '[]'::jsonb,
        '[]'::jsonb,
        '[]'::jsonb,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET 
        folders = '[]'::jsonb,
        mockups = '[]'::jsonb,
        designs = '[]'::jsonb,
        etsy_generated_mockups = '[]'::jsonb,
        updated_at = NOW()
    `;

    // 2. Best-effort update to local file if writable
    try {
      const sampleDataCode = `import { MockupItem, DesignItem, MockupFolder, MockupPreset } from '@/types/pod';

export const DEFAULT_FOLDERS: MockupFolder[] = [];

export const SAMPLE_MOCKUPS: MockupItem[] = [];

export const SAMPLE_DESIGNS: DesignItem[] = [];

export const SAMPLE_PRESETS: MockupPreset[] = [];

export function isProtectedUrl(url: string): boolean {
  return false;
}
`;
      const sampleFilePath = path.join(process.cwd(), 'src', 'lib', 'sample-data.ts');
      fs.writeFileSync(sampleFilePath, sampleDataCode, 'utf8');
    } catch (fsErr) {
      // Ignored on serverless environments
    }

    return NextResponse.json({
      success: true,
      message: 'Örnek taslak verileri (tüm klasörler, mockup ve tasarımlar) tamamen sıfırlandı.',
      stats: {
        foldersCount: 0,
        mockupsCount: 0,
        designsCount: 0,
      }
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error: any) {
    console.error('Admin Sample Data DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
