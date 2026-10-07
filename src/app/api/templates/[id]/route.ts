import { formatValidationError, templateUpdateSchema } from '@/lib/validation/templates';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { podTemplates } from '@/db/schema';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

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
    const parsed = templateUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: formatValidationError(parsed.error) }, { status: 400 });
    }
    const body = parsed.data;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updateData.name = body.name;
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
