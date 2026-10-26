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

import type { GoogleGenAI } from '@google/genai';
import { createGoogleClient, resolveGoogleConnection, type GoogleConnection } from '@/lib/google-genai-client';
import { DEFAULT_VIDEO_MODEL, normalizeVideoModel } from '@/lib/google-cloud-credentials';

// ─── Tipler ──────────────────────────────────────────────────────────────────

export type AIProvider = 'google' | 'openrouter';

export interface AIProviderConfig {
  /** Aktif provider */
  provider: AIProvider;
  /** Google Gemini API Key (yalnızca API anahtarı yönteminde; Veo dosya indirme için) */
  googleApiKey: string;
  /** Google bağlantısı: API anahtarı veya Vertex AI hizmet hesabı (yapılandırılmamışsa null) */
  googleConnection: GoogleConnection | null;
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
  /** Kare (1024x1024) veya özel oran */
  aspectRatio?: '1:1' | '9:16' | '16:9' | '4:3' | '3:4';
  /** 1–4 adet görsel */
  numberOfImages?: number;
}

export interface GenerateVideoOptions {
  prompt: string;
  /** Model kimliği (veo-… veya gemini-omni-…); yoksa admin ayarı */
  model?: string;
  /** Referans görsel (image-to-video): video bu ürünü gösterir */
  image?: { data: Buffer; mimeType: 'image/jpeg' | 'image/png' };
  /** Saniye (5 veya 8) */
  durationSeconds?: 5 | 8;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  resolution?: '720p' | '1080p';
  /** En fazla bekleme süresi (ms). Varsayılan 5 dakika; sunucu fonksiyonu süre sınırı için kısaltılabilir. */
  maxWaitMs?: number;
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

import { loadSettingRows } from '@/lib/app-settings';

/**
 * Admin DB'den AI provider konfigürasyonunu okur.
 * DB'de ayar yoksa env değişkenlerine fallback yapar.
 */
export async function loadAIConfig(): Promise<AIProviderConfig> {
  const settings: Record<string, string> = {};
  
  try {
    const rows = await loadSettingRows();
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

  const googleConnection = resolveGoogleConnection(settings);

  return {
    provider,
    googleApiKey: googleConnection?.mode === 'api_key' ? googleConnection.apiKey : googleApiKey,
    googleConnection,
    openRouterApiKey,
    imageModel,
    textModel,
    // Video her zaman Google Veo ile üretilir; bu yüzden yalnızca Gemini video modeli ayarı geçerlidir.
    videoModel: normalizeVideoModel(settings['gemini_model_video'] || process.env.AI_VIDEO_MODEL || DEFAULT_VIDEO_MODEL),
  };
}


// ─── Google Gemini Client ────────────────────────────────────────────────────

function getGoogleClient(config: AIProviderConfig, model?: string): GoogleGenAI {
  if (!config.googleConnection) {
    throw new Error('Google AI bağlantısı yapılandırılmamış. Admin panelinden Gemini API anahtarı veya Google Cloud hizmet hesabı ekleyin.');
  }
  return createGoogleClient(config.googleConnection, { model });
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
  const client = getGoogleClient(config, config.imageModel);

  const aspectRatio = options.aspectRatio ?? '1:1';

  // Imagen modelleri ayrı bir uç nokta (generateImages) kullanır.
  if (config.imageModel.startsWith('imagen')) {
    const result = await client.models.generateImages({
      model: config.imageModel,
      prompt: options.prompt,
      config: { numberOfImages: options.numberOfImages ?? 1, aspectRatio },
    });
    const imagenImages: GeneratedImage[] = (result.generatedImages ?? [])
      .map((item) => item.image)
      .filter((image): image is NonNullable<typeof image> & { imageBytes: string } => Boolean(image?.imageBytes))
      .map((image) => ({ data: image.imageBytes, mimeType: image.mimeType || 'image/png' }));
    if (imagenImages.length === 0) throw new Error('Imagen görsel üretimi başarısız: Yanıt boş (içerik filtresi olabilir).');
    return imagenImages;
  }

  // Oran açıkça verilmezse model yatay görsel üretip tasarımı bir kenara yerleştirebiliyor. 2K, baskı ve
  // kenar kalitesi için; desteklemeyen modelde (yalnız 1K) istek boyut olmadan tekrarlanır.
  const request = (imageSize?: string) => client.models.generateContent({
    model: config.imageModel,
    contents: options.prompt,
    config: {
      responseModalities: ['image'],
      imageConfig: { aspectRatio, ...(imageSize ? { imageSize } : {}) },
    },
  });
  let response;
  try {
    response = await request('2K');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/image_?size|imageConfig|INVALID_ARGUMENT|not supported/i.test(message)) throw error;
    response = await request();
  }

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

  const res = await fetch('https://openrouter.ai/api/v1/images', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.imageModel,
      prompt: options.prompt,
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
  return ((data.data ?? []) as Array<{ b64_json?: string; url?: string }>)
    .map((item) => item.b64_json ?? item.url)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map((value) => ({ data: value, mimeType: 'image/png' }));
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

// ─── Video Üretimi (Veo 3.1 / Gemini Omni Flash) ─────────────────────────────

/** Gemini Omni Flash modelleri `interactions` API'si ile, Veo modelleri `generateVideos` ile çalışır. */
export function isOmniVideoModel(model: string | undefined): boolean {
  return Boolean(model?.startsWith('gemini-omni'));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Video üretir. Model `options.model` ile seçilebilir (yoksa admin ayarı). Referans görsel verilirse
 * (ör. tasarımın basıldığı mockup) video o ürünü gösterir (image-to-video).
 * Asenkron: üretim sürerken 10 sn aralıklarla durum sorgulanır.
 */
export async function generateVideo(
  config: AIProviderConfig,
  options: GenerateVideoOptions
): Promise<GeneratedVideo> {
  const model = options.model || config.videoModel;
  if (isOmniVideoModel(model)) return generateVideoOmni(config, model, options);
  return generateVideoVeo(config, model, options);
}

async function generateVideoVeo(config: AIProviderConfig, model: string, options: GenerateVideoOptions): Promise<GeneratedVideo> {
  const client = getGoogleClient(config, model);

  // Veo 3.x yalnızca 16:9 ve 9:16 destekler.
  let operation = await client.models.generateVideos({
    model,
    prompt: options.prompt,
    ...(options.image ? { image: { imageBytes: options.image.data.toString('base64'), mimeType: options.image.mimeType } } : {}),
    config: {
      aspectRatio: options.aspectRatio ?? '16:9',
      resolution: options.resolution ?? '720p',
      durationSeconds: options.durationSeconds ?? 8,
    },
  });

  const deadline = Date.now() + (options.maxWaitMs ?? 300_000);
  while (!operation.done && Date.now() < deadline) {
    await sleep(10_000);
    operation = await client.operations.getVideosOperation({ operation });
  }

  if (!operation.done) {
    throw new Error(`Video üretimi zaman aşımına uğradı (${Math.round((options.maxWaitMs ?? 300_000) / 60_000)} dakika).`);
  }

  if (operation.error) {
    throw new Error(`Veo hatası: ${JSON.stringify(operation.error)}`);
  }

  const generatedVideo = operation.response?.generatedVideos?.[0];
  if (!generatedVideo?.video) {
    throw new Error('Video üretimi başarısız: Yanıt boş (içerik filtresine takılmış olabilir).');
  }

  const mimeType = generatedVideo.video.mimeType ?? 'video/mp4';
  const uri = generatedVideo.video.uri
    ?? (generatedVideo.video.videoBytes ? `data:${mimeType};base64,${generatedVideo.video.videoBytes}` : undefined);
  if (!uri) {
    throw new Error('Video üretimi başarısız: Yanıtta video adresi yok.');
  }

  return { uri, mimeType };
}

type OmniVideoContent = { data?: string; uri?: string; mime_type?: string };
type OmniInteraction = { id?: string; status?: string; output_video?: OmniVideoContent; error?: unknown };

async function generateVideoOmni(config: AIProviderConfig, requestedModel: string, options: GenerateVideoOptions): Promise<GeneratedVideo> {
  // Vertex AI (Agent Platform) Omni Flash'ı yalnızca önizleme adıyla sunar; Gemini API GA adını kullanır.
  const model = config.googleConnection?.mode === 'vertex' && !requestedModel.endsWith('-preview')
    ? `${requestedModel}-preview`
    : requestedModel;
  const client = getGoogleClient(config, model);
  const input = options.image
    ? [
        { type: 'image', data: options.image.data.toString('base64'), mime_type: options.image.mimeType },
        { type: 'text', text: options.prompt },
      ]
    : options.prompt;

  // Arka planda çalıştırılır; sonuç durum sorgulanarak alınır (sunucu fonksiyonu süre sınırına takılmaz).
  let interaction = await (client.interactions.create as unknown as (params: Record<string, unknown>) => Promise<OmniInteraction>)({
    model,
    input,
    response_format: {
      type: 'video',
      aspect_ratio: options.aspectRatio === '9:16' ? '9:16' : '16:9',
      resolution: options.resolution ?? '720p',
    },
    ...(options.image ? { generation_config: { video_config: { task: 'image_to_video' } } } : {}),
    background: true,
    store: true,
  });

  const deadline = Date.now() + (options.maxWaitMs ?? 300_000);
  while (!interaction.output_video && interaction.id && !isFinalInteraction(interaction.status) && Date.now() < deadline) {
    await sleep(10_000);
    interaction = await (client.interactions.get as unknown as (id: string) => Promise<OmniInteraction>)(interaction.id);
  }

  const video = interaction.output_video;
  if (!video) {
    if (!isFinalInteraction(interaction.status)) {
      throw new Error(`Video üretimi zaman aşımına uğradı (${Math.round((options.maxWaitMs ?? 300_000) / 60_000)} dakika).`);
    }
    throw new Error(`Omni Flash video üretemedi (${interaction.status ?? 'bilinmeyen durum'}${interaction.error ? `: ${JSON.stringify(interaction.error).slice(0, 200)}` : ''}).`);
  }
  const mimeType = video.mime_type || 'video/mp4';
  const uri = video.data ? `data:${mimeType};base64,${video.data}` : video.uri;
  if (!uri) throw new Error('Video üretimi başarısız: Yanıtta video yok.');
  return { uri, mimeType };
}

function isFinalInteraction(status: string | undefined): boolean {
  return Boolean(status && status !== 'in_progress' && status !== 'queued');
}
