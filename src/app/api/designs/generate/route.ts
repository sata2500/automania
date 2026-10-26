/**
 * POST /api/designs/generate
 * ============================
 * Gemini ile görsel üretir.
 * Body: { prompt, selectedStyle?, numberOfImages? }
 * Response: { images: [{ id, data, mimeType }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { loadAIConfig, generateImage } from '@/lib/ai-provider';
import { keyColorPromptValues, pickKeyBackground } from '@/lib/key-background';
import { fillPrompt } from '@/lib/prompt-registry';
import { loadPrompt } from '@/lib/prompt-settings';
import { checkRateLimit } from '@/lib/request-rate-limit';

export const maxDuration = 120;

const MAX_PROMPT_LENGTH = 4000;
const MAX_IMAGES_PER_REQUEST = 4;
// Kullanıcı başına saatlik görsel üretim kotası (en maliyetli AI işlemi)
const IMAGE_QUOTA_PER_HOUR = 40;

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthoritativeSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      prompt,
      selectedStyle = '',
      numberOfImages = 1,
    } = body as {
      prompt: string;
      selectedStyle?: string;
      numberOfImages?: number;
    };

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt zorunludur.' }, { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_LENGTH || (typeof selectedStyle === 'string' && selectedStyle.length > 500)) {
      return NextResponse.json({ error: 'Prompt çok uzun.' }, { status: 400 });
    }

    const requested = Number(numberOfImages);
    const count = Number.isFinite(requested)
      ? Math.min(Math.max(1, Math.floor(requested)), MAX_IMAGES_PER_REQUEST)
      : 1;

    // Her görsel kotadan bir birim düşer.
    const rateLimit = await checkRateLimit(`ai:generate-image:${session.id}`, IMAGE_QUOTA_PER_HOUR, 60 * 60_000, count);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Saatlik görsel üretim limitine ulaşıldı. Lütfen daha sonra tekrar deneyin.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const config = await loadAIConfig();

    if (config.provider !== 'openrouter' && !config.googleConnection) {
      return NextResponse.json(
        { error: 'Google AI bağlantısı yapılandırılmamış. Admin panelinden Gemini API anahtarı veya Google Cloud hizmet hesabı ekleyin.' },
        { status: 503 }
      );
    }

    // Admin panelindeki "Tasarım üretimi" talimatı (boşsa varsayılan) kullanıcının konseptiyle doldurulur.
    // Perde rengi konuya göre seçilir (yeşil ağırlıklı konularda magenta); kaldırma adımı rengi kenarlardan ölçer.
    const style = typeof selectedStyle === 'string' && selectedStyle.trim() ? selectedStyle.trim() : 'not specified';
    const finalPrompt = fillPrompt(await loadPrompt('ai_prompt_generate_design'), {
      concept: prompt.trim(),
      style,
      ...keyColorPromptValues(pickKeyBackground(`${prompt} ${style}`)),
    });

    // Birden fazla görsel için paralel istek
    const requests = Array.from({ length: count }, () =>
      generateImage(config, { prompt: finalPrompt })
    );

    const results = await Promise.allSettled(requests);

    const images: { id: string; data: string; mimeType: string }[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const img of result.value) {
          images.push({
            id: crypto.randomUUID(),
            data: img.data,
            mimeType: img.mimeType,
          });
        }
      }
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'Görsel üretilemedi. Lütfen promptu değiştirip tekrar deneyin.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ images, count: images.length });
  } catch (error: unknown) {
    console.error('[POST /api/designs/generate] Error:', error);
    return NextResponse.json({ error: 'Görsel üretilirken bir hata oluştu.' }, { status: 500 });
  }
}
