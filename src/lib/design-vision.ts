/**
 * Tasarım görselinin yapay zekâ analizi (konu, stil, açıklama, anahtar kelimeler). Talimat admin panelindeki
 * "Tasarım görsel analizi" prompt'udur; model yalnızca admin panelinde seçilen görsel modeldir.
 * Tasarımlar sekmesindeki analiz (/api/designs/analyze) ve otomasyon aynı kodu kullanır. Anahtar kelimelerin
 * Etsy puanlaması ayrıdır (bkz. keyword-pool).
 */
import { fillPrompt } from '@/lib/prompt-registry';
import { loadPrompt, loadTaxonomyHint } from '@/lib/prompt-settings';
import { requireModel } from '@/lib/ai-models';
import { createGoogleClient, loadGoogleConnection } from '@/lib/google-genai-client';
import { loadSettingRows } from '@/lib/app-settings';
import { withAiRetry } from '@/lib/ai-retry';

export type DesignVisionResult = {
  description: string;
  keywords: string[];
  primarySubject: string;
  primaryAesthetic: string;
  niche: string;
  userNotes: string;
  productType: string;
  taxonomyId: number | null;
};

export class DesignVisionConfigError extends Error {}

const VISION_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);

export async function analyzeDesignImage(image: { buffer: Buffer; mimeType: string }): Promise<DesignVisionResult> {
  const settingsRows = await loadSettingRows(['active_ai_provider', 'openrouter_api_key', 'openrouter_model_vision', 'gemini_model_vision']);
  const settings = Object.fromEntries(settingsRows.map((row) => [row.setting_key, row.setting_value])) as Record<string, string | undefined>;
  const provider = settings.active_ai_provider || 'openrouter';
  const googleConnection = provider === 'gemini' ? await loadGoogleConnection() : null;
  const apiKey = provider === 'gemini' ? null : (settings.openrouter_api_key || process.env.OPENROUTER_API_KEY);
  if (provider === 'gemini' ? !googleConnection : !apiKey) {
    throw new DesignVisionConfigError('Sistem Vision AI API anahtarı (Admin) yapılandırılmamış.');
  }
  const model = requireModel(provider === 'gemini' ? settings.gemini_model_vision : settings.openrouter_model_vision, 'vision');
  const prompt = fillPrompt(await loadPrompt('ai_prompt_analyze_design'), { taxonomyHint: await loadTaxonomyHint() });
  const base64 = image.buffer.toString('base64');
  const mime = VISION_MIME.has(image.mimeType.toLowerCase()) ? image.mimeType.toLowerCase() : 'image/png';

  const content = await withAiRetry(async () => {
    if (provider === 'gemini') {
      const ai = createGoogleClient(googleConnection!);
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: base64 } }] }],
        config: { responseMimeType: 'application/json', temperature: 0.7 },
      });
      const text = res.text?.trim();
      if (!text) throw new Error('Görsel analiz modeli yanıt vermedi.');
      return text;
    }
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'Automania POD Studio' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } }] }],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter API hatası: ${res.status} - ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return String(data.choices?.[0]?.message?.content || '');
  }, { label: 'design-vision', delaysMs: [3_000, 8_000] });

  const json = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
  let parsed: Partial<Record<keyof DesignVisionResult, unknown>>;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Yapay zeka geçerli bir JSON formatı döndürmedi.');
  }
  if (typeof parsed.description !== 'string' || !Array.isArray(parsed.keywords)) throw new Error('Yapay zeka eksik veri döndürdü.');
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const subject = text(parsed.primarySubject);
  const aesthetic = text(parsed.primaryAesthetic);
  return {
    description: parsed.description,
    keywords: parsed.keywords.filter((k): k is string => typeof k === 'string'),
    primarySubject: subject,
    primaryAesthetic: aesthetic,
    niche: subject ? (aesthetic ? `${subject} (${aesthetic})` : subject) : text(parsed.niche),
    userNotes: text(parsed.userNotes),
    productType: text(parsed.productType),
    taxonomyId: Number(parsed.taxonomyId) || null,
  };
}
