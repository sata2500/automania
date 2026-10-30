/**
 * Metin modeline (admin panelinde seçilen "reasoning" modeli) JSON üretimi için tek çağrı noktası: sağlayıcı
 * seçimi (Google / OpenRouter), model, yeniden deneme ve yanıttan JSON ayıklama burada yapılır.
 */
import { loadSettingRows } from '@/lib/app-settings';
import { requireModel } from '@/lib/ai-models';
import { withAiRetry } from '@/lib/ai-retry';
import { createGoogleClient, loadGoogleConnection } from '@/lib/google-genai-client';

export class AiTextConfigError extends Error {}

export type AiJsonOptions = {
  /** Günlükler için kısa ad */
  label: string;
  /** 0 = tutarlı (değerlendirme), 0.6-0.8 = yaratıcı (metin yazımı) */
  temperature: number;
  maxOutputTokens?: number;
  /** Modele birlikte gönderilecek görsel (ör. tasarım). Model görsel kabul etmezse görselsiz denenir. */
  image?: { buffer: Buffer; mimeType: string } | null;
  /** Web araması (Google: Google Search aracı; OpenRouter: web eklentisi). Desteklenmezse aramasız denenir. */
  webSearch?: boolean;
};

/** Model yanıtından ilk JSON nesnesini ayıklar. */
export function extractJsonObject(content: string): unknown {
  const match = content.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? match[0] : content);
  } catch {
    throw new Error('Yapay zeka geçerli bir JSON formatı döndürmedi.');
  }
}

export async function generateReasoningJson(prompt: string, options: AiJsonOptions): Promise<{ data: unknown; model: string }> {
  const rows = await loadSettingRows(['active_ai_provider', 'openrouter_api_key', 'openrouter_model_reasoning', 'gemini_model_reasoning']);
  const settings = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value])) as Record<string, string | undefined>;
  const provider = settings.active_ai_provider || 'openrouter';
  const googleConnection = provider === 'gemini' ? await loadGoogleConnection() : null;
  const apiKey = provider === 'gemini' ? null : (settings.openrouter_api_key || process.env.OPENROUTER_API_KEY);
  if (provider === 'gemini' ? !googleConnection : !apiKey) throw new AiTextConfigError('Sistem API anahtarı (Admin) yapılandırılmamış.');
  const model = requireModel(provider === 'gemini' ? settings.gemini_model_reasoning : settings.openrouter_model_reasoning, 'reasoning');

  const call = (image: AiJsonOptions['image'], webSearch: boolean) => withAiRetry(async () => {
    if (provider === 'gemini') {
      const res = await createGoogleClient(googleConnection!).models.generateContent({
        model,
        contents: image
          ? [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.buffer.toString('base64') } }] }]
          : prompt,
        config: {
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens ?? 8192,
          // Google Search aracı yapılandırılmış JSON yanıt moduyla birlikte kullanılamaz; JSON metinden ayrıştırılır.
          ...(webSearch ? { tools: [{ googleSearch: {} }] } : { responseMimeType: 'application/json' }),
        },
      });
      const text = res.text?.trim();
      if (!text) throw new Error('Model yanıt vermedi.');
      return text;
    }
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'Automania POD Studio' },
      body: JSON.stringify({
        model,
        temperature: options.temperature,
        response_format: { type: 'json_object' },
        ...(webSearch ? { plugins: [{ id: 'web', max_results: 5 }] } : {}),
        messages: [{
          role: 'user',
          content: image
            ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.buffer.toString('base64')}` } }]
            : prompt,
        }],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter API hatası: ${res.status} - ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return String(data.choices?.[0]?.message?.content || '');
  }, { label: options.label, delaysMs: [4_000, 10_000] });

  const extras = Boolean(options.image) || Boolean(options.webSearch);
  let content: string;
  try {
    content = await call(options.image ?? null, Boolean(options.webSearch));
    if (extras) extractJsonObject(content);
  } catch (error) {
    if (!extras) throw error;
    // Görsel veya web araması bu modelde/sağlayıcıda desteklenmiyorsa iş durmaz: yalnızca metinle denenir.
    console.warn(`[AI text] ${options.label}: image/web search call failed; retrying text-only.`, error instanceof Error ? error.message : error);
    content = await call(null, false);
  }

  return { data: extractJsonObject(content), model };
}
