import { NextResponse } from 'next/server';
import sql, { ensureKeywordPoolColumns } from '@/lib/db';
import { scrapeEtsyKeywordData } from '@/lib/etsy-scraper';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const { src, name } = await request.json();

    if (!src) {
      return NextResponse.json({ success: false, error: 'Görsel URL veya base64 gerekli.' }, { status: 400 });
    }

    // Admin kullanıcısının API anahtarını, Vision modelini ve Scraping ayarlarını çekiyoruz
    const rows = await sql`
      SELECT openrouter_model, scraping_api_key, scraping_provider, cloudflare_worker_url 
      FROM user_workspaces 
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    // Get API Key and Models from app_settings or env
    const settingsRows = await sql`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key IN ('openrouter_api_key', 'openrouter_model_vision')
    `;
    
    let dbApiKey = null;
    let dbVisionModel = null;
    
    settingsRows.forEach(row => {
      if (row.setting_key === 'openrouter_api_key') dbApiKey = row.setting_value;
      if (row.setting_key === 'openrouter_model_vision') dbVisionModel = row.setting_value;
    });

    const apiKey = dbApiKey || process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Sistem API anahtarı (Admin) yapılandırılmamış.' }, { status: 500 });
    }

    const scrapingApiKey = rows.length > 0 ? rows[0].scraping_api_key : null;
    const scrapingProvider = rows.length > 0 && rows[0].scraping_provider ? rows[0].scraping_provider : 'scraperapi';
    const workerUrl = (rows.length > 0 ? rows[0].cloudflare_worker_url : null) || process.env.CLOUDFLARE_WORKER_URL;
    
    // Parse JSON models from workspace as fallback
    let visionModel = 'google/gemma-4-26b-a4b-it:free'; // fallback default
    try {
      if (rows.length > 0 && rows[0].openrouter_model && rows[0].openrouter_model.startsWith('{')) {
        const parsed = JSON.parse(rows[0].openrouter_model);
        if (parsed.vision) {
          visionModel = parsed.vision;
        }
      }
    } catch(e) {}
    
    // Override with global setting if present
    if (dbVisionModel) {
      visionModel = dbVisionModel;
    }

    // Prepare OpenRouter Prompt for Vision Analysis
    const prompt = `Analyze this T-shirt/apparel design for the US market (Etsy/Pinterest). 
Provide a medium-length description covering the niche, style (e.g. vintage, distressed), target audience, and its relevance. 

CRITICAL RULES FOR KEYWORDS (Etsy SEO):
1. READ THE TEXT: Your keywords MUST strongly reflect the actual text/typography written on the design.
2. PRIORITIZE THE MAIN THEME: Focus on the primary message over background details. Do not generate overly broad tags (like "van life" or "camping") unless they are the central focus of the text/design.
3. BALANCED TAGS: Extract 20-25 highly relevant keywords. Mix exact-match phrases from the design with highly relevant niche/aesthetic tags.
4. LENGTH LIMIT: EVERY SINGLE KEYWORD MUST BE AT MOST 20 CHARACTERS LONG (including spaces) to strictly comply with Etsy's tag limit.

Return ONLY a valid JSON object in the following format, with no markdown formatting or extra text:
{
  "description": "Your detailed description here...",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;

    const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Automania POD Studio',
      },
      body: JSON.stringify({
        model: visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: src } }
            ]
          }
        ]
      })
    });

    if (!openRouterRes.ok) {
      const err = await openRouterRes.text();
      throw new Error(`OpenRouter API hatası: ${openRouterRes.status} - ${err}`);
    }

    const aiData = await openRouterRes.json();
    let content = aiData.choices?.[0]?.message?.content || '{}';
    
    // Cleanup if model wrapped in markdown or returned extra text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(content);
    } catch (e) {
      throw new Error('Yapay zeka geçerli bir JSON formatı döndürmedi.');
    }

    if (!parsedResult.description || !parsedResult.keywords || !Array.isArray(parsedResult.keywords)) {
      throw new Error('Yapay zeka eksik veri döndürdü.');
    }

    const { description, keywords } = parsedResult;

    // Process Keywords into the Keyword Pool with 20-char tag eligibility check
    await ensureKeywordPoolColumns();
    const uniqueKeywords = (Array.from(new Set(
      keywords
        .map((k: string) => k.toLowerCase().trim())
        .filter((k: string) => k.length > 0 && k.length <= 20)
    )) as string[]);
    
    // Check which ones already exist in database keyword pool
    let existingKeywords: string[] = [];
    if (uniqueKeywords.length > 0) {
      const existingRows = await sql`
        SELECT keyword FROM keyword_pool WHERE keyword = ANY(${uniqueKeywords as any})
      `;
      existingKeywords = existingRows.map(r => r.keyword);
    }

    const newKeywords = uniqueKeywords.filter(k => !existingKeywords.includes(k));

    // Instant insertion & async scraping so UI never hangs or times out on Vercel
    for (const kw of uniqueKeywords) {
      if (newKeywords.includes(kw)) {
        const id = crypto.randomUUID();
        const charLen = kw.length;
        const tagOk = charLen <= 20;

        // Perform fast initial insert
        await sql`
          INSERT INTO keyword_pool (
            id, keyword, usage_count, etsy_score, opportunity_score, total_listings, 
            competition_level, bestseller_count, is_etsy_suggested, autocomplete_rank, 
            char_length, tag_eligible, avg_price, last_scrape_error, raw_metrics, 
            created_at
          )
          VALUES (
            ${id}, ${kw}, 1, 0, 0, 0,
            'Taranacak', 0, false, 0,
            ${charLen}, ${tagOk}, 0, null, '{}'::jsonb,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (keyword) DO NOTHING
        `;

        // Trigger background scraping via Cloudflare Worker Proxy with workerUrl
        scrapeEtsyKeywordData(kw, { apiKey: scrapingApiKey, provider: scrapingProvider, workerUrl })
          .then(async (scraped) => {
            // Auto-retry once if scrapeError occurred during burst
            let finalScraped = scraped;
            if (finalScraped.scrapeError) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              finalScraped = await scrapeEtsyKeywordData(kw, { apiKey: scrapingApiKey, provider: scrapingProvider, workerUrl });
            }

            await sql`
              UPDATE keyword_pool 
              SET 
                etsy_score = ${finalScraped.opportunityScore},
                opportunity_score = ${finalScraped.opportunityScore},
                total_listings = ${finalScraped.totalListings},
                competition_level = ${finalScraped.competitionLevel},
                bestseller_count = ${finalScraped.bestsellerCount},
                is_etsy_suggested = ${finalScraped.isEtsySuggested},
                autocomplete_rank = ${finalScraped.autocompleteRank},
                avg_price = ${finalScraped.avgPrice},
                last_scrape_error = ${finalScraped.scrapeError},
                raw_metrics = ${JSON.stringify(finalScraped.rawMetrics)},
                last_evaluated_at = CURRENT_TIMESTAMP
              WHERE id = ${id}
            `;
          })
          .catch((err) => console.warn(`Background scrape error for "${kw}":`, err.message));
      } else {
        // Keyword exists: increment usage count
        await sql`
          UPDATE keyword_pool
          SET usage_count = usage_count + 1
          WHERE keyword = ${kw}
        `;
      }
    }

    return NextResponse.json({
      success: true,
      analysis: {
        description,
        keywords: uniqueKeywords,
        analyzedAt: Date.now()
      }
    });

  } catch (error: any) {
    console.error('Design Analyze Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
