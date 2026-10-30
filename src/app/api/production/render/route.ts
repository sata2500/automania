/**
 * POST /api/production/render — manuel üretimde bir mockup + tasarım eşleşmesini sunucuda üretir (giriş
 * yapılmış). Görseller kullanıcının kendi deposundan sahiplik doğrulamasıyla okunur; sonuç JPEG olarak depoya
 * yazılır ve adresi döner (Hazır İlanlar'a eklerken yeniden yükleme gerekmez).
 * Body: { mockup: { src, printAreas, opacity?, exportAspect? }, design: { src } | null }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { loadImageForUser, MediaSourceError } from '@/lib/media-source';
import { renderMockupJpeg } from '@/lib/server-mockup-render';
import { isR2Configured, uploadToR2 } from '@/lib/r2';
import { createOwnedUploadName } from '@/lib/upload-security';

export const maxDuration = 60;

const areaSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  rotation: z.number().finite().optional(),
});

const bodySchema = z.object({
  mockup: z.object({
    src: z.string().min(1).max(2048),
    printAreas: z.array(areaSchema).max(10),
    opacity: z.number().finite().optional(),
    exportAspect: z.enum(['original', 'square']).optional(),
  }),
  design: z.object({ src: z.string().min(1).max(2048) }).nullable(),
});

export async function POST(request: Request) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isR2Configured()) return NextResponse.json({ error: 'Kalıcı depolama yapılandırılmamış.' }, { status: 503 });

  const rateLimit = await checkRateLimit(`production:render:${session.id}`, 400, 10 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Üretim limiti aşıldı. Lütfen biraz sonra tekrar deneyin.' }, {
      status: 429,
      headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz üretim isteği.' }, { status: 400 });
  const { mockup, design } = parsed.data;

  try {
    const appOrigin = new URL(request.url).origin;
    const [mockupBuffer, designBuffer] = await Promise.all([
      loadImageForUser(session.id, mockup.src, { appOrigin }),
      design ? loadImageForUser(session.id, design.src, { appOrigin }) : Promise.resolve(null),
    ]);
    const rendered = await renderMockupJpeg(mockupBuffer, designBuffer, {
      printAreas: mockup.printAreas.map((a, i) => ({ id: a.id ?? `area-${i}`, name: a.name ?? '', rotation: 0, ...a })),
      opacity: mockup.opacity,
      exportAspect: mockup.exportAspect,
    });
    const upload = await uploadToR2(rendered.buffer, createOwnedUploadName(session.id, 'render', 'image/jpeg'), 'image/jpeg');
    return NextResponse.json({ url: upload.url, width: rendered.width, height: rendered.height, size: rendered.buffer.byteLength });
  } catch (error) {
    if (error instanceof MediaSourceError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[Production render] Failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Görsel üretilemedi.' }, { status: 500 });
  }
}
