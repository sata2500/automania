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
      SELECT openrouter_key, openrouter_model, scraping_api_key, scraping_provider 
      FROM user_workspaces 
      WHERE openrouter_key IS NOT NULL 
        AND openrouter_key != ''
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (rows.length === 0 || !rows[0].openrouter_key) {
      return NextResponse.json({ success: false, error: 'Sistem API anahtarı (Admin) yapılandırılmamış.' }, { status: 500 });
    }

    const apiKey = rows[0].openrouter_key;
    const scrapingApiKey = rows[0].scraping_api_key;
    const scrapingProvider = rows[0].scraping_provider || 'scraperapi';
    
    // Parse JSON models
    let visionModel = 'meta-llama/llama-3.2-11b-vision-instruct:free'; // fallback default
    try {
      if (rows[0].openrouter_model && rows[0].openrouter_model.startsWith('{')) {
        const parsed = JSON.parse(rows[0].openrouter_model);
        if (parsed.vision) {
          visionModel = parsed.vision;
        }
      }
    } catch(e) {}

    // Prepare OpenRouter Prompt for Vision Analysis
    const prompt = `Analyze this T-shirt/apparel design specifically for the US market (Etsy/Pinterest). 
Provide a medium-length description covering the niche, style (e.g. vintage, distressed, typography, illustration), target audience, and its relevance/meaning for the US market. 

CRITICAL RULE FOR KEYWORDS: Extract 10-15 highly relevant Etsy SEO keywords/tags. EVERY SINGLE KEYWORD MUST BE AT MOST 20 CHARACTERS LONG (including spaces) so it strictly complies with Etsy's tag character limit.

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

    // Process Keywords into the Keyword Pool
    await ensureKeywordPoolColumns();
    const uniqueKeywords = (Array.from(new Set(keywords.map((k: string) => k.toLowerCase().trim()))) as string[]).filter(k => k.length > 0);
    
    // Check which ones are new
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

        // Trigger scraping in background (non-blocking)
        scrapeEtsyKeywordData(kw, { apiKey: scrapingApiKey, provider: scrapingProvider })
          .then(async (scraped) => {
            await sql`
              UPDATE keyword_pool 
              SET 
                etsy_score = ${scraped.opportunityScore},
                opportunity_score = ${scraped.opportunityScore},
                total_listings = ${scraped.totalListings},
                competition_level = ${scraped.competitionLevel},
                bestseller_count = ${scraped.bestsellerCount},
                is_etsy_suggested = ${scraped.isEtsySuggested},
                autocomplete_rank = ${scraped.autocompleteRank},
                avg_price = ${scraped.avgPrice},
                last_scrape_error = ${scraped.scrapeError},
                raw_metrics = ${JSON.stringify(scraped.rawMetrics)},
                last_evaluated_at = CURRENT_TIMESTAMP
              WHERE id = ${id}
            `;
          })
          .catch((err) => console.warn(`Background scrape error for "${kw}":`, err.message));
      } else {
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
