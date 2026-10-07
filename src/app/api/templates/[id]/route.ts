import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { podTemplates } from '@/db/schema';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';
import { PodTemplateInput } from '@/types/templates';

/**
 * GET /api/templates/[id]
 * Belirli bir şablonun detayını döner.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthoritativeSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [template] = await db
      .select()
      .from(podTemplates)
      .where(and(eq(podTemplates.id, id), eq(podTemplates.userId, session.id)));

    if (!template) {
      return NextResponse.json({ error: 'Şablon bulunamadı.' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('[GET /api/templates/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Şablon yüklenirken bir hata oluştu.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/templates/[id]
 * Şablonu günceller.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthoritativeSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body: Partial<PodTemplateInput> = await req.json();

    // Validasyon
    if (body.name !== undefined && !body.name?.trim()) {
      return NextResponse.json(
        { error: 'Şablon adı boş olamaz.' },
        { status: 400 }
      );
    }

    if (body.mockupConfig) {
      const totalImages =
        (body.mockupConfig.printAreaMockupIds?.length ?? 0) +
        (body.mockupConfig.staticMockupIds?.length ?? 0);
      const totalVideos = body.mockupConfig.videoMockupIds?.length ?? 0;

      if (totalImages > 20) {
        return NextResponse.json(
          { error: 'Etsy limiti: maksimum 20 görsel yüklenebilir.' },
          { status: 400 }
        );
      }
      if (totalVideos > 2) {
        return NextResponse.json(
          { error: 'Etsy limiti: maksimum 2 video yüklenebilir.' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description;
    if (body.mockupConfig !== undefined) updateData.mockupConfig = body.mockupConfig;
    if (body.variationConfig !== undefined) updateData.variationConfig = body.variationConfig;
    if (body.seoHints !== undefined) updateData.seoHints = body.seoHints;
    if (body.automationSchedule !== undefined) updateData.automationSchedule = body.automationSchedule;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const [updated] = await db
      .update(podTemplates)
      .set(updateData)
      .where(and(eq(podTemplates.id, id), eq(podTemplates.userId, session.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Şablon bulunamadı.' }, { status: 404 });
    }

    return NextResponse.json({ template: updated, message: 'Şablon güncellendi.' });
  } catch (error) {
    console.error('[PUT /api/templates/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Şablon güncellenirken bir hata oluştu.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/[id]
 * Şablonu siler.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthoritativeSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [deleted] = await db
      .delete(podTemplates)
      .where(and(eq(podTemplates.id, id), eq(podTemplates.userId, session.id)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Şablon bulunamadı.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Şablon silindi.' });
  } catch (error) {
    console.error('[DELETE /api/templates/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Şablon silinirken bir hata oluştu.' },
      { status: 500 }
    );
  }
}
