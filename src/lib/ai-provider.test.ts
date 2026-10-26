import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  models: { generateVideos: vi.fn(), generateContent: vi.fn() },
  operations: { getVideosOperation: vi.fn() },
  interactions: { create: vi.fn(), get: vi.fn() },
}));
vi.mock('@/lib/google-genai-client', () => ({
  createGoogleClient: () => client,
  resolveGoogleConnection: () => null,
}));
vi.mock('@/lib/app-settings', () => ({ loadSettingRows: vi.fn(async () => []) }));

import { generateImage, generateVideo, type AIProviderConfig } from './ai-provider';

const config = (mode: 'vertex' | 'api_key'): AIProviderConfig => ({
  provider: 'google',
  googleApiKey: 'k',
  googleConnection: (mode === 'vertex' ? { mode, location: 'global' } : { mode, apiKey: 'k' }) as AIProviderConfig['googleConnection'],
  openRouterApiKey: '',
  imageModel: 'gemini-image',
  textModel: '',
  videoModel: '',
});
const refs = [
  { data: Buffer.from('design'), mimeType: 'image/jpeg' as const },
  { data: Buffer.from('mockup'), mimeType: 'image/jpeg' as const },
];

beforeEach(() => vi.clearAllMocks());

describe('generateVideo', () => {
  it('Omni: sends the images as references (not a first frame) and asks for 5 seconds', async () => {
    client.interactions.create.mockResolvedValue({ id: 'i', status: 'completed', output_video: { uri: 'gs://v.mp4' } });
    await generateVideo(config('api_key'), { prompt: 'p', model: 'gemini-omni-1.1-flash', referenceImages: refs });
    const params = client.interactions.create.mock.calls[0]![0];
    expect(params.generation_config).toEqual({ video_config: { task: 'reference_to_video' } });
    expect(params.response_format.duration).toBe('5s');
    expect(params.input).toHaveLength(3);
  });

  it('Omni: retries without the duration field when the model rejects it', async () => {
    client.interactions.create
      .mockRejectedValueOnce(new Error('400 INVALID_ARGUMENT: unknown field duration'))
      .mockResolvedValue({ id: 'i', status: 'completed', output_video: { uri: 'gs://v.mp4' } });
    await generateVideo(config('api_key'), { prompt: 'p', model: 'gemini-omni-1.1-flash', referenceImages: refs });
    expect(client.interactions.create.mock.calls[1]![0].response_format.duration).toBeUndefined();
  });

  it('Veo on Vertex: asset references, 8 seconds, no audio', async () => {
    client.models.generateVideos.mockResolvedValue({ done: true, response: { generatedVideos: [{ video: { uri: 'gs://v.mp4' } }] } });
    await generateVideo(config('vertex'), { prompt: 'p', model: 'veo-3.1-generate-001', referenceImages: refs });
    const params = client.models.generateVideos.mock.calls[0]![0];
    expect(params.image).toBeUndefined();
    expect(params.config.referenceImages).toHaveLength(2);
    expect(params.config.durationSeconds).toBe(8);
    expect(params.config.generateAudio).toBe(false);
  });

  it('Veo: falls back to the mockup as first frame (6 s) when references are not supported', async () => {
    client.models.generateVideos
      .mockRejectedValueOnce(new Error('400 INVALID_ARGUMENT: referenceImages is not supported for this model'))
      .mockResolvedValue({ done: true, response: { generatedVideos: [{ video: { uri: 'gs://v.mp4' } }] } });
    await generateVideo(config('api_key'), { prompt: 'p', model: 'veo-3.1-fast-generate-001', referenceImages: refs });
    const params = client.models.generateVideos.mock.calls[1]![0];
    expect(params.image.imageBytes).toBe(Buffer.from('mockup').toString('base64'));
    expect(params.config.durationSeconds).toBe(6);
    expect(params.config.generateAudio).toBeUndefined(); // Gemini API bu alanı desteklemiyor
  });
});

describe('generateImage', () => {
  it('sends an input image to the Gemini image model for edits', async () => {
    client.models.generateContent.mockResolvedValue({ candidates: [{ content: { parts: [{ inlineData: { data: 'x', mimeType: 'image/png' } }] } }] });
    await generateImage(config('vertex'), { prompt: 'redraw', image: { data: Buffer.from('img'), mimeType: 'image/png' } });
    const params = client.models.generateContent.mock.calls[0]![0];
    expect(params.contents[0].parts[0].inlineData.data).toBe(Buffer.from('img').toString('base64'));
    expect(params.config.imageConfig.aspectRatio).toBe('1:1');
  });
});
