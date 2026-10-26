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

import { VideoGenerationReferenceType, type GoogleGenAI } from '@google/genai';
import { createGoogleClient, resolveGoogleConnection, type GoogleConnection } from '@/lib/google-genai-client';
import { normalizeVideoModel } from '@/lib/google-cloud-credentials';
import { isRetryableAiError, withAiRetry } from '@/lib/ai-retry';
import { requireModel } from '@/lib/ai-models';

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
  /** Düzenlenecek görsel (ör. tasarımın diğer kumaş versiyonu); yalnızca Gemini görsel modelleri */
  image?: { data: Buffer; mimeType: string };
}

export interface GenerateVideoOptions {
  prompt: string;
  /** Model kimliği (veo-… veya gemini-omni-…); yoksa admin ayarı */
  model?: string;
  /**
   * Referans görseller (ör. tasarım ve tasarımın basıldığı mockup): video bu ürünü gösterir ama
   * görselle başlamaz (ilk kare olarak kullanılmaz).
   */
  referenceImages?: Array<{ data: Buffer; mimeType: 'image/jpeg' | 'image/png' }>;
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
  
  // Modeller yalnızca admin panelindeki seçimlerdir; seçilmemişse kullanılırken açık bir hata verilir.
  const imageModel = (provider === 'openrouter' ? settings['openrouter_model_generation'] : settings['gemini_model_generation']) ?? '';
  const textModel = (provider === 'openrouter' ? settings['openrouter_model_reasoning'] : settings['gemini_model_reasoning']) ?? '';

  const googleConnection = resolveGoogleConnection(settings);

  return {
    provider,
    googleApiKey: googleConnection?.mode === 'api_key' ? googleConnection.apiKey : googleApiKey,
    googleConnection,
    openRouterApiKey,
    imageModel,
    textModel,
    // Video her zaman Google (Veo / Omni) ile üretilir; bu yüzden yalnızca Gemini video modeli ayarı geçerlidir.
    videoModel: settings['gemini_model_video'] ? normalizeVideoModel(settings['gemini_model_video']) : '',
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
/** Denenecek görsel çözünürlükleri, yüksekten düşüğe. */
const IMAGE_SIZES = ['4K', '2K'];

async function generateImageGoogle(
  config: AIProviderConfig,
  options: GenerateImageOptions
): Promise<GeneratedImage[]> {
  const client = getGoogleClient(config, config.imageModel);

  const aspectRatio = options.aspectRatio ?? '1:1';

  // Imagen modelleri ayrı bir uç nokta (generateImages) kullanır.
  if (config.imageModel.startsWith('imagen')) {
    if (options.image) throw new Error('Seçili görsel modeli (Imagen) görsel düzenlemeyi desteklemiyor.');
    const result = await withAiRetry(() => client.models.generateImages({
      model: config.imageModel,
      prompt: options.prompt,
      config: { numberOfImages: options.numberOfImages ?? 1, aspectRatio },
    }), { label: 'image generation' });
    const imagenImages: GeneratedImage[] = (result.generatedImages ?? [])
      .map((item) => item.image)
      .filter((image): image is NonNullable<typeof image> & { imageBytes: string } => Boolean(image?.imageBytes))
      .map((image) => ({ data: image.imageBytes, mimeType: image.mimeType || 'image/png' }));
    if (imagenImages.length === 0) throw new Error('Imagen görsel üretimi başarısız: Yanıt boş (içerik filtresi olabilir).');
    return imagenImages;
  }

  // Oran açıkça verilmezse model yatay görsel üretip tasarımı bir kenara yerleştirebiliyor. Baskı ve kenar
  // kalitesi için desteklenen en yüksek çözünürlük istenir: 4K, desteklemeyen modelde 2K, o da yoksa boyutsuz.
  const contents = options.image
    ? [{ role: 'user', parts: [{ inlineData: { mimeType: options.image.mimeType, data: options.image.data.toString('base64') } }, { text: options.prompt }] }]
    : options.prompt;
  const request = (imageSize?: string) => client.models.generateContent({
    model: config.imageModel,
    contents,
    config: {
      responseModalities: ['image'],
      imageConfig: { aspectRatio, ...(imageSize ? { imageSize } : {}) },
    },
  });
  // Kapasite hatalarında (429/503) bekleyip yeniden denenir; boyut reddedilirse bir alt boyuta inilir.
  let response;
  const sizes: Array<string | undefined> = [...IMAGE_SIZES, undefined];
  for (const [index, size] of sizes.entries()) {
    try {
      response = await withAiRetry(() => request(size), { label: 'image generation' });
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isLast = index === sizes.length - 1;
      if (isLast || isRetryableAiError(error) || !/image_?size|imageConfig|INVALID_ARGUMENT|not supported/i.test(message)) throw error;
    }
  }
  if (!response) throw new Error('Google görsel üretimi başarısız: Yanıt boş.');

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
  if (options.image) throw new Error('OpenRouter görsel uç noktası görsel düzenlemeyi desteklemiyor.');

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
  requireModel(config.imageModel, 'generation');
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
  const model = requireModel(options.model || config.videoModel, 'video');
  if (isOmniVideoModel(model)) return generateVideoOmni(config, model, options);
  return generateVideoVeo(config, model, options);
}

async function generateVideoVeo(config: AIProviderConfig, model: string, options: GenerateVideoOptions): Promise<GeneratedVideo> {
  const client = getGoogleClient(config, model);

  // Veo 3.x yalnızca 16:9 ve 9:16 ve 4/6/8 sn destekler; ses kapalı (Etsy videoları sessiz oynatılır).
  // Referans görseller "asset" olarak verilir (ilk kare değil); Veo bu modda 8 sn ister. Model referansı
  // desteklemiyorsa ilk mockup ilk kare olarak verilip 6 sn üretilir.
  const refs = options.referenceImages ?? [];
  const request = (withReferences: boolean) => client.models.generateVideos({
    model,
    prompt: options.prompt,
    ...(!withReferences && refs[0] ? { image: { imageBytes: refs[refs.length - 1]!.data.toString('base64'), mimeType: refs[refs.length - 1]!.mimeType } } : {}),
    config: {
      aspectRatio: options.aspectRatio ?? '16:9',
      resolution: options.resolution ?? '720p',
      durationSeconds: withReferences ? 8 : 6,
      // Ses kapatma yalnızca Vertex AI'da destekleniyor (Gemini API anahtarıyla bu alan hata verir).
      ...(config.googleConnection?.mode === 'vertex' ? { generateAudio: false } : {}),
      ...(withReferences
        ? { referenceImages: refs.slice(0, 3).map((ref) => ({ image: { imageBytes: ref.data.toString('base64'), mimeType: ref.mimeType }, referenceType: VideoGenerationReferenceType.ASSET })) }
        : {}),
    },
  });
  let operation;
  try {
    operation = await withAiRetry(() => request(refs.length > 0), { label: 'video generation' });
  } catch (error) {
    if (refs.length === 0 || isRetryableAiError(error) || !/INVALID_ARGUMENT|not supported|reference/i.test(error instanceof Error ? error.message : String(error))) throw error;
    console.warn('[AI] Veo reference images not supported by this model; using the first mockup as the starting frame.');
    operation = await withAiRetry(() => request(false), { label: 'video generation' });
  }

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

/** Omni Flash 3-10 sn üretir; tanıtım videosu için 5 sn yeterli (maliyet ve süre). */
const OMNI_DURATION = '5s';

type OmniVideoContent = { data?: string; uri?: string; mime_type?: string };
type OmniInteraction = { id?: string; status?: string; output_video?: OmniVideoContent; error?: unknown };

async function generateVideoOmni(config: AIProviderConfig, requestedModel: string, options: GenerateVideoOptions): Promise<GeneratedVideo> {
  // Vertex AI (Agent Platform) Omni Flash'ı yalnızca önizleme adıyla sunar; Gemini API GA adını kullanır.
  const model = config.googleConnection?.mode === 'vertex' && !requestedModel.endsWith('-preview')
    ? `${requestedModel}-preview`
    : requestedModel;
  const client = getGoogleClient(config, model);
  // Görseller referans olarak verilir (reference_to_video): video ürünü gösterir ama görselle başlamaz.
  const refs = options.referenceImages ?? [];
  const input = refs.length > 0
    ? [
        ...refs.map((ref) => ({ type: 'image', data: ref.data.toString('base64'), mime_type: ref.mimeType })),
        { type: 'text', text: options.prompt },
      ]
    : options.prompt;

  // Arka planda çalıştırılır; sonuç durum sorgulanarak alınır (sunucu fonksiyonu süre sınırına takılmaz).
  // Süre 5 sn (maliyet ve süre için); model süre alanını kabul etmezse varsayılan süreyle tekrar denenir.
  const createInteraction = client.interactions.create as unknown as (params: Record<string, unknown>) => Promise<OmniInteraction>;
  const request = (duration?: string) => createInteraction.call(client.interactions, {
    model,
    input,
    response_format: {
      type: 'video',
      aspect_ratio: options.aspectRatio === '9:16' ? '9:16' : '16:9',
      resolution: options.resolution ?? '720p',
      ...(duration ? { duration } : {}),
    },
    ...(refs.length > 0 ? { generation_config: { video_config: { task: 'reference_to_video' } } } : {}),
    background: true,
    store: true,
  });
  let interaction: OmniInteraction;
  try {
    interaction = await withAiRetry(() => request(OMNI_DURATION), { label: 'video generation' });
  } catch (error) {
    if (isRetryableAiError(error) || !/INVALID_ARGUMENT|duration/i.test(error instanceof Error ? error.message : String(error))) throw error;
    console.warn('[AI] Omni rejected the duration field; using the model default length.', error instanceof Error ? error.message : error);
    interaction = await withAiRetry(() => request(), { label: 'video generation' });
  }

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
