/**
 * AI Provider Unified Service
 * ============================
 * Google Gemini ve OpenRouter için tek bir arayüz.
 * Admin panelden seçilen provider/model ayarları bu servis üzerinden okunur.
 *
 * Görsel Üretim:
 *  - Google: gemini-3.1-flash-image / gemini-3-pro-image
 *  - OpenRouter: /api/v1/images  (FLUX.2, Seedream 4.5, Recraft vb.)
 *
 * Metin Üretim (SEO vb.):
 *  - Google: gemini-3.1-flash / gemini-3-pro
 *  - OpenRouter: /api/v1/chat/completions
 *
 * Video Üretim:
 *  - Google Veo 3.1: client.models.generate_videos()  (Sadece Google)
 */

import { GoogleGenAI } from '@google/genai';

// ─── Tipler ──────────────────────────────────────────────────────────────────

export type AIProvider = 'google' | 'openrouter';

export interface AIProviderConfig {
  /** Aktif provider */
  provider: AIProvider;
  /** Google Gemini API Key */
  googleApiKey: string;
  /** OpenRouter API Key */
  openRouterApiKey: string;
  /** Görsel üretim modeli (provider'a göre) */
  imageModel: string;
  /** Metin üretim modeli */
  textModel: string;
  /** Video üretim modeli (her zaman Google Veo) */
  videoModel: string;
}

export interface GenerateImageOptions {
  prompt: string;
  /** Arka planı yeşil (#00FF00) yap — chroma key için */
  greenBackground?: boolean;
  /** Kare (1024x1024) veya özel oran */
  aspectRatio?: '1:1' | '9:16' | '16:9' | '4:3' | '3:4';
  /** 1–4 adet görsel */
  numberOfImages?: number;
}

export interface GenerateTextOptions {
  prompt: string;
  systemInstruction?: string;
  maxOutputTokens?: number;
  temperature?: number;
  /** JSON formatında yanıt istiyorsak true */
  jsonOutput?: boolean;
}

export interface GenerateVideoOptions {
  prompt: string;
  /** Saniye (5 veya 8) */
  durationSeconds?: 5 | 8;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  resolution?: '720p' | '1080p';
}

export interface GeneratedImage {
  /** base64 veya URL */
  data: string;
  mimeType: string;
}

export interface GeneratedVideo {
  /** Google Files API URI */
  uri: string;
  mimeType: string;
}

// ─── Config Loader ───────────────────────────────────────────────────────────

import { sql } from '@/lib/db';

/**
 * Admin DB'den AI provider konfigürasyonunu okur.
 * DB'de ayar yoksa env değişkenlerine fallback yapar.
 */
export async function loadAIConfig(): Promise<AIProviderConfig> {
  const settings: Record<string, string> = {};
  
  try {
    const rows = await sql`SELECT setting_key, setting_value FROM app_settings`;
    for (const row of rows) {
      if (row.setting_key && row.setting_value) {
        settings[row.setting_key] = row.setting_value;
      }
    }
  } catch (e) {
    console.error('[loadAIConfig] Failed to load settings from DB, falling back to ENV', e);
  }

  const provider = (settings['active_ai_provider'] as AIProvider) ?? (process.env.AI_PROVIDER as AIProvider) ?? 'google';
  
  const googleApiKey = settings['gemini_api_key'] ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';
  const openRouterApiKey = settings['openrouter_api_key'] ?? process.env.OPENROUTER_API_KEY ?? '';
  
  const imageModel = provider === 'openrouter' 
    ? (settings['openrouter_model_generation'] ?? process.env.AI_IMAGE_MODEL ?? 'gemini-3.1-flash-image')
    : (settings['gemini_model_generation'] ?? process.env.AI_IMAGE_MODEL ?? 'gemini-3.1-flash-image');

  const textModel = provider === 'openrouter'
    ? (settings['openrouter_model_reasoning'] ?? process.env.AI_TEXT_MODEL ?? 'gemini-3.8-flash')
    : (settings['gemini_model_reasoning'] ?? process.env.AI_TEXT_MODEL ?? 'gemini-3.8-flash');

  return {
    provider,
    googleApiKey,
    openRouterApiKey,
    imageModel,
    textModel,
    videoModel: process.env.AI_VIDEO_MODEL ?? 'veo-3.1-fast-generate-preview',
  };
}

// ─── Google Gemini Client ────────────────────────────────────────────────────

function getGoogleClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

// ─── Görsel Üretimi ──────────────────────────────────────────────────────────

/**
 * Google Gemini ile görsel üretir.
 * Model: gemini-3.1-flash-image (Imagen 4 devre dışı, 17 Ağustos 2026)
 */
async function generateImageGoogle(
  config: AIProviderConfig,
  options: GenerateImageOptions
): Promise<GeneratedImage[]> {
  const client = getGoogleClient(config.googleApiKey);

  const promptWithBg = options.greenBackground
    ? `${options.prompt}. The design must have a solid bright green (#00FF00) background, suitable for chroma key removal. No shadows or gradients on the background.`
    : options.prompt;

  const response = await client.models.generateContent({
    model: config.imageModel,
    contents: promptWithBg,
    config: {
      responseModalities: ['image'],
    },
  });

  const images: GeneratedImage[] = [];
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data && part.inlineData.mimeType) {
        images.push({
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        });
      }
    }
  }

  if (images.length === 0) {
    throw new Error('Google görsel üretimi başarısız: Yanıt boş.');
  }

  return images;
}

/**
 * OpenRouter ile görsel üretir.
 * Endpoint: POST https://openrouter.ai/api/v1/images
 */
async function generateImageOpenRouter(
  config: AIProviderConfig,
  options: GenerateImageOptions
): Promise<GeneratedImage[]> {
  const promptWithBg = options.greenBackground
    ? `${options.prompt}. Solid bright green (#00FF00) background, chroma key ready, no shadows on background.`
    : options.prompt;

  const res = await fetch('https://openrouter.ai/api/v1/images', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.imageModel,
      prompt: promptWithBg,
      n: options.numberOfImages ?? 1,
      size: options.aspectRatio === '16:9' ? '1344x768' : '1024x1024',
      response_format: 'b64_json',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter görsel hatası: ${err}`);
  }

  const data = await res.json();
  return (data.data ?? []).map((item: any) => ({
    data: item.b64_json ?? item.url,
    mimeType: 'image/png',
  }));
}

/**
 * Aktif provider'a göre görsel üretir.
 */
export async function generateImage(
  config: AIProviderConfig,
  options: GenerateImageOptions
): Promise<GeneratedImage[]> {
  if (config.provider === 'openrouter' && config.openRouterApiKey) {
    return generateImageOpenRouter(config, options);
  }
  return generateImageGoogle(config, options);
}

// ─── Metin Üretimi ───────────────────────────────────────────────────────────

/**
 * Aktif provider'a göre metin üretir (SEO, başlık, açıklama vb.)
 */
export async function generateText(
  config: AIProviderConfig,
  options: GenerateTextOptions
): Promise<string> {
  if (config.provider === 'openrouter' && config.openRouterApiKey) {
    return generateTextOpenRouter(config, options);
  }
  return generateTextGoogle(config, options);
}

async function generateTextGoogle(
  config: AIProviderConfig,
  options: GenerateTextOptions
): Promise<string> {
  const client = getGoogleClient(config.googleApiKey);
  const primaryModel = config.textModel || 'gemini-3.8-flash';

  // Model havuzu: Seçilen model hata verirse (503 / 429 / 404), güvenilir alternatiflere otomatik fallback
  const fallbackCandidates = Array.from(new Set([
    primaryModel,
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite'
  ]));

  let lastError: unknown = null;

  for (const modelToTry of fallbackCandidates) {
    try {
      const response = await client.models.generateContent({
        model: modelToTry,
        contents: options.prompt,
        config: {
          systemInstruction: options.systemInstruction,
          maxOutputTokens: options.maxOutputTokens ?? 8192,
          temperature: options.temperature ?? 0.7,
          responseMimeType: options.jsonOutput ? 'application/json' : 'text/plain',
        },
      });

      return response.text ?? '';
    } catch (err: unknown) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Google AI Text] Model '${modelToTry}' failed: ${errMsg.slice(0, 100)}. Trying fallback candidate...`);
      continue;
    }
  }

  throw lastError || new Error('Google metin üretimi tüm aday modellerle başarısız oldu.');
}

async function generateTextOpenRouter(
  config: AIProviderConfig,
  options: GenerateTextOptions
): Promise<string> {
  const messages: any[] = [];
  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction });
  }
  messages.push({ role: 'user', content: options.prompt });

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.textModel,
      messages,
      max_tokens: options.maxOutputTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      ...(options.jsonOutput ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter metin hatası: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Video Üretimi (Veo 3.1) ─────────────────────────────────────────────────

/**
 * Google Veo 3.1 ile video üretir.
 * Asenkron polling pattern — uzun sürebilir (30–180 sn).
 */
export async function generateVideo(
  config: AIProviderConfig,
  options: GenerateVideoOptions
): Promise<GeneratedVideo> {
  if (!config.googleApiKey) {
    throw new Error('Video üretimi için Google API Key gereklidir.');
  }

  const client = getGoogleClient(config.googleApiKey);

  // Video üretimi başlat
  let operation = await (client.models as any).generateVideos({
    model: config.videoModel,
    prompt: options.prompt,
    config: {
      aspectRatio: options.aspectRatio ?? '1:1',
      resolution: options.resolution ?? '720p',
      durationSeconds: options.durationSeconds ?? 8,
    },
  });

  // Polling (maksimum 5 dakika)
  const maxAttempts = 30;
  let attempts = 0;

  while (!operation.done && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 10_000)); // 10sn bekle
    operation = await (client.operations as any).get(operation);
    attempts++;
  }

  if (!operation.done) {
    throw new Error('Video üretimi zaman aşımına uğradı (5 dakika).');
  }

  if (operation.error) {
    throw new Error(`Veo hatası: ${JSON.stringify(operation.error)}`);
  }

  const generatedVideo = operation.response?.generatedVideos?.[0];
  if (!generatedVideo?.video) {
    throw new Error('Video üretimi başarısız: Yanıt boş.');
  }

  return {
    uri: generatedVideo.video.uri ?? generatedVideo.video.name,
    mimeType: generatedVideo.video.mimeType ?? 'video/mp4',
  };
}

// ─── Kullanılabilir Modeller ──────────────────────────────────────────────────

/**
 * OpenRouter'dan mevcut görsel üretim modellerini çeker.
 */
export async function fetchOpenRouterImageModels(apiKey: string): Promise<{id: string; name: string}[]> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models?output_modalities=image', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []).map((m: any) => ({ id: m.id, name: m.name ?? m.id }));
  } catch {
    return [];
  }
}

/**
 * Sabit Google görsel modellerini döner (güncel, Ağustos 2026).
 */
export function getGoogleImageModels() {
  return [
    { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image (Nano Banana 2)' },
    { id: 'gemini-3-pro-image', name: 'Gemini 3 Pro Image (Nano Banana 2 Pro)' },
    { id: 'gemini-3.1-flash-lite-image', name: 'Gemini 3.1 Flash-Lite Image (Hızlı)' },
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
  ];
}

/**
 * Google video modellerini döner.
 */
export function getGoogleVideoModels() {
  return [
    { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast (Hız Odaklı)' },
    { id: 'veo-3.1-generate-preview', name: 'Veo 3.1 (Kalite Odaklı)' },
    { id: 'veo-3.1-lite-generate-preview', name: 'Veo 3.1 Lite (Düşük Maliyet)' },
  ];
}
