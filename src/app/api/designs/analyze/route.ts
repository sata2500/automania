/**
 * /api/designs/analyze — tasarım görselinin yapay zekâ analizi ve anahtar kelimelerin Etsy puanları
 * (bkz. design-analysis).
 *
 * POST { src, designId? }
 *  - Giriş yapılmışsa ve tasarım çalışma alanında kayıtlıysa analiz sunucuda arka planda (after) yürür ve sonuç
 *    doğrudan tasarıma yazılır: sekme/tarayıcı kapansa da tamamlanır. Yanıt hemen döner (202, queued). Tasarımda
 *    `analysisPendingAt` analiz sürerken durur; hata olursa `analysisError` yazılır.
 *  - Aksi hâlde (misafir, henüz kaydedilmemiş tasarım) analiz yanıtta döner.
 * GET ?designId= — arka plan analizinin durumu: pending | done | error | none.
 *
 * Zaman aşımını önlemek için kelime puanlaması süre bütçesiyle sınırlıdır; bütçeye sığmayan kelimeler havuza
 * "Taranacak" olarak eklenir ve kalan sürede (ya da zamanlayıcının havuz yenilemesinde) puanlanır.
 */
import { NextResponse, after } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { MediaSourceError } from '@/lib/media-source';
import { DesignVisionConfigError } from '@/lib/design-vision';
import { runDesignAnalysis, scorePendingKeywords } from '@/lib/design-analysis';
import { patchWorkspaceDesign, readWorkspaceDesign } from '@/lib/workspace-designs';

export const maxDuration = 120;

/** Yanıttan önce (veya arka plan analizinde sonuç yazılmadan önce) kelime puanlamaya ayrılan süre. */
const SYNC_SCORING_BUDGET_MS = 35_000;
/** Sonuç döndükten sonra kalan kelimelerin puanlanması için süre. */
const BACKGROUND_SCORING_BUDGET_MS = 70_000;
/** Arka planda: sonuç yazıldıktan sonra kalan kelimeler için süre (toplam 120 sn sınırının içinde kalır). */
const QUEUED_REST_BUDGET_MS = 30_000;
/** Bu süreden eski "sürüyor" işareti (ör. sunucu kesildi) artık sürmüyor sayılır. */
const ANALYSIS_STALE_MS = 3 * 60_000;

function errorMessage(error: unknown): string {
  if (error instanceof DesignVisionConfigError || error instanceof MediaSourceError) return error.message;
  return 'Tasarım analizi başarısız oldu. Lütfen tekrar deneyin.';
}

export async function POST(request: Request) {
  try {
    const session = await getAuthoritativeSession();
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'guest';
    const rateLimitKey = session ? `ai:design-analyze:${session.id}` : `ai:design-analyze:guest:${clientIp}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 15, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Vision AI analiz limiti aşıldı. Lütfen birkaç dakika sonra tekrar deneyin.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const { src, designId } = await request.json().catch(() => ({}));
    if (!src) return NextResponse.json({ success: false, error: 'Görsel URL veya base64 gerekli.' }, { status: 400 });
    const appOrigin = new URL(request.url).origin;

    // Arka plan: sonuç tasarıma yazılır, sekme kapansa da tamamlanır.
    if (session && typeof designId === 'string' && designId) {
      const userId = session.id;
      const queued = await patchWorkspaceDesign(userId, designId, { analysisPendingAt: Date.now() }, ['analysisError']);
      if (queued) {
        after(async () => {
          try {
            const result = await runDesignAnalysis(userId, String(src), { appOrigin, scoringBudgetMs: SYNC_SCORING_BUDGET_MS });
            await patchWorkspaceDesign(userId, designId, { analysis: result.analysis }, ['analysisPendingAt', 'analysisError']);
            await scorePendingKeywords(result, QUEUED_REST_BUDGET_MS);
          } catch (error) {
            console.error('[Design Analyze] Background analysis failed:', error instanceof Error ? error.message : 'unknown error');
            await patchWorkspaceDesign(userId, designId, { analysisError: errorMessage(error) }, ['analysisPendingAt'])
              .catch(() => undefined);
          }
        });
        return NextResponse.json({ success: true, queued: true }, { status: 202 });
      }
    }

    let result;
    try {
      result = await runDesignAnalysis(session?.id ?? null, String(src), { appOrigin, scoringBudgetMs: SYNC_SCORING_BUDGET_MS });
    } catch (error) {
      if (error instanceof MediaSourceError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
      throw error;
    }
    if (result.pendingKeywords.length > 0) after(() => scorePendingKeywords(result, BACKGROUND_SCORING_BUDGET_MS));

    return NextResponse.json({
      success: true,
      hasEtsyApi: result.hasEtsyApi,
      pendingKeywords: result.pendingKeywords.length,
      analysis: result.analysis,
    });
  } catch (error) {
    console.error('[Design Analyze] Request failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const designId = new URL(request.url).searchParams.get('designId');
  if (!designId) return NextResponse.json({ error: 'designId zorunludur.' }, { status: 400 });
  const design = await readWorkspaceDesign(session.id, designId);
  if (!design) return NextResponse.json({ status: 'none' });
  if (design.analysisPendingAt && Date.now() - design.analysisPendingAt < ANALYSIS_STALE_MS) {
    return NextResponse.json({ status: 'pending', startedAt: design.analysisPendingAt });
  }
  if (design.analysisError) return NextResponse.json({ status: 'error', error: design.analysisError });
  if (design.analysisPendingAt) return NextResponse.json({ status: 'error', error: 'Analiz yarıda kaldı. Lütfen tekrar deneyin.' });
  return NextResponse.json({ status: design.analysis ? 'done' : 'none', analysis: design.analysis ?? null });
}
