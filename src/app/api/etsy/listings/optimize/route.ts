import { getErrorMessage } from '@/lib/errors';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { createGoogleClient, loadGoogleConnection } from '@/lib/google-genai-client';
import { sanitizeEtsyTags } from '@/lib/trademark-shield';
import { fillPrompt } from '@/lib/prompt-registry';
import { loadPrompt } from '@/lib/prompt-settings';
import { requireModel } from '@/lib/ai-models';
import { loadSettingRows } from '@/lib/app-settings';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(`ai:etsy-optimize:${session.id}`, 10, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Etsy SEO AI optimize limiti aşıldı.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const body = await req.json();
    const { listingId, listingIds, instructions } = body;

    const targetIds: string[] = [];
    if (listingId) targetIds.push(String(listingId));
    if (Array.isArray(listingIds)) {
      for (const id of listingIds) {
        if (id && !targetIds.includes(String(id))) targetIds.push(String(id));
      }
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Optimize edilecek listing ID belirtilmedi.' }, { status: 400 });
    }
    if (targetIds.length > 10) {
      return NextResponse.json({ success: false, error: 'Tek istekte en fazla 10 listing optimize edilebilir.' }, { status: 400 });
    }

    // 1. Fetch AI Model Settings from app_settings
    const settingsRows = await loadSettingRows(['active_ai_provider', 'openrouter_api_key', 'openrouter_model_reasoning', 'gemini_api_key', 'gemini_model_reasoning']);
    const optimizePrompt = await loadPrompt('ai_prompt_optimize_listing');

    let activeAiProvider = 'openrouter';
    let dbApiKey = null;
    let dbReasoningModel = null;
    let dbGeminiReasoningModel = null;

    for (const row of settingsRows) {
      if (row.setting_key === 'active_ai_provider') activeAiProvider = row.setting_value;
      if (row.setting_key === 'openrouter_api_key') dbApiKey = row.setting_value;
      if (row.setting_key === 'openrouter_model_reasoning') dbReasoningModel = row.setting_value;
      if (row.setting_key === 'gemini_model_reasoning') dbGeminiReasoningModel = row.setting_value;
    }

    // Google için API anahtarı veya Vertex AI hizmet hesabı (admin panelinde seçilir) kullanılır.
    const googleConnection = activeAiProvider === 'gemini' ? await loadGoogleConnection() : null;
    const apiKey = activeAiProvider === 'gemini' ? null : (dbApiKey || process.env.OPENROUTER_API_KEY);

    if (activeAiProvider === 'gemini' ? !googleConnection : !apiKey) {
      return NextResponse.json({ success: false, error: 'Admin panelinde SEO AI anahtarı yapılandırılmamış.' }, { status: 500 });
    }

    // Model yalnızca admin panelindeki seçimdir (yedek model yok).
    const seoModel = requireModel(activeAiProvider === 'gemini' ? dbGeminiReasoningModel : dbReasoningModel, 'reasoning');

    // 2. Fetch top high-opportunity keywords from keyword pool
    const topPoolKeywords = await sql`
      SELECT keyword, opportunity_score, total_listings, bestseller_count 
      FROM keyword_pool 
      WHERE (opportunity_score >= 60 OR bestseller_count > 0)
      ORDER BY opportunity_score DESC, bestseller_count DESC
      LIMIT 40
    `;
    const poolKeywordsList = topPoolKeywords.map(k => k.keyword).join(', ');

    // 3. Fetch target listings from DB
    const listings = await sql`
      SELECT * FROM user_etsy_listings 
      WHERE user_id = ${session.id} AND listing_id = ANY(${targetIds})
    `;

    if (listings.length === 0) {
      return NextResponse.json({ success: false, error: 'Belirtilen ilanlar veritabanında bulunamadı.' }, { status: 404 });
    }

    const results: Array<Record<string, unknown>> = [];
    const errors: string[] = [];

    for (const item of listings) {
      const listingIdStr = String(item.listing_id);
      const currentTags = Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? JSON.parse(item.tags) : []);
      const vision = typeof item.vision_analysis === 'string' ? JSON.parse(item.vision_analysis) : (item.vision_analysis || {});

      // Talimat admin panelindeki "Mevcut ilanı SEO optimizasyonu" prompt'udur; kod yalnızca verileri doldurur.
      const prompt = fillPrompt(optimizePrompt, {
        poolKeywords: poolKeywordsList || 'none',
        title: item.title || 'Untitled',
        tags: currentTags.join(', '),
        description: typeof item.description === 'string' && item.description.trim() ? item.description.trim().slice(0, 4000) : 'none',
        price: `${item.price} ${item.currency_code}`,
        productType: vision.productType || 'not analyzed',
        primarySubject: vision.primarySubject || 'not analyzed',
        primaryAesthetic: vision.primaryAesthetic || 'not analyzed',
        colors: (vision.detectedColors || []).join(', '),
        visualDescription: vision.description || 'not analyzed',
        userInstructions: typeof instructions === 'string' && instructions.trim() ? instructions.trim() : 'None',
      });

      try {
        let rawAiContent = '';

        if (activeAiProvider === 'gemini') {
          const ai = createGoogleClient(googleConnection!);
          const candidates = [seoModel] // Yalnızca admin panelinde seçilen model;

          for (const m of candidates) {
            try {
              const result = await ai.models.generateContent({
                model: m,
                contents: [
                  { role: 'user', parts: [{ text: prompt }] }
                ],
                config: {
                  responseMimeType: 'application/json',
                  temperature: 0.7,
                }
              });
              const txt = result.text?.trim();
              if (txt) {
                rawAiContent = txt;
                break;
              }
            } catch (err: unknown) {
              console.warn(`[Listing Optimize] Model '${m}' failed:`, err instanceof Error ? err.message : err);
              continue;
            }
          }
        } else {
          const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'X-Title': 'Automania Listing SEO Optimizer',
            },
            body: JSON.stringify({
              model: seoModel,
              messages: [
                { role: 'user', content: prompt }
              ]
            })
          });

          if (!openRouterRes.ok) {
            const err = await openRouterRes.text();
            throw new Error(`OpenRouter Hatası: ${openRouterRes.status} - ${err}`);
          }

          const aiData = await openRouterRes.json();
          rawAiContent = aiData.choices?.[0]?.message?.content || '{}';
        }

        // Clean JSON
        const jsonMatch = rawAiContent.match(/\{[\s\S]*\}/);
        const cleanedJson = jsonMatch ? jsonMatch[0] : rawAiContent;
        const parsed = JSON.parse(cleanedJson);

        const optimizedTitle = (parsed.title || item.title || '').trim().slice(0, 140);
        const rawTags = Array.isArray(parsed.tags) ? parsed.tags : [];
        
        // Sanitize tags to ensure strict Etsy 20 character and trademark safety compliance
        const safeTags = sanitizeEtsyTags(rawTags).cleanTags.slice(0, 13);
        const optimizedDescription = (parsed.description || item.description || '').trim();
        const rationale = parsed.rationale || '';


        // Save to DB
        await sql`
          UPDATE user_etsy_listings 
          SET 
            ai_optimized_title = ${optimizedTitle},
            ai_optimized_tags = ${JSON.stringify(safeTags)}::jsonb,
            ai_optimized_description = ${optimizedDescription},
            ai_optimized_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ${session.id} AND listing_id = ${listingIdStr}
        `;

        results.push({
          listingId: listingIdStr,
          aiOptimizedTitle: optimizedTitle,
          aiOptimizedTags: safeTags,
          aiOptimizedDescription: optimizedDescription,
          rationale,
          aiOptimizedAt: new Date().toISOString()
        });

        // Throttle slightly between requests if batch
        if (listings.length > 1) {
          await new Promise(r => setTimeout(r, 200));
        }

      } catch (err) {
        console.error(`Optimization error on listing ${listingIdStr}:`, err);
        errors.push(`İlan #${listingIdStr}: ${getErrorMessage(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      optimizedCount: results.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('AI SEO Optimize API Error:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
