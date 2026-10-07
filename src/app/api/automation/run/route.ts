/**
 * POST /api/automation/run
 * ========================
 * Bir şablon için tam otomasyon pipeline'ını başlatır.
 * Pipeline adımları:
 *  1. designGeneration  — AI ile yeşil arka planlı tasarım üretimi
 *  2. backgroundRemoval — Chroma key ile arka plan kaldırma
 *  3. mockupRender      — Tasarımı mockuplara yerleştirme
 *  4. videoGeneration   — Veo 3.1 ile video üretimi
 *  5. seoGeneration     — 2026 Etsy SEO içeriği üretimi
 *  6. listingCreation   — Etsy'de taslak/aktif listing oluşturma
 *
 * Run kaydı oluşturulup yanıt hemen döner; pipeline `after()` ile aynı fonksiyon
 * çağrısı içinde, yanıt gönderildikten sonra çalışır (maxDuration sınırı içinde).
 * İlerleme GET /api/automation/poll/[runId] ile takip edilir.
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { automationRuns, podTemplates } from '@/db/schema';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { consumeRateLimit } from '@/lib/request-rate-limit';
import { executeAutomationRun } from '@/lib/automation-runner';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { AutomationRunSteps } from '@/types/templates';

export const maxDuration = 300;

const ALLOWED_TRIGGER_TYPES = new Set(['manual', 'scheduled']);

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = consumeRateLimit(`automation:run:${session.id}`, 5, 60 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Otomasyon çalıştırma limiti aşıldı. Lütfen daha sonra tekrar deneyin.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const body = await req.json().catch(() => ({}));
    const templateId = typeof body.templateId === 'string' ? body.templateId : '';
    const triggerType = ALLOWED_TRIGGER_TYPES.has(body.triggerType) ? body.triggerType : 'manual';

    if (!templateId) {
      return NextResponse.json({ error: 'templateId zorunludur.' }, { status: 400 });
    }

    // Şablonu doğrula
    const [template] = await db
      .select()
      .from(podTemplates)
      .where(and(eq(podTemplates.id, templateId), eq(podTemplates.userId, session.id)));

    if (!template) {
      return NextResponse.json({ error: 'Şablon bulunamadı.' }, { status: 404 });
    }

    if (!template.isActive) {
      return NextResponse.json({ error: 'Şablon pasif durumda.' }, { status: 400 });
    }

    // Aynı şablon için eşzamanlı ikinci bir çalıştırmayı engelle
    const [activeRun] = await db
      .select({ id: automationRuns.id })
      .from(automationRuns)
      .where(and(
        eq(automationRuns.templateId, templateId),
        eq(automationRuns.userId, session.id),
        inArray(automationRuns.status, ['pending', 'running']),
      ))
      .limit(1);
    if (activeRun) {
      return NextResponse.json({ error: 'Bu şablon için zaten devam eden bir çalıştırma var.', runId: activeRun.id }, { status: 409 });
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const initialSteps: AutomationRunSteps = {
      designGeneration:  { status: 'pending' as const },
      backgroundRemoval: { status: 'pending' as const },
      mockupRender:      { status: 'pending' as const },
      videoGeneration:   { status: 'pending' as const },
      seoGeneration:     { status: 'pending' as const },
      listingCreation:   { status: 'pending' as const },
    };

    await db.insert(automationRuns).values({
      id: runId,
      templateId,
      userId: session.id,
      status: 'pending',
      steps: initialSteps,
      triggerType,
    });

    const userId = session.id;
    after(async () => {
      await executeAutomationRun({ runId, templateId, userId });
    });

    return NextResponse.json({
      runId,
      status: 'pending',
      pollUrl: `/api/automation/poll/${runId}`,
      message: 'Otomasyon başlatıldı.',
    });
  } catch (error) {
    console.error('[POST /api/automation/run] Error:', error);
    return NextResponse.json(
      { error: 'Otomasyon başlatılırken hata oluştu.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/automation/run?templateId=...
 * Bir şablonun otomasyon geçmişini döner.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templateId = req.nextUrl.searchParams.get('templateId');
    const condition = templateId
      ? and(eq(automationRuns.userId, session.id), eq(automationRuns.templateId, templateId))
      : eq(automationRuns.userId, session.id);

    const runs = await db
      .select()
      .from(automationRuns)
      .where(condition)
      .orderBy(desc(automationRuns.createdAt))
      .limit(50);

    return NextResponse.json({ runs });
  } catch (error) {
    console.error('[GET /api/automation/run] Error:', error);
    return NextResponse.json(
      { error: 'Çalıştırmalar yüklenirken hata oluştu.' },
      { status: 500 }
    );
  }
}
