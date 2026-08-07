import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';

// GET: Read all app settings (masking sensitive keys like API keys)
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await sql`SELECT setting_key, setting_value FROM app_settings`;
    
    const settings: Record<string, string> = {};
    for (const row of rows) {
      let val = row.setting_value || '';
      
      // Mask API keys for security even in admin panel
      if (row.setting_key === 'openrouter_api_key' && val) {
        if (val.length > 12) {
          val = val.substring(0, 8) + '•'.repeat(val.length - 12) + val.substring(val.length - 4);
        } else {
          val = '••••••••';
        }
      }
      
      settings[row.setting_key] = val;
    }

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Settings GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Update specific app settings
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    if (!body.settings || typeof body.settings !== 'object') {
      return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 });
    }

    const entries = Object.entries(body.settings);
    
    for (const [key, value] of entries) {
      if (typeof value !== 'string') continue;
      
      // Skip if it's a masked value (user didn't change it)
      if (value.includes('•') || value.includes('***')) continue;
      
      await sql`
        INSERT INTO app_settings (id, setting_key, setting_value)
        VALUES (${key}, ${key}, ${value})
        ON CONFLICT (setting_key) 
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Settings POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
