import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';

const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models';
const OPENROUTER_CHAT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_CHAT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MAX_AI_BODY_BYTES = 512 * 1024;

type AiProvider = 'openrouter' | 'gemini';

function isProvider(value: unknown): value is AiProvider {
  return value === 'openrouter' || value === 'gemini';
}

function allowedChatEndpoint(provider: AiProvider, endpoint: unknown): string | null {
  if (endpoint === undefined) {
    return provider === 'gemini' ? GEMINI_CHAT_ENDPOINT : OPENROUTER_CHAT_ENDPOINT;
  }
  if (typeof endpoint !== 'string') return null;
  if (provider === 'openrouter' && endpoint === OPENROUTER_CHAT_ENDPOINT) return endpoint;
  if (provider === 'gemini' && endpoint === GEMINI_CHAT_ENDPOINT) return endpoint;
  return null;
}

async function getApiKey(provider: AiProvider): Promise<string | null> {
  const settingKey = provider === 'gemini' ? 'gemini_api_key' : 'openrouter_api_key';
  const envKey = provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY;

  try {
    const rows = await sql`SELECT setting_value FROM app_settings WHERE setting_key = ${settingKey} LIMIT 1`;
    const configuredKey = rows?.[0]?.setting_value;
    if (typeof configuredKey === 'string' && configuredKey.trim()) {
      return configuredKey.trim();
    }
  } catch (error) {
    console.warn(`Could not read ${settingKey} from DB; falling back to environment configuration.`, error);
  }

  return envKey?.trim() || null;
}

async function readJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_AI_BODY_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function upstreamHeaders(provider: AiProvider, apiKey: string): HeadersInit {
  return provider === 'gemini'
    ? {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    : {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Automania POD',
      };
}

export async function POST(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await readJsonBody(req);
    if (!body) {
      return NextResponse.json({ success: false, error: 'Geçersiz veya çok büyük AI isteği.' }, { status: 400 });
    }

    const provider = body.provider;
    if (!isProvider(provider)) {
      return NextResponse.json({ success: false, error: 'Desteklenmeyen AI sağlayıcısı.' }, { status: 400 });
    }

    const endpoint = allowedChatEndpoint(provider, body.endpoint);
    if (!endpoint) {
      return NextResponse.json({ success: false, error: 'İzin verilmeyen AI endpoint’i.' }, { status: 400 });
    }

    const apiKey = await getApiKey(provider);
    if (!apiKey) {
      return NextResponse.json({ success: false, error: `${provider === 'gemini' ? 'Gemini' : 'OpenRouter'} API anahtarı sunucuda yapılandırılmamış.` }, { status: 500 });
    }

    const { endpoint: _endpoint, provider: _provider, ...payload } = body;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: upstreamHeaders(provider, apiKey),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });

    const data = await response.json().catch(() => ({ error: { message: 'AI sağlayıcısından geçersiz yanıt.' } }));
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data?.error?.message || `${provider} API hatası.` },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('AI Proxy Error:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'AI isteği işlenirken sunucu hatası oluştu.' }, { status: 502 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const requestedProvider = new URL(req.url).searchParams.get('provider') || 'openrouter';
    const provider: AiProvider = requestedProvider === 'gemini' ? 'gemini' : 'openrouter';
    const apiKey = await getApiKey(provider);
    if (!apiKey) {
      return NextResponse.json({ success: false, error: `${provider} API anahtarı sunucuda yapılandırılmamış.` }, { status: 500 });
    }

    const endpoint = provider === 'gemini' ? GEMINI_MODELS_ENDPOINT : OPENROUTER_MODELS_ENDPOINT;
    const headers: HeadersInit = provider === 'gemini'
      ? { 'x-goog-api-key': apiKey }
      : upstreamHeaders(provider, apiKey);
    const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(30_000) });
    const data = await response.json().catch(() => ({ error: { message: 'AI sağlayıcısından geçersiz yanıt.' } }));

    if (!response.ok) {
      return NextResponse.json({ success: false, error: data?.error?.message || `${provider} API hatası.` }, { status: response.status });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('AI Model Proxy Error:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'AI model listesi alınırken sunucu hatası oluştu.' }, { status: 502 });
  }
}
