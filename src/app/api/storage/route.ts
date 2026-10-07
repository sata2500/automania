import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userWorkspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { workspaceSaveSchema, type WorkspaceSaveInput } from '@/lib/validation/storage';
import { formatValidationError } from '@/lib/validation/templates';

type WorkspaceInsert = typeof userWorkspaces.$inferInsert;

function hasTemporaryMediaUrl(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('blob:');
}

function payloadContainsTemporaryMedia(body: WorkspaceSaveInput): boolean {
  const mockups = Array.isArray(body.mockups) ? body.mockups : [];
  const designs = Array.isArray(body.designs) ? body.designs : [];
  const generatedMockups = Array.isArray(body.etsyGeneratedMockups) ? body.etsyGeneratedMockups : [];
  return [
    ...mockups.map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).src : undefined),
    ...designs.map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).src : undefined),
    ...generatedMockups.map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).previewUrl : undefined),
  ].some(hasTemporaryMediaUrl);
}

export async function GET(_request: Request) {
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
    } catch {}

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
    // Boş bir 200 yanıtı istemcinin buluttaki veriyi boş sanıp üzerine yazmasına yol açabilir.
    return NextResponse.json({ error: 'Çalışma alanı yüklenemedi.' }, { status: 503, headers: { 'Retry-After': '5' } });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const parsedBody = workspaceSaveSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json({ success: false, error: formatValidationError(parsedBody.error) }, { status: 400 });
    }
    const body = parsedBody.data;
    const userId = session.id;

    if (payloadContainsTemporaryMedia(body)) {
      return NextResponse.json({
        success: false,
        error: 'Geçici medya URL’si kaydedilemez. Dosyayı kalıcı depolamaya yeniden yükleyin.',
        code: 'TEMPORARY_MEDIA_URL',
      }, { status: 422 });
    }

    // Kısmi kayıt: yalnızca gövdede gönderilen alanlar güncellenir.
    const has = (key: keyof WorkspaceSaveInput) => body[key] !== undefined;
    const hasModelUpdate = has('modelVision') || has('modelReasoning') || has('modelGeneration');
    const openRouterModel = hasModelUpdate ? JSON.stringify({
      vision: body.modelVision || null,
      reasoning: body.modelReasoning || null,
      generation: body.modelGeneration || null
    }) : null;

    const lastKnownServerTimestamp = body.lastKnownServerTimestamp ?? null;

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
    const insertData = {
      userId,
      mockups: body.mockups ?? [],
      designs: body.designs ?? [],
      folders: body.folders ?? [],
      activeFolderId: body.activeFolderId ?? null,
      selectedMockupId: body.selectedMockupId ?? null,
      openrouterModel: openRouterModel,
      etsyProductTypes: body.etsyProductTypes || null,
      etsyUserNotes: body.etsyUserNotes || null,
      etsyVariationTemplates: body.etsyVariationTemplates ?? [],
      etsyDefaultTemplates: body.etsyDefaultTemplates ?? {},
      etsyCustomSizes: body.etsyCustomSizes ?? [],
      etsyCustomColors: body.etsyCustomColors ?? [],
      etsyGeneratedMockups: body.etsyGeneratedMockups ?? [],
      updatedAt: new Date()
    } as unknown as WorkspaceInsert;

    // Güncellemede yalnızca gönderilen alanlar yazılır; gönderilmeyenler korunur.
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (has('mockups')) updateData.mockups = body.mockups;
    if (has('designs')) updateData.designs = body.designs;
    if (has('folders')) updateData.folders = body.folders;
    if (has('activeFolderId')) updateData.activeFolderId = body.activeFolderId;
    if (has('selectedMockupId')) updateData.selectedMockupId = body.selectedMockupId;
    if (hasModelUpdate) updateData.openrouterModel = openRouterModel;
    if (has('etsyProductTypes')) updateData.etsyProductTypes = body.etsyProductTypes || null;
    if (has('etsyUserNotes')) updateData.etsyUserNotes = body.etsyUserNotes || null;
    if (has('etsyVariationTemplates')) updateData.etsyVariationTemplates = body.etsyVariationTemplates;
    if (has('etsyDefaultTemplates')) updateData.etsyDefaultTemplates = body.etsyDefaultTemplates;
    if (has('etsyCustomSizes')) updateData.etsyCustomSizes = body.etsyCustomSizes;
    if (has('etsyCustomColors')) updateData.etsyCustomColors = body.etsyCustomColors;
    if (has('etsyGeneratedMockups')) updateData.etsyGeneratedMockups = body.etsyGeneratedMockups;

    await db.insert(userWorkspaces)
      .values(insertData)
      .onConflictDoUpdate({
        target: userWorkspaces.userId,
        set: updateData as Partial<WorkspaceInsert>
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

export async function DELETE(_request: Request) {
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
