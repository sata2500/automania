/**
 * Admin › Veritabanı Bakımı
 * GET  → migration ve gizli değer şifreleme durumu
 * POST → { action: 'migrate' | 'encrypt-secrets', confirmation: 'ONAYLA' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { writeAuditLog } from '@/lib/audit-log';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { getErrorMessage } from '@/lib/errors';
import {
  getMaintenanceStatus,
  MaintenanceLockedError,
  runMigrations,
  runSecretEncryption,
} from '@/lib/db-maintenance';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAINTENANCE_CONFIRMATION = 'ONAYLA';
const ACTIONS = new Set(['migrate', 'encrypt-secrets']);

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json({ success: true, status: await getMaintenanceStatus() });
  } catch (error) {
    console.error('[DB Maintenance] Status failed:', getErrorMessage(error));
    return NextResponse.json({ success: false, error: 'Bakım durumu okunamadı.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const rateLimit = await checkRateLimit(`admin:db-maintenance:${session.id}`, 10, 10 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ success: false, error: 'Çok fazla bakım isteği. Lütfen biraz bekleyin.' }, {
      status: 429,
      headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: unknown; confirmation?: unknown };
  const action = typeof body.action === 'string' ? body.action : '';
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ success: false, error: 'Geçersiz bakım işlemi.' }, { status: 400 });
  }
  if (body.confirmation !== MAINTENANCE_CONFIRMATION) {
    return NextResponse.json({ success: false, error: `Onay için "${MAINTENANCE_CONFIRMATION}" yazmalısınız.` }, { status: 400 });
  }

  const startedAt = Date.now();
  try {
    const result = action === 'migrate' ? await runMigrations() : await runSecretEncryption();
    await writeAuditLog({
      userId: session.id,
      action: `admin.db_maintenance.${action}`,
      resourceType: 'database',
      metadata: { success: true, durationMs: Date.now() - startedAt },
    });
    return NextResponse.json({ success: true, action, result, status: await getMaintenanceStatus() });
  } catch (error) {
    const message = error instanceof MaintenanceLockedError ? error.message : getErrorMessage(error);
    await writeAuditLog({
      userId: session.id,
      action: `admin.db_maintenance.${action}`,
      resourceType: 'database',
      metadata: { success: false, error: message.slice(0, 500), durationMs: Date.now() - startedAt },
    }).catch(() => {});
    console.error(`[DB Maintenance] ${action} failed:`, message);
    return NextResponse.json(
      { success: false, error: error instanceof MaintenanceLockedError ? message : `İşlem başarısız: ${message}` },
      { status: error instanceof MaintenanceLockedError ? 409 : 500 },
    );
  }
}
