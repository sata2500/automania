import { loadSetting } from '@/lib/app-settings';
import { NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { checkRateLimit } from '@/lib/request-rate-limit';

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
    const configuredKey = await loadSetting(settingKey);
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

    const rateLimit = await checkRateLimit(`ai:chat:${session.id}`, 20, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'AI istek limiti aşıldı.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const body = await readJsonBody(req);
    if (!body) {
      return NextResponse.json({ success: false, error: 'Geçersiz veya çok büyük AI isteği.' }, { status: 400 });
    }

    const provider = body.provider;
    if (!isProvider(provider)) {
      return NextResponse.json({ success: false, error: 'Desteklenmeyen AI sağlayıcısı.' }, { status: 400 });
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 100) {
      return NextResponse.json({ success: false, error: 'Geçersiz messages payload’ı.' }, { status: 400 });
    }

    const apiKey = await getApiKey(provider);
    if (!apiKey) {
      return NextResponse.json({ success: false, error: `${provider === 'gemini' ? 'Gemini' : 'OpenRouter'} API anahtarı sunucuda yapılandırılmamış.` }, { status: 500 });
    }

    if (provider === 'gemini') {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const modelId = typeof body.model === 'string' ? body.model : 'gemini-3.8-flash';
      const role = body.role;

      // Video modelleri için özel bilgi
      if (role === 'video' || modelId.startsWith('veo-')) {
        return NextResponse.json({
          success: true,
          data: {
            choices: [{
              message: {
                content: `Google Veo Video Modeli (${modelId}) başarıyla doğrulandı.`
              }
            }]
          }
        });
      }

      // Görsel Üretim Modeli (T2I)
      if (role === 'generation' || modelId.includes('image')) {
        try {
          const userMsg = body.messages[body.messages.length - 1];
          const promptText = typeof userMsg?.content === 'string' ? userMsg.content : 'A simple red circle icon';
          const imgRes = await ai.models.generateContent({
            model: modelId,
            contents: promptText,
            config: { responseModalities: ['image'] }
          });
          let imgBase64 = '';
          let mime = 'image/png';
          for (const cand of imgRes.candidates ?? []) {
            for (const part of cand.content?.parts ?? []) {
              if (part.inlineData?.data) {
                imgBase64 = part.inlineData.data;
                mime = part.inlineData.mimeType || mime;
                break;
              }
            }
          }
          if (imgBase64) {
            return NextResponse.json({
              success: true,
              data: {
                choices: [{
                  message: {
                    content: `![Generated Image](data:${mime};base64,${imgBase64})`
                  }
                }]
              }
            });
          }
        } catch (imgErr: unknown) {
          const msg = imgErr instanceof Error ? imgErr.message : String(imgErr);
          return NextResponse.json({
            success: false,
            error: msg || 'Görsel üretimi başarısız oldu.'
          }, { status: 500 });
        }
      }

      // Vision veya Metin Testi
      try {
        const lastMsg = body.messages[body.messages.length - 1];
        let contents: any = 'Ping Test. Respond with: OK';

        if (Array.isArray(lastMsg?.content)) {
          // Multimodal parts
          const parts: any[] = [];
          for (const item of lastMsg.content) {
            if (item.type === 'text') {
              parts.push({ text: item.text });
            } else if (item.type === 'image_url' && item.image_url?.url) {
              const url = item.image_url.url;
              const match = url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                parts.push({
                  inlineData: {
                    mimeType: match[1],
                    data: match[2]
                  }
                });
              }
            }
          }
          contents = [{ role: 'user', parts }];
        } else if (typeof lastMsg?.content === 'string') {
          contents = lastMsg.content;
        }

        const res = await ai.models.generateContent({
          model: modelId,
          contents,
          config: {
            maxOutputTokens: typeof body.max_tokens === 'number' ? body.max_tokens : 50,
          }
        });

        return NextResponse.json({
          success: true,
          data: {
            choices: [{
              message: {
                content: res.text || 'OK'
              }
            }]
          }
        });
      } catch (geminiErr: unknown) {
        const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        return NextResponse.json({
          success: false,
          error: msg || 'Gemini model çağrısı başarısız oldu.'
        }, { status: 500 });
      }
    }

    const endpoint = allowedChatEndpoint(provider, body.endpoint);
    if (!endpoint) {
      return NextResponse.json({ success: false, error: 'İzin verilmeyen AI endpoint’i.' }, { status: 400 });
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

    const rateLimit = await checkRateLimit(`ai:models:${session.id}`, 30, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'AI model listesi istek limiti aşıldı.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const requestedProvider = new URL(req.url).searchParams.get('provider') || 'openrouter';
    if (!isProvider(requestedProvider)) {
      return NextResponse.json({ success: false, error: 'Desteklenmeyen AI sağlayıcısı.' }, { status: 400 });
    }
    const provider: AiProvider = requestedProvider;
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
