import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';
import { maskSettingValue, shouldPreserveSecretValue } from '@/lib/setting-security';
import { writeAuditLog } from '@/lib/audit-log';

const ALLOWED_SETTING_KEYS = new Set([
  'active_ai_provider',
  'openrouter_api_key',
  'gemini_api_key',
  'etsy_keystring',
  'etsy_shared_secret',
  'scraping_provider',
  'scraping_api_key',
  'cloudflare_worker_url',
  'openrouter_model_vision',
  'openrouter_model_reasoning',
  'openrouter_model_generation',
  'gemini_model_vision',
  'gemini_model_reasoning',
  'gemini_model_generation',
  'ai_prompt_analyze_design',
  'ai_prompt_generate_listing',
]);

const MAX_SETTING_VALUE_LENGTH = 100_000;

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

// GET: Read all app settings. Secret values are never returned to the browser.
export async function GET(_request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await sql`SELECT setting_key, setting_value FROM app_settings`;
    const settings: Record<string, string> = {};
    for (const row of rows) {
      const key = String(row.setting_key || '');
      settings[key] = maskSettingValue(key, row.setting_value);
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[Admin Settings] GET failed:', safeErrorMessage(error));
    return NextResponse.json({ error: 'Ayarlar alınamadı.' }, { status: 500 });
  }
}

// POST: Update specific app settings.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body) || !('settings' in body)) {
      return NextResponse.json({ error: 'Geçersiz ayar formatı.' }, { status: 400 });
    }

    const settings = (body as { settings: unknown }).settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return NextResponse.json({ error: 'Geçersiz ayar formatı.' }, { status: 400 });
    }

    const changedKeys: string[] = [];
    for (const [key, rawValue] of Object.entries(settings)) {
      if (!ALLOWED_SETTING_KEYS.has(key) || typeof rawValue !== 'string') continue;
      if (rawValue.length > MAX_SETTING_VALUE_LENGTH) {
        return NextResponse.json({ error: `${key} değeri çok uzun.` }, { status: 413 });
      }

      // Masked or empty secret values mean “leave the existing secret unchanged”.
      if (shouldPreserveSecretValue(key, rawValue)) continue;

      await sql`
        INSERT INTO app_settings (id, setting_key, setting_value)
        VALUES (${key}, ${key}, ${rawValue})
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
      `;
      changedKeys.push(key);

      if (key === 'scraping_api_key') {
        await sql`UPDATE user_workspaces SET scraping_api_key = ${rawValue} WHERE user_id = ${session.id}`.catch(() => {});
      } else if (key === 'scraping_provider') {
        await sql`UPDATE user_workspaces SET scraping_provider = ${rawValue} WHERE user_id = ${session.id}`.catch(() => {});
      } else if (key === 'cloudflare_worker_url') {
        await sql`UPDATE user_workspaces SET cloudflare_worker_url = ${rawValue} WHERE user_id = ${session.id}`.catch(() => {});
      }
    }

    if (changedKeys.length > 0) {
      await writeAuditLog({
        userId: session.id,
        action: 'admin.settings.updated',
        resourceType: 'app_settings',
        metadata: { keys: changedKeys },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Settings] POST failed:', safeErrorMessage(error));
    return NextResponse.json({ error: 'Ayarlar kaydedilemedi.' }, { status: 500 });
  }
}
