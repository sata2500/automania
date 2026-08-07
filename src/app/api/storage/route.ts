import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default_guest';
    
    // Preset/Demo datası sorgulanıyorsa
    const isPreset = searchParams.get('preset') === 'default';
    if (isPreset) {
      return NextResponse.json({ mockups: [], designs: [], folders: [] }, { status: 200 });
    }

    const rows = await sql`
      SELECT mockups, designs, folders, active_folder_id, selected_mockup_id, openrouter_key, openrouter_model, etsy_product_types, etsy_user_notes
      FROM user_workspaces
      WHERE user_id = ${userId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ mockups: [], designs: [], folders: [] }, { status: 200 });
    }

    const data = rows[0];
    
    let parsedModels: any = {};
    try {
      if (data.openrouter_model) {
        if (data.openrouter_model.startsWith('{')) {
          parsedModels = JSON.parse(data.openrouter_model);
        } else {
          parsedModels.reasoning = data.openrouter_model;
        }
      }
    } catch(e) {}

    return NextResponse.json({
      mockups: data.mockups || [],
      designs: data.designs || [],
      folders: data.folders || [],
      activeFolderId: data.active_folder_id,
      selectedMockupId: data.selected_mockup_id,
      openRouterKey: data.openrouter_key || null,
      modelVision: parsedModels.vision || null,
      modelReasoning: parsedModels.reasoning || null,
      modelGeneration: parsedModels.generation || null,
      etsyProductTypes: data.etsy_product_types || null,
      etsyUserNotes: data.etsy_user_notes || null,
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

    const hasMockups = Array.isArray(body.mockups);
    const hasDesigns = Array.isArray(body.designs);
    const hasFolders = Array.isArray(body.folders);
    const hasProductTypes = body.etsyProductTypes !== undefined;
    const hasUserNotes = body.etsyUserNotes !== undefined;

    const mockupsJson = JSON.stringify(body.mockups || []);
    const designsJson = JSON.stringify(body.designs || []);
    const foldersJson = JSON.stringify(body.folders || []);
    const activeFolderId = body.activeFolderId || null;
    const selectedMockupId = body.selectedMockupId || null;
    const openRouterKey = body.openRouterKey || null;
    const etsyProductTypes = body.etsyProductTypes || null;
    const etsyUserNotes = body.etsyUserNotes || null;
    
    const hasModelUpdate = body.modelVision !== undefined || body.modelReasoning !== undefined || body.modelGeneration !== undefined;
    const openRouterModel = hasModelUpdate ? JSON.stringify({
      vision: body.modelVision || null,
      reasoning: body.modelReasoning || null,
      generation: body.modelGeneration || null
    }) : null;

    const lastKnownServerTimestamp = body.lastKnownServerTimestamp || null;

    // 1. Optimistic Concurrency Control
    if (lastKnownServerTimestamp) {
      const checkRows = await sql`
        SELECT EXTRACT(EPOCH FROM updated_at) * 1000 AS server_time
        FROM user_workspaces
        WHERE user_id = ${userId}
      `;
      if (checkRows.length > 0 && checkRows[0].server_time) {
        const serverTime = parseFloat(checkRows[0].server_time);
        if (serverTime > lastKnownServerTimestamp + 2000) {
          return NextResponse.json({ 
            success: false, 
            error: 'Conflict: Server has newer data.', 
            conflict: true, 
            serverTime 
          }, { status: 409 });
        }
      }
    }

    // 2. Perform Save - NEVER overwrite existing columns with empty arrays if not passed!
    await sql`
      INSERT INTO user_workspaces (
        user_id, 
        mockups, 
        designs, 
        folders, 
        active_folder_id, 
        selected_mockup_id, 
        openrouter_key, 
        openrouter_model, 
        etsy_product_types, 
        etsy_user_notes
      )
      VALUES (
        ${userId}, 
        ${mockupsJson}::jsonb, 
        ${designsJson}::jsonb, 
        ${foldersJson}::jsonb, 
        ${activeFolderId}, 
        ${selectedMockupId},
        ${openRouterKey},
        ${openRouterModel},
        ${etsyProductTypes},
        ${etsyUserNotes}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        mockups = CASE WHEN ${hasMockups} THEN ${mockupsJson}::jsonb ELSE user_workspaces.mockups END,
        designs = CASE WHEN ${hasDesigns} THEN ${designsJson}::jsonb ELSE user_workspaces.designs END,
        folders = CASE WHEN ${hasFolders} THEN ${foldersJson}::jsonb ELSE user_workspaces.folders END,
        active_folder_id = COALESCE(EXCLUDED.active_folder_id, user_workspaces.active_folder_id),
        selected_mockup_id = COALESCE(EXCLUDED.selected_mockup_id, user_workspaces.selected_mockup_id),
        openrouter_key = COALESCE(EXCLUDED.openrouter_key, user_workspaces.openrouter_key),
        openrouter_model = COALESCE(EXCLUDED.openrouter_model, user_workspaces.openrouter_model),
        etsy_product_types = CASE WHEN ${hasProductTypes} THEN ${etsyProductTypes} ELSE user_workspaces.etsy_product_types END,
        etsy_user_notes = CASE WHEN ${hasUserNotes} THEN ${etsyUserNotes} ELSE user_workspaces.etsy_user_notes END,
        updated_at = CURRENT_TIMESTAMP
    `;

    // Fetch the exact Postgres timestamp that was just saved
    const updatedRows = await sql`
      SELECT EXTRACT(EPOCH FROM updated_at) * 1000 AS server_time
      FROM user_workspaces
      WHERE user_id = ${userId}
    `;
    const finalTimestamp = updatedRows.length > 0 && updatedRows[0].server_time 
      ? parseFloat(updatedRows[0].server_time) 
      : Date.now();

    return NextResponse.json({ success: true, timestamp: finalTimestamp });
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
    console.error('Storage DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
