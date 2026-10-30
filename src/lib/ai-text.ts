/**
 * Metin modeline (admin panelinde seçilen "reasoning" modeli) JSON üretimi için tek çağrı noktası: sağlayıcı
 * seçimi (Google / OpenRouter), model, yeniden deneme ve yanıttan JSON ayıklama burada yapılır.
 */
import { loadSettingRows } from '@/lib/app-settings';
import { requireModel } from '@/lib/ai-models';
import { withAiRetry } from '@/lib/ai-retry';
import { createGoogleClient, loadGoogleConnection } from '@/lib/google-genai-client';

export class AiTextConfigError extends Error {}

export type AiImage = { buffer: Buffer; mimeType: string };

export type AiJsonOptions = {
  /** Günlükler için kısa ad */
  label: string;
  /** 0 = tutarlı (değerlendirme), 0.6-0.8 = yaratıcı (metin yazımı) */
  temperature: number;
  maxOutputTokens?: number;
  /** Modele birlikte gönderilecek görsel (ör. tasarım). Model görsel kabul etmezse görselsiz denenir. */
  image?: AiImage | null;
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
  return generateJson('reasoning', prompt, options.image ? [options.image] : [], options);
}

/** Görsel modeliyle (admin › görsel analiz modeli) birden çok görsel üzerinden JSON üretimi; kısa sınıflandırmalar için. */
export async function generateVisionJson(prompt: string, images: AiImage[], options: Omit<AiJsonOptions, 'image' | 'webSearch'>): Promise<{ data: unknown; model: string }> {
  return generateJson('vision', prompt, images, { ...options, strictImages: true });
}

async function generateJson(
  role: 'reasoning' | 'vision',
  prompt: string,
  images: AiImage[],
  options: AiJsonOptions & { strictImages?: boolean },
): Promise<{ data: unknown; model: string }> {
  const rows = await loadSettingRows(['active_ai_provider', 'openrouter_api_key', `openrouter_model_${role}`, `gemini_model_${role}`]);
  const settings = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value])) as Record<string, string | undefined>;
  const provider = settings.active_ai_provider || 'openrouter';
  const googleConnection = provider === 'gemini' ? await loadGoogleConnection() : null;
  const apiKey = provider === 'gemini' ? null : (settings.openrouter_api_key || process.env.OPENROUTER_API_KEY);
  if (provider === 'gemini' ? !googleConnection : !apiKey) throw new AiTextConfigError('Sistem API anahtarı (Admin) yapılandırılmamış.');
  const model = requireModel(provider === 'gemini' ? settings[`gemini_model_${role}`] : settings[`openrouter_model_${role}`], role);

  const call = (withImages: AiImage[], webSearch: boolean) => withAiRetry(async () => {
    if (provider === 'gemini') {
      const res = await createGoogleClient(googleConnection!).models.generateContent({
        model,
        contents: withImages.length > 0
          ? [{ role: 'user', parts: [{ text: prompt }, ...withImages.map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.buffer.toString('base64') } }))] }]
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
          content: withImages.length > 0
            ? [{ type: 'text', text: prompt }, ...withImages.map((image) => ({ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.buffer.toString('base64')}` } }))]
            : prompt,
        }],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter API hatası: ${res.status} - ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return String(data.choices?.[0]?.message?.content || '');
  }, { label: options.label, delaysMs: [4_000, 10_000] });

  // Görselin kendisi sorulduğunda (strictImages) görselsiz denemenin anlamı yoktur.
  const extras = !options.strictImages && (images.length > 0 || Boolean(options.webSearch));
  let content: string;
  try {
    content = await call(images, Boolean(options.webSearch));
    if (extras) extractJsonObject(content);
  } catch (error) {
    if (!extras) throw error;
    // Görsel veya web araması bu modelde/sağlayıcıda desteklenmiyorsa iş durmaz: yalnızca metinle denenir.
    console.warn(`[AI text] ${options.label}: image/web search call failed; retrying text-only.`, error instanceof Error ? error.message : error);
    content = await call([], false);
  }

  return { data: extractJsonObject(content), model };
}
