/**
 * POST /api/templates/folder-config
 * ===================================
 * Mockup klasörüne bağlı sade şablon config'ini kayıt eder.
 * Klasör ID'si = Pod Template ID olarak kullanılır.
 *
 * Config verisi `description` alanında JSON string olarak saklanır,
 * böylece ayrı bir migration gerekmez.
 *
 * Body: { folderId, folderName, config: { variationTemplateId?, variationTemplateName?, taxonomyId?, taxonomyPath?, automationSchedule? } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { podTemplates } from '@/db/schema';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthoritativeSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { folderId, folderName, config } = body as {
      folderId: string;
      folderName: string;
      config: Record<string, unknown>;
    };

    if (!folderId) {
      return NextResponse.json({ error: 'folderId zorunludur.' }, { status: 400 });
    }

    // Config'i JSON string olarak description alanına sakla
    const descriptionJson = JSON.stringify({ __folderConfig: true, ...config });

    // Schedule config varsa automationSchedule alanına da yaz
    const automationSchedule = config.automationSchedule as Record<string, unknown> | undefined;

    // Mevcut kayıt var mı?
    const existing = await db
      .select({ id: podTemplates.id })
      .from(podTemplates)
      .where(and(eq(podTemplates.id, folderId), eq(podTemplates.userId, session.id)))
      .limit(1);

    if (existing.length > 0) {
      // Güncelle
      const updateValues: Record<string, unknown> = {
        name: folderName || 'Klasör Şablonu',
        description: descriptionJson,
        updatedAt: new Date(),
      };
      if (automationSchedule) {
        updateValues.automationSchedule = automationSchedule;
      }

      await db
        .update(podTemplates)
        .set(updateValues)
        .where(and(eq(podTemplates.id, folderId), eq(podTemplates.userId, session.id)));
    } else {
      // Yeni kayıt oluştur
      await db.insert(podTemplates).values({
        id: folderId,
        userId: session.id,
        name: folderName || 'Klasör Şablonu',
        description: descriptionJson,
        ...(automationSchedule ? { automationSchedule: automationSchedule as never } : {}),
      });
    }

    return NextResponse.json({ success: true, folderId });
  } catch (error) {
    console.error('[POST /api/templates/folder-config] Error:', error);
    return NextResponse.json(
      { error: 'Config kaydedilirken hata oluştu.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/templates/folder-config?folderId=xxx
 * Klasöre ait config'i döner.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthoritativeSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');
    if (!folderId) {
      return NextResponse.json({ error: 'folderId gerekli.' }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(podTemplates)
      .where(and(eq(podTemplates.id, folderId), eq(podTemplates.userId, session.id)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ config: null });
    }

    const row = rows[0];
    let config: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(row.description ?? '{}');
      if (parsed.__folderConfig) {
        const { __folderConfig: _, ...rest } = parsed;
        config = rest;
      }
    } catch {
      // description JSON değil — eski kayıt
    }

    // automationSchedule'ı da config'e ekle
    if (row.automationSchedule) {
      config.automationSchedule = row.automationSchedule;
    }

    return NextResponse.json({ config, folderId });
  } catch (error) {
    console.error('[GET /api/templates/folder-config] Error:', error);
    return NextResponse.json(
      { error: 'Config okunurken hata oluştu.' },
      { status: 500 }
    );
  }
}
