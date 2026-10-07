/**
 * POST /api/automation/execute
 * =============================
 * Bekleyen bir otomasyon çalıştırmasını işler. Yalnızca sunucu içi çağrılar içindir
 * (ör. yeniden deneme betikleri); `INTERNAL_API_TOKEN` (en az 32 karakter) tanımlı
 * değilse uç nokta tamamen kapalıdır. Normal akışta `POST /api/automation/run`,
 * pipeline'ı `after()` ile doğrudan çalıştırır ve bu uç noktayı kullanmaz.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isValidInternalToken } from '@/lib/internal-auth';
import { executeAutomationRun } from '@/lib/automation-runner';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!isValidInternalToken(req.headers.get('X-Internal-Token'))) {
    return NextResponse.json({ error: 'Unauthorized internal call' }, { status: 401 });
  }

  let body: { runId?: unknown; templateId?: unknown; userId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { runId, templateId, userId } = body;
  if (typeof runId !== 'string' || typeof templateId !== 'string' || typeof userId !== 'string' || !runId || !templateId || !userId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const outcome = await executeAutomationRun({ runId, templateId, userId });
  if (outcome.ok) return NextResponse.json({ success: true, runId });
  if (outcome.reason === 'not_found') return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  if (outcome.reason === 'not_pending') return NextResponse.json({ error: 'Run is not pending' }, { status: 409 });
  return NextResponse.json({ error: 'Internal pipeline error' }, { status: 500 });
}
