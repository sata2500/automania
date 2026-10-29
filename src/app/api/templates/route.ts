import { formatValidationError, templateInputSchema } from '@/lib/validation/templates';
import { scheduleUserTick } from '@/lib/automation-scheduler-hook';
import { readCronHeartbeat } from '@/lib/automation-scheduler';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { podTemplates, userWorkspaces } from '@/db/schema';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { and, eq } from 'drizzle-orm';
import { convertLegacyFolderTemplate, parseLegacyFolderConfig } from '@/lib/folder-template';
import type { EtsyVariationRow, MockupItem } from '@/types/pod';

type TemplateRow = typeof podTemplates.$inferSelect;

/**
 * Eski "klasör şablon ayarları" kayıtlarını (açıklamada JSON) tam otomasyon şablonuna çevirir ve kaydeder.
 * Dönüştürülemeyen kayıtlar olduğu gibi döner; liste hiçbir durumda bu yüzden başarısız olmaz.
 */
async function migrateLegacyFolderTemplates(userId: string, templates: TemplateRow[]): Promise<TemplateRow[]> {
  if (!templates.some((t) => parseLegacyFolderConfig(t.description))) return templates;
  try {
    const [workspace] = await db
      .select({ mockups: userWorkspaces.mockups, variationTemplates: userWorkspaces.etsyVariationTemplates })
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, userId))
      .limit(1);
    const context = {
      mockups: (workspace?.mockups as MockupItem[] | null) ?? [],
      variationTemplates: (workspace?.variationTemplates as Array<{ id: string; variations?: EtsyVariationRow[] }> | null) ?? [],
    };
    return await Promise.all(templates.map(async (template) => {
      const patch = convertLegacyFolderTemplate(template as unknown as Parameters<typeof convertLegacyFolderTemplate>[0], context);
      if (!patch) return template;
      const [updated] = await db
        .update(podTemplates)
        .set({ ...patch, updatedAt: new Date() } as Partial<TemplateRow>)
        .where(and(eq(podTemplates.id, template.id), eq(podTemplates.userId, userId)))
        .returning();
      return updated ?? template;
    }));
  } catch (error) {
    console.error('[GET /api/templates] Legacy folder template migration failed:', error instanceof Error ? error.message : error);
    return templates;
  }
}

/**
 * GET /api/templates
 * Kullanıcının tüm şablonlarını döner.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthoritativeSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await db
      .select()
      .from(podTemplates)
      .where(eq(podTemplates.userId, session.id))
      .orderBy(podTemplates.updatedAt);
    const migrated = await migrateLegacyFolderTemplates(session.id, templates);
    scheduleUserTick(session.id, req);
    // Harici zamanlayıcının son çağrısı: arayüz zamanlayıcı kurulmamışsa veya duruksa uyarır.
    const schedulerLastCronAt = await readCronHeartbeat().catch(() => null);

    return NextResponse.json({ templates: migrated, total: migrated.length, schedulerLastCronAt });
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
    const session = await getAuthoritativeSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = templateInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: formatValidationError(parsed.error) }, { status: 400 });
    }
    const body = parsed.data;

    const id = `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const [template] = await db
      .insert(podTemplates)
      .values({
        id,
        userId: session.id,
        name: body.name,
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
