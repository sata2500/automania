/**
 * POST /api/designs/generate
 * ============================
 * Gemini ile görsel üretir.
 * Body: { prompt, folderId?, greenBackground?, numberOfImages? }
 * Response: { images: [{ id, data, mimeType }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { loadAIConfig, generateImage } from '@/lib/ai-provider';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
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

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt zorunludur.' }, { status: 400 });
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
        .replace(/\{\{selectedStyle\}\}/g, selectedStyle);
    }

    // Birden fazla görsel için paralel istek
    const count = Math.min(Math.max(1, numberOfImages), 4); // max 4
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
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('[POST /api/designs/generate] Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
