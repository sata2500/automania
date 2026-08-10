import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import sql from '@/lib/db';

async function getApiKey(provider: string = 'openrouter'): Promise<string | null> {
  const settingKey = provider === 'gemini' ? 'gemini_api_key' : 'openrouter_api_key';
  const envKey = provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY;
  
  try {
    const rows = await sql`SELECT setting_value FROM app_settings WHERE setting_key = ${settingKey} LIMIT 1`;
    if (rows && rows.length > 0 && rows[0].setting_value) {
      return rows[0].setting_value;
    }
  } catch (err) {
    console.warn(`Could not read ${settingKey} from DB, falling back to env`, err);
  }
  return envKey || null;
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const provider = body.provider || 'openrouter';
    const endpoint = body.endpoint || 'https://openrouter.ai/api/v1/chat/completions';
    
    // Remove endpoint and provider from body if present so we don't send it to the upstream API
    const { endpoint: _, provider: __, ...payload } = body;

    const apiKey = await getApiKey(provider);
    if (!apiKey) {
      return NextResponse.json({ success: false, error: `${provider === 'gemini' ? 'Gemini' : 'OpenRouter'} API Key is not configured on the server or database.` }, { status: 500 });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json({ success: false, error: data.error?.message || 'OpenRouter API Error' }, { status: response.status });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('AI Proxy Error:', error);
    return NextResponse.json({ success: false, error: 'Sunucu hatası oluştu.' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'OpenRouter API Key is not configured on the server or database.' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint') || 'https://openrouter.ai/api/v1/models';

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json({ success: false, error: data.error?.message || 'OpenRouter API Error' }, { status: response.status });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('AI Proxy Error:', error);
    return NextResponse.json({ success: false, error: 'Sunucu hatası oluştu.' }, { status: 500 });
  }
}
