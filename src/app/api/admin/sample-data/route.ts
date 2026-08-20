import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';
import { SAMPLE_MOCKUPS, SAMPLE_DESIGNS, DEFAULT_FOLDERS } from '@/lib/sample-data';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/sample-data
 * Returns the current global sample data statistics and metadata.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      stats: {
        mockupsCount: SAMPLE_MOCKUPS.length,
        designsCount: SAMPLE_DESIGNS.length,
        foldersCount: DEFAULT_FOLDERS.length,
      },
      folders: DEFAULT_FOLDERS,
      mockups: SAMPLE_MOCKUPS,
      designs: SAMPLE_DESIGNS,
    });
  } catch (error: any) {
    console.error('Admin Sample Data GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/sample-data
 * Replaces the global sample template with the admin's current workspace or provided payload.
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

    // If payload is explicitly provided in body, use it
    if (body.mockups && Array.isArray(body.mockups)) {
      folders = body.folders || [];
      mockups = body.mockups || [];
      designs = body.designs || [];
    } else {
      // Otherwise, fetch the calling admin's workspace from Postgres
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

      folders = rows[0].folders || [];
      mockups = rows[0].mockups || [];
      designs = rows[0].designs || [];
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

    // 1. Write pristine code to src/lib/sample-data.ts
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

    // 2. Synchronize user-default workspace in Neon PostgreSQL
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

    return NextResponse.json({
      success: true,
      message: 'Mevcut çalışma alanınız başarıyla sistem genelindeki örnek taslak olarak kaydedildi.',
      stats: {
        foldersCount: folders.length,
        mockupsCount: cleanMockups.length,
        designsCount: cleanDesigns.length,
      },
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

    const defaultFolders: any[] = [];

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

    await sql`
      UPDATE user_workspaces
      SET 
        folders = '[]'::jsonb,
        mockups = '[]'::jsonb,
        designs = '[]'::jsonb,
        etsy_generated_mockups = '[]'::jsonb,
        updated_at = NOW()
      WHERE user_id = 'user-default'
    `;

    return NextResponse.json({
      success: true,
      message: 'Örnek taslak verileri (tüm klasörler, mockup ve tasarımlar) tamamen sıfırlandı.',
      stats: {
        foldersCount: 0,
        mockupsCount: 0,
        designsCount: 0,
      }
    });
  } catch (error: any) {
    console.error('Admin Sample Data DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
