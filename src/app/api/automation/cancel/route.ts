/**
 * POST /api/automation/cancel
 * Kullanıcının bekleyen veya süren bir otomasyon çalıştırmasını iptal eder.
 * Süren adım tamamlanır; sonraki adımlar (ör. Etsy ilanı) başlatılmaz.
 */
import { NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { cancelAutomationRun } from '@/lib/automation-runner';

export async function POST(req: Request) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const runId = typeof body?.runId === 'string' ? body.runId : '';
  if (!runId) return NextResponse.json({ error: 'runId zorunludur.' }, { status: 400 });

  try {
    const cancelled = await cancelAutomationRun(runId, session.id);
    if (!cancelled) return NextResponse.json({ error: 'Çalıştırma bulunamadı veya zaten bitti.' }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/automation/cancel] Error:', error);
    return NextResponse.json({ error: 'Çalıştırma iptal edilemedi.' }, { status: 500 });
  }
}
