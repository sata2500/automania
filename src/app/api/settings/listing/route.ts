/**
 * GET/PUT /api/settings/listing — Ayarlar sekmesindeki ilan varsayılanları (Etsy mağaza ayarları ve
 * varyasyonlar). Manuel üretimden açılan ilanlar ve otomasyonların eksik ayarları bunları kullanır.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { loadListingDefaults, saveListingDefaults } from '@/lib/user-settings';
import { etsyListingSettingsSchema } from '@/lib/validation/templates';
import { getErrorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const shortText = z.string().trim().max(60);
const schema = z.object({
  etsy: etsyListingSettingsSchema,
  variations: z.object({
    sizes: z.array(shortText).max(30),
    colors: z.array(shortText).max(60),
    basePrice: z.number().min(0.2).max(50_000),
    sizePrices: z.record(shortText, z.number().min(0.2).max(50_000)).default({}),
    quantity: z.number().int().min(1).max(999),
  }).refine((v) => v.sizes.length * v.colors.length <= 400, 'Etsy en fazla 400 beden × renk kombinasyonuna izin verir.'),
  copy: z.object({
    freeShipping: z.boolean().nullable(),
    productInfo: z.string().max(300),
    careInstructions: z.string().max(200),
    processingInfo: z.string().max(200),
    extraNotes: z.string().max(400),
  }).optional(),
});

export async function GET() {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ success: true, defaults: await loadListingDefaults(session.id) });
}

export async function PUT(req: Request) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Geçersiz ayar.' }, { status: 400 });
  }
  try {
    return NextResponse.json({ success: true, defaults: await saveListingDefaults(session.id, parsed.data) });
  } catch (error) {
    console.error('[Settings] Save failed', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
