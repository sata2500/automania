import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userWorkspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthoritativeSession } from '@/lib/auth-server';

function hasTemporaryMediaUrl(value: unknown): boolean {
  return typeof value === 'string' && (value.startsWith('blob:') || value.startsWith('data:'));
}

function payloadContainsTemporaryMedia(body: Record<string, unknown>): boolean {
  const mockups = Array.isArray(body.mockups) ? body.mockups : [];
  const designs = Array.isArray(body.designs) ? body.designs : [];
  const generatedMockups = Array.isArray(body.etsyGeneratedMockups) ? body.etsyGeneratedMockups : [];
  return [
    ...mockups.map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).src : undefined),
    ...designs.map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).src : undefined),
    ...generatedMockups.map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).previewUrl : undefined),
  ].some(hasTemporaryMediaUrl);
}

export async function GET(request: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.id;

    const rows = await db.select().from(userWorkspaces).where(eq(userWorkspaces.userId, userId));

    if (rows.length === 0) {
      return NextResponse.json({ mockups: [], designs: [], folders: [] }, { status: 200 });
    }

    const data = rows[0];

    let parsedModels: { vision?: string; reasoning?: string; generation?: string } = {};
    try {
      if (data.openrouterModel) {
        if (data.openrouterModel.startsWith('{')) {
          parsedModels = JSON.parse(data.openrouterModel);
        } else {
          parsedModels.reasoning = data.openrouterModel;
        }
      }
    } catch(e) {}

    return NextResponse.json({
      mockups: data.mockups || [],
      designs: data.designs || [],
      folders: data.folders || [],
      activeFolderId: data.activeFolderId,
      selectedMockupId: data.selectedMockupId,
      modelVision: parsedModels.vision || null,
      modelReasoning: parsedModels.reasoning || null,
      modelGeneration: parsedModels.generation || null,
      etsyProductTypes: data.etsyProductTypes || null,
      etsyUserNotes: data.etsyUserNotes || null,
      etsyVariationTemplates: data.etsyVariationTemplates || [],
      etsyDefaultTemplates: data.etsyDefaultTemplates || {},
      etsyCustomSizes: data.etsyCustomSizes || [],
      etsyCustomColors: data.etsyCustomColors || [],
      etsyGeneratedMockups: data.etsyGeneratedMockups || [],
    });
  } catch (error) {
    console.error('Storage GET Error:', error);
    return NextResponse.json({ mockups: [], designs: [], folders: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json() as Record<string, unknown>;
    const userId = session.id;

    if (payloadContainsTemporaryMedia(body)) {
      return NextResponse.json({
        success: false,
        error: 'Geçici medya URL’si kaydedilemez. Dosyayı kalıcı depolamaya yeniden yükleyin.',
        code: 'TEMPORARY_MEDIA_URL',
      }, { status: 422 });
    }

    const hasMockups = Array.isArray(body.mockups);
    const hasDesigns = Array.isArray(body.designs);
    const hasFolders = Array.isArray(body.folders);
    const hasProductTypes = body.etsyProductTypes !== undefined;
    const hasUserNotes = body.etsyUserNotes !== undefined;

    const mockupsJson = body.mockups || [];
    const designsJson = body.designs || [];
    const foldersJson = body.folders || [];
    const activeFolderId = body.activeFolderId || null;
    const selectedMockupId = body.selectedMockupId || null;
    const etsyProductTypes = body.etsyProductTypes || null;
    const etsyUserNotes = body.etsyUserNotes || null;
    const hasVariationTemplates = Array.isArray(body.etsyVariationTemplates);
    const variationTemplatesJson = hasVariationTemplates ? body.etsyVariationTemplates : [];
    const hasDefaultTemplates = body.etsyDefaultTemplates !== undefined;
    const defaultTemplatesJson = hasDefaultTemplates ? body.etsyDefaultTemplates : {};
    const hasCustomSizes = Array.isArray(body.etsyCustomSizes);
    const customSizesJson = hasCustomSizes ? body.etsyCustomSizes : [];
    const hasCustomColors = Array.isArray(body.etsyCustomColors);
    const customColorsJson = hasCustomColors ? body.etsyCustomColors : [];
    const hasGeneratedMockups = Array.isArray(body.etsyGeneratedMockups);
    const generatedMockupsJson = hasGeneratedMockups ? body.etsyGeneratedMockups : [];
    
    const hasModelUpdate = body.modelVision !== undefined || body.modelReasoning !== undefined || body.modelGeneration !== undefined;
    const openRouterModel = hasModelUpdate ? JSON.stringify({
      vision: body.modelVision || null,
      reasoning: body.modelReasoning || null,
      generation: body.modelGeneration || null
    }) : null;

    const lastKnownServerTimestamp = typeof body.lastKnownServerTimestamp === 'number' && Number.isFinite(body.lastKnownServerTimestamp)
      ? body.lastKnownServerTimestamp
      : null;

    // 1. Optimistic Concurrency Control
    if (lastKnownServerTimestamp) {
      const checkRows = await db.select({ updatedAt: userWorkspaces.updatedAt }).from(userWorkspaces).where(eq(userWorkspaces.userId, userId));
      if (checkRows.length > 0 && checkRows[0].updatedAt) {
        const serverTime = new Date(checkRows[0].updatedAt).getTime();
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

    // 2. Perform Save
    // Prepare data to insert/update
    const insertData: any = {
      userId,
      mockups: mockupsJson,
      designs: designsJson,
      folders: foldersJson,
      activeFolderId,
      selectedMockupId,
      openrouterModel: openRouterModel,
      etsyProductTypes,
      etsyUserNotes,
      etsyVariationTemplates: variationTemplatesJson,
      etsyDefaultTemplates: defaultTemplatesJson,
      etsyCustomSizes: customSizesJson,
      etsyCustomColors: customColorsJson,
      etsyGeneratedMockups: generatedMockupsJson,
      updatedAt: new Date()
    };

    // Prepare update data, ignoring nulls for things not provided
    const updateData: any = { updatedAt: new Date() };
    if (hasMockups) updateData.mockups = mockupsJson;
    if (hasDesigns) updateData.designs = designsJson;
    if (hasFolders) updateData.folders = foldersJson;
    if (activeFolderId !== undefined) updateData.activeFolderId = activeFolderId;
    if (selectedMockupId !== undefined) updateData.selectedMockupId = selectedMockupId;
    if (openRouterModel !== undefined) updateData.openrouterModel = openRouterModel;
    if (hasProductTypes) updateData.etsyProductTypes = etsyProductTypes;
    if (hasUserNotes) updateData.etsyUserNotes = etsyUserNotes;
    if (hasVariationTemplates) updateData.etsyVariationTemplates = variationTemplatesJson;
    if (hasDefaultTemplates) updateData.etsyDefaultTemplates = defaultTemplatesJson;
    if (hasCustomSizes) updateData.etsyCustomSizes = customSizesJson;
    if (hasCustomColors) updateData.etsyCustomColors = customColorsJson;
    if (hasGeneratedMockups) updateData.etsyGeneratedMockups = generatedMockupsJson;

    await db.insert(userWorkspaces)
      .values(insertData)
      .onConflictDoUpdate({
        target: userWorkspaces.userId,
        set: updateData
      });

    // Fetch the exact Postgres timestamp that was just saved
    const updatedRows = await db.select({ updatedAt: userWorkspaces.updatedAt }).from(userWorkspaces).where(eq(userWorkspaces.userId, userId));
    const finalTimestamp = updatedRows.length > 0 && updatedRows[0].updatedAt 
      ? new Date(updatedRows[0].updatedAt).getTime() 
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
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.id;
    
    await db.insert(userWorkspaces)
      .values({
        userId,
        mockups: [],
        designs: [],
        folders: [],
        activeFolderId: null,
        selectedMockupId: null,
        etsyGeneratedMockups: [],
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: userWorkspaces.userId,
        set: {
          mockups: [],
          designs: [],
          folders: [],
          activeFolderId: null,
          selectedMockupId: null,
          etsyGeneratedMockups: [],
          updatedAt: new Date()
        }
      });

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error) {
    console.error('Storage DELETE Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown delete error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
