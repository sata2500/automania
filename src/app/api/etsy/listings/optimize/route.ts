import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { filterSafeKeywords, sanitizeEtsyTags } from '@/lib/trademark-shield';
import { getCurrentSeasonInfo } from '@/lib/seasonality';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
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

    // 1. Fetch AI Model Settings from app_settings
    const settingsRows = await sql`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key IN (
        'active_ai_provider', 
        'openrouter_api_key', 
        'openrouter_model_reasoning', 
        'gemini_api_key', 
        'gemini_model_reasoning',
        'ai_prompt_generate_listing'
      )
    `;

    let activeAiProvider = 'openrouter';
    let dbApiKey = null;
    let dbReasoningModel = null;
    let geminiApiKey = null;
    let dbGeminiReasoningModel = null;

    for (const row of settingsRows) {
      if (row.setting_key === 'active_ai_provider') activeAiProvider = row.setting_value;
      if (row.setting_key === 'openrouter_api_key') dbApiKey = row.setting_value;
      if (row.setting_key === 'openrouter_model_reasoning') dbReasoningModel = row.setting_value;
      if (row.setting_key === 'gemini_api_key') geminiApiKey = row.setting_value;
      if (row.setting_key === 'gemini_model_reasoning') dbGeminiReasoningModel = row.setting_value;
    }

    const apiKey = activeAiProvider === 'gemini'
      ? (geminiApiKey || process.env.GEMINI_API_KEY)
      : (dbApiKey || process.env.OPENROUTER_API_KEY);

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Admin panelinde SEO AI anahtarı yapılandırılmamış.' }, { status: 500 });
    }

    let seoModel = activeAiProvider === 'gemini'
      ? (dbGeminiReasoningModel || 'gemini-1.5-pro')
      : (dbReasoningModel || 'google/gemma-4-26b-a4b-it:free');

    // 2. Seasonality & Shopping Wave Context
    const currentSeason = getCurrentSeasonInfo();

    // 3. Fetch top high-opportunity keywords from keyword pool
    const topPoolKeywords = await sql`
      SELECT keyword, opportunity_score, total_listings, bestseller_count 
      FROM keyword_pool 
      WHERE (opportunity_score >= 60 OR bestseller_count > 0)
      ORDER BY opportunity_score DESC, bestseller_count DESC
      LIMIT 40
    `;
    const poolKeywordsList = topPoolKeywords.map(k => k.keyword).join(', ');

    // 4. Fetch target listings from DB
    const listings = await sql`
      SELECT * FROM user_etsy_listings 
      WHERE user_id = ${session.id} AND listing_id = ANY(${targetIds as any})
    `;

    if (listings.length === 0) {
      return NextResponse.json({ success: false, error: 'Belirtilen ilanlar veritabanında bulunamadı.' }, { status: 404 });
    }

    const results: any[] = [];
    const errors: string[] = [];

    for (const item of listings) {
      const listingIdStr = String(item.listing_id);
      const currentTags = Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? JSON.parse(item.tags) : []);
      const vision = typeof item.vision_analysis === 'string' ? JSON.parse(item.vision_analysis) : (item.vision_analysis || {});

      const systemPrompt = `You are a World-Class Etsy SEO Strategist, Copywriter, and E-Commerce Conversion Optimization Expert.
Your goal is to take an existing Etsy listing and optimize its Title, Tags, and Description to maximize search ranking, click-through rate, and conversions.

### Current Seasonal Trend Context:
- Active Wave: ${currentSeason.seasonName || 'Standard Shopping Season'}
- Recommended Seasonal Keywords: ${(currentSeason.activeThemes || []).join(', ')}

### Available High-Opportunity Keyword Pool from Database:

${poolKeywordsList || 'vintage graphic shirt, retro aesthetic tee, trendy apparel, gift for him, gift for her'}

### Strict Rules:
1. **Title**:
   - MUST be between 120 and 140 characters.
   - Front-load the most powerful, high-intent niche phrase in the first 40 characters (e.g. "Vintage Japanese Samurai Cat Shirt, Retro Graphic Tee...").
   - Use clean separators like "|" or ",".
   - Do NOT repeat the same word more than twice.
2. **Tags**:
   - Generate EXACTLY 13 golden tags.
   - Every single tag MUST be 20 characters or fewer.
   - Prioritize multi-word long-tail phrases (e.g. "vintage cat shirt", "retro anime tee").
   - NO trademarks (no Disney, Nike, Marvel, Taylor Swift, etc.).
3. **Description**:
   - Engaging opening hook in first 160 chars.
   - Key Features bullet points (Fabric, Fit, Quality).
   - Sizing and Fit Guide summary.
   - Care Instructions (Wash inside out, cool wash, do not iron on print).
   - Production & Shipping timeline note.
   - Helpful Gift Idea notes.

### Expected Output:
Return ONLY valid JSON (no markdown backticks, no wrapping text):
{
  "title": "Optimized 120-140 chars Etsy Title",
  "tags": ["tag 1", "tag 2", "tag 3", "tag 4", "tag 5", "tag 6", "tag 7", "tag 8", "tag 9", "tag 10", "tag 11", "tag 12", "tag 13"],
  "description": "Full structured markdown/plain text formatted Etsy description.",
  "rationale": "Short 2-3 sentence summary of why this SEO strategy will boost ranking."
}`;

      const userContent = `Listing Details to Optimize:
- Current Title: "${item.title || 'Untitled'}"
- Current Tags: [${currentTags.join(', ')}]
- Product Price: $${item.price} ${item.currency_code}
- Product Type / Niche: ${vision.productType || 'Apparel & POD'}
- Vision AI Primary Subject: "${vision.primarySubject || 'Graphic Art'}"
- Vision AI Aesthetic Style: "${vision.primaryAesthetic || 'Modern Aesthetic'}"
- Vision Detected Colors: [${(vision.detectedColors || []).join(', ')}]
- Vision Visual Description: "${vision.description || ''}"
${instructions ? `- Extra User Instructions: "${instructions}"` : ''}

Generate the optimal SEO Title, 13 Golden Tags (<= 20 chars each), and high-converting Description in strict JSON format.`;

      try {
        let rawAiContent = '';

        if (activeAiProvider === 'gemini') {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: seoModel });
          const result = await model.generateContent([
            systemPrompt,
            userContent
          ]);
          const resp = await result.response;
          rawAiContent = resp.text();
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
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
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

      } catch (err: any) {
        console.error(`Optimization error on listing ${listingIdStr}:`, err);
        errors.push(`İlan #${listingIdStr}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      optimizedCount: results.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('AI SEO Optimize API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
