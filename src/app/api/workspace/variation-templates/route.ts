/**
 * GET/PUT /api/workspace/variation-templates — kullanıcının kayıtlı varyasyon şablonları
 * (`user_workspaces.etsy_variation_templates`). Ayarlar sekmesinden yüklenir, düzenlenir ve kaydedilir;
 * otomasyonlar şablona bağlıysa bir sonraki çalıştırmada güncel satırları kullanır.
 * Çalışma alanının sürüm zamanı (updated_at) değiştirilmez: açık sekmelerin kayıtları çakışmaz.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { userWorkspaces } from '@/db/schema';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { eq } from 'drizzle-orm';
import { getErrorMessage } from '@/lib/errors';

const rowSchema = z.object({
  id: z.string().max(100),
  size: z.string().trim().max(60),
  color: z.string().trim().max(60),
  price: z.number().min(0).max(50_000),
  quantity: z.number().int().min(0).max(999),
  sku: z.string().max(64).default(''),
  enabled: z.boolean(),
});

const templatesSchema = z.object({
  templates: z.array(z.object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1, 'Şablon adı boş olamaz.').max(100),
    updatedAt: z.string().max(40).optional(),
    variations: z.array(rowSchema).max(400, 'Etsy en fazla 400 kombinasyon kabul eder.'),
  })).max(100),
});

export async function GET() {
  try {
    const session = await getAuthoritativeSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await db
      .select({ etsyVariationTemplates: userWorkspaces.etsyVariationTemplates })
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, session.id))
      .limit(1);

    const templates = (rows[0]?.etsyVariationTemplates as unknown[]) ?? [];

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[GET /api/workspace/variation-templates] Error:', error);
    return NextResponse.json({ templates: [] });
  }
}

export async function PUT(req: Request) {
  const session = await getAuthoritativeSession();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = templatesSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Geçersiz şablon.' }, { status: 400 });
  }
  try {
    const updated = await db.update(userWorkspaces)
      .set({ etsyVariationTemplates: parsed.data.templates })
      .where(eq(userWorkspaces.userId, session.id))
      .returning({ userId: userWorkspaces.userId });
    if (updated.length === 0) {
      await db.insert(userWorkspaces).values({ userId: session.id, etsyVariationTemplates: parsed.data.templates }).onConflictDoNothing();
    }
    return NextResponse.json({ success: true, templates: parsed.data.templates });
  } catch (error) {
    console.error('[PUT /api/workspace/variation-templates] Error:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
