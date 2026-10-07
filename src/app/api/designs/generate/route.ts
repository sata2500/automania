/**
 * POST /api/designs/generate
 * ============================
 * Gemini ile görsel üretir.
 * Body: { prompt, folderId?, greenBackground?, numberOfImages? }
 * Response: { images: [{ id, data, mimeType }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { loadAIConfig, generateImage } from '@/lib/ai-provider';
import { sql } from '@/lib/db';
import { consumeRateLimit } from '@/lib/request-rate-limit';

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
      greenBackground = true,
      numberOfImages = 1,
    } = body as {
      prompt: string;
      selectedStyle?: string;
      greenBackground?: boolean;
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
    for (let i = 0; i < count; i++) {
      const rateLimit = consumeRateLimit(`ai:generate-image:${session.id}`, IMAGE_QUOTA_PER_HOUR, 60 * 60_000);
      if (!rateLimit.allowed) {
        return NextResponse.json({ error: 'Saatlik görsel üretim limitine ulaşıldı. Lütfen daha sonra tekrar deneyin.' }, {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        });
      }
    }

    const config = await loadAIConfig();

    if (!config.googleApiKey && config.provider === 'google') {
      return NextResponse.json(
        { error: 'Google API anahtarı yapılandırılmamış. Admin panelinden ayarlayın.' },
        { status: 503 }
      );
    }

    // Özel prompt şablonunu veritabanından al
    let systemPromptTemplate = '';
    try {
      const rows = await sql`SELECT setting_value FROM app_settings WHERE setting_key = 'ai_prompt_generate_design'`;
      if (rows.length > 0 && rows[0].setting_value) {
        systemPromptTemplate = rows[0].setting_value;
      }
    } catch (e) {
      console.error('[generate design] Failed to fetch custom prompt template', e);
    }

    // Şablon varsa değişkenleri değiştir, yoksa sadece kullanıcının girdiği promptu kullan
    let finalPrompt = prompt;
    if (systemPromptTemplate.trim()) {
      finalPrompt = systemPromptTemplate
        .replace(/\{\{userPrompt\}\}/g, prompt)
        .replace(/\{\{selectedStyle\}\}/g, typeof selectedStyle === 'string' ? selectedStyle : '');
    }

    // Birden fazla görsel için paralel istek
    const requests = Array.from({ length: count }, () =>
      generateImage(config, { prompt: finalPrompt, greenBackground })
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
