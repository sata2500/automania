/**
 * /api/admin/google-cloud
 * Google Cloud hizmet hesabı (Vertex AI) bağlantısının yönetimi.
 *  GET    — bağlantı durumu (anahtarın kendisi asla dönmez)
 *  POST   — JSON anahtarı yükle / bölge ve bağlantı yöntemi seç; kaydetmeden önce Google'a bağlanıp doğrular
 *  DELETE — hizmet hesabı anahtarını sil ve API anahtarı yöntemine dön
 */
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';
import { encodeSettingValue, loadSettings } from '@/lib/app-settings';
import { writeAuditLog } from '@/lib/audit-log';
import { isEncryptionConfigured } from '@/lib/secret-box';
import { isValidVertexLocation, parseServiceAccountJson, ServiceAccountError } from '@/lib/google-cloud-credentials';
import { describeGoogleError, GOOGLE_CONNECTION_SETTING_KEYS, listGoogleModels, resolveGoogleConnection } from '@/lib/google-genai-client';

export const dynamic = 'force-dynamic';

async function saveSetting(key: string, value: string) {
  const stored = encodeSettingValue(key, value);
  await sql`
    INSERT INTO app_settings (id, setting_key, setting_value)
    VALUES (${key}, ${key}, ${stored})
    ON CONFLICT (setting_key)
    DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
  `;
}

async function readStatus() {
  const settings = await loadSettings(GOOGLE_CONNECTION_SETTING_KEYS);
  let serviceAccount: { projectId: string; clientEmail: string } | null = null;
  if (settings.gcp_service_account_json) {
    try {
      const parsed = parseServiceAccountJson(settings.gcp_service_account_json);
      serviceAccount = { projectId: parsed.project_id, clientEmail: parsed.client_email };
    } catch {
      serviceAccount = null;
    }
  }
  return {
    mode: settings.google_auth_mode === 'vertex' ? 'vertex' : 'api_key',
    location: settings.gcp_location || 'global',
    serviceAccount,
    hasApiKey: Boolean(settings.gemini_api_key || process.env.GEMINI_API_KEY),
    encryptionConfigured: isEncryptionConfigured(),
  };
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ success: true, status: await readStatus() });
  } catch (error) {
    console.error('[Google Cloud] Status failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Bağlantı durumu okunamadı.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as { serviceAccountJson?: unknown; location?: unknown; mode?: unknown } | null;
  if (!body) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  try {
    const current = await loadSettings(GOOGLE_CONNECTION_SETTING_KEYS);
    const location = body.location === undefined ? (current.gcp_location || 'global') : body.location;
    if (!isValidVertexLocation(location)) return NextResponse.json({ error: 'Geçersiz bölge.' }, { status: 400 });
    const mode = body.mode === 'api_key' ? 'api_key' : 'vertex';

    let json = current.gcp_service_account_json || '';
    if (typeof body.serviceAccountJson === 'string' && body.serviceAccountJson.trim()) {
      const parsed = parseServiceAccountJson(body.serviceAccountJson);
      json = JSON.stringify(parsed);
    }

    let modelCount: number | null = null;
    if (mode === 'vertex') {
      if (!json) return NextResponse.json({ error: 'Önce hizmet hesabı JSON dosyasını yükleyin.' }, { status: 400 });
      // Kaydetmeden önce gerçekten bağlanılabildiğini doğrula (yanlış anahtar sistemi bozmasın).
      const connection = resolveGoogleConnection({ google_auth_mode: 'vertex', gcp_service_account_json: json, gcp_location: location });
      if (!connection) return NextResponse.json({ error: 'Hizmet hesabı anahtarı okunamadı.' }, { status: 400 });
      try {
        modelCount = (await listGoogleModels(connection)).length;
      } catch (error) {
        return NextResponse.json({ error: `Google Cloud bağlantısı doğrulanamadı: ${describeGoogleError(error)}` }, { status: 400 });
      }
    }

    if (json && json !== current.gcp_service_account_json) await saveSetting('gcp_service_account_json', json);
    await saveSetting('gcp_location', location);
    await saveSetting('google_auth_mode', mode);
    await writeAuditLog({
      userId: session.id,
      action: 'admin.google_cloud.updated',
      resourceType: 'app_settings',
      metadata: { mode, location, keyUploaded: typeof body.serviceAccountJson === 'string' },
    });

    return NextResponse.json({ success: true, status: await readStatus(), modelCount });
  } catch (error) {
    if (error instanceof ServiceAccountError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('[Google Cloud] Save failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Google Cloud ayarları kaydedilemedi.' }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await sql`DELETE FROM app_settings WHERE setting_key = 'gcp_service_account_json'`;
    await saveSetting('google_auth_mode', 'api_key');
    await writeAuditLog({ userId: session.id, action: 'admin.google_cloud.removed', resourceType: 'app_settings' });
    return NextResponse.json({ success: true, status: await readStatus() });
  } catch (error) {
    console.error('[Google Cloud] Delete failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Hizmet hesabı silinemedi.' }, { status: 500 });
  }
}
