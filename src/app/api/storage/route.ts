import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default_guest';
    
    // Preset/Demo datası sorgulanıyorsa
    const isPreset = searchParams.get('preset') === 'default';
    if (isPreset) {
      // Şimdilik demo datasını boş dönebiliriz ya da sample-data.ts'den import edilebilir
      // Ancak storage-service zaten client'ta demo veriyi dolduruyor.
      return NextResponse.json({ mockups: [], designs: [], folders: [] }, { status: 200 });
    }

    const rows = await sql`
      SELECT mockups, designs, folders, active_folder_id, selected_mockup_id
      FROM user_workspaces
      WHERE user_id = ${userId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ mockups: [], designs: [], folders: [] }, { status: 200 });
    }

    const data = rows[0];
    return NextResponse.json({
      mockups: data.mockups || [],
      designs: data.designs || [],
      folders: data.folders || [],
      activeFolderId: data.active_folder_id,
      selectedMockupId: data.selected_mockup_id,
    });
  } catch (error: any) {
    console.error('Storage GET Error:', error);
    return NextResponse.json({ mockups: [], designs: [], folders: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default_guest';
    const body = await request.json();

    const mockupsJson = JSON.stringify(body.mockups || []);
    const designsJson = JSON.stringify(body.designs || []);
    const foldersJson = JSON.stringify(body.folders || []);
    const activeFolderId = body.activeFolderId || null;
    const selectedMockupId = body.selectedMockupId || null;

    await sql`
      INSERT INTO user_workspaces (user_id, mockups, designs, folders, active_folder_id, selected_mockup_id)
      VALUES (
        ${userId}, 
        ${mockupsJson}::jsonb, 
        ${designsJson}::jsonb, 
        ${foldersJson}::jsonb, 
        ${activeFolderId}, 
        ${selectedMockupId}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        mockups = EXCLUDED.mockups,
        designs = EXCLUDED.designs,
        folders = EXCLUDED.folders,
        active_folder_id = EXCLUDED.active_folder_id,
        selected_mockup_id = EXCLUDED.selected_mockup_id,
        updated_at = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error: unknown) {
    console.error('Storage POST Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown storage error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default_guest';

    await sql`DELETE FROM user_workspaces WHERE user_id = ${userId}`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
