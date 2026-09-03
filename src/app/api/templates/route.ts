import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { podTemplates } from '@/db/schema';
import { getSession } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';
import { PodTemplateInput } from '@/types/templates';

/**
 * GET /api/templates
 * Kullanıcının tüm şablonlarını döner.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await db
      .select()
      .from(podTemplates)
      .where(eq(podTemplates.userId, session.id))
      .orderBy(podTemplates.updatedAt);

    return NextResponse.json({ templates, total: templates.length });
  } catch (error) {
    console.error('[GET /api/templates] Error:', error);
    return NextResponse.json(
      { error: 'Şablonlar yüklenirken bir hata oluştu.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates
 * Yeni şablon oluşturur.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: PodTemplateInput = await req.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Şablon adı zorunludur.' },
        { status: 400 }
      );
    }

    // Toplam mockup sayısını kontrol et (ETSY: max 20 görsel, max 2 video)
    const totalImages =
      (body.mockupConfig?.printAreaMockupIds?.length ?? 0) +
      (body.mockupConfig?.staticMockupIds?.length ?? 0);
    const totalVideos = body.mockupConfig?.videoMockupIds?.length ?? 0;

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

    const id = `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const [template] = await db
      .insert(podTemplates)
      .values({
        id,
        userId: session.id,
        name: body.name.trim(),
        description: body.description ?? null,
        mockupConfig: body.mockupConfig ?? {
          printAreaMockupIds: [],
          staticMockupIds: [],
          videoMockupIds: [],
          fabricType: 'all',
          multiPrintAreaSupport: false,
        },
        variationConfig: body.variationConfig ?? {
          rows: [],
          sizes: [],
          colors: [],
        },
        seoHints: body.seoHints ?? {
          productType: '',
          targetAudience: '',
          customNotes: '',
          primaryNiche: '',
        },
        automationSchedule: body.automationSchedule ?? {
          enabled: false,
          cronExpression: '0 9 * * *',
          timezone: 'America/New_York',
          nextRunAt: null,
          listingsPerRun: 1,
          publishMode: 'draft',
        },
        isActive: body.isActive ?? true,
      })
      .returning();

    return NextResponse.json(
      { template, message: 'Şablon başarıyla oluşturuldu.' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/templates] Error:', error);
    return NextResponse.json(
      { error: 'Şablon oluşturulurken bir hata oluştu.' },
      { status: 500 }
    );
  }
}
