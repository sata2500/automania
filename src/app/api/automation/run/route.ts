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
 * Vercel timeout kısıtı nedeniyle bu route sadece run kaydını oluşturur
 * ve ilk adımı (designGeneration) başlatır. Kalan adımlar
 * GET /api/automation/poll/[runId] SSE endpoint'i üzerinden takip edilir.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { automationRuns, podTemplates } from '@/db/schema';
import { getSession } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';
import { AutomationRunSteps } from '@/types/templates';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { templateId, triggerType = 'manual' } = body;

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

    // Yeni run kaydı oluştur
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const initialSteps: AutomationRunSteps = {
      designGeneration:  { status: 'pending' as const },
      backgroundRemoval: { status: 'pending' as const },
      mockupRender:      { status: 'pending' as const },
      videoGeneration:   { status: 'pending' as const },
      seoGeneration:     { status: 'pending' as const },
      listingCreation:   { status: 'pending' as const },
    };

    const [run] = await db
      .insert(automationRuns)
      .values({
        id: runId,
        templateId,
        userId: session.id,
        status: 'pending',
        steps: initialSteps,
        triggerType,
      })
      .returning();

    // Pipeline'ı arka planda başlat (fire-and-forget)
    // Vercel Edge'de uzun işlem yapamayız — /api/automation/execute endpoint'ine POST at
    const executeUrl = new URL('/api/automation/execute', req.url);

    // Arka plan isteği (non-blocking)
    fetch(executeUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Internal auth token (güvenlik için)
        'X-Internal-Token': process.env.INTERNAL_API_TOKEN ?? 'dev-internal',
      },
      body: JSON.stringify({ runId, templateId, userId: session.id }),
    }).catch(err => {
      console.error('[Automation] Execute endpoint hatası:', err);
    });

    return NextResponse.json({
      runId,
      status: 'pending',
      message: 'Otomasyon başlatıldı. İlerlemeyi /api/automation/poll/' + runId + ' üzerinden takip edin.',
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
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get('templateId');

    let query = db
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.userId, session.id));

    if (templateId) {
      query = db
        .select()
        .from(automationRuns)
        .where(and(
          eq(automationRuns.userId, session.id),
          eq(automationRuns.templateId, templateId)
        ));
    }

    const runs = await query.limit(50);

    return NextResponse.json({ runs });
  } catch (error) {
    console.error('[GET /api/automation/run] Error:', error);
    return NextResponse.json(
      { error: 'Çalıştırmalar yüklenirken hata oluştu.' },
      { status: 500 }
    );
  }
}
