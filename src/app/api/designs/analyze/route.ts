import { NextResponse } from 'next/server';
import sql, { db, ensureKeywordPoolColumns } from '@/lib/db';
import { etsyTaxonomyCache } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_ANALYZE_DESIGN_PROMPT } from '@/lib/default-prompts';
import { scrapeEtsyKeywordData, ScrapingOptions } from '@/lib/etsy-scraper';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
      WHERE setting_key IN ('active_ai_provider', 'openrouter_api_key', 'openrouter_model_vision', 'gemini_api_key', 'gemini_model_vision', 'ai_prompt_analyze_design')
    `;
    
    let activeAiProvider = 'openrouter';
    let dbApiKey = null;
    let dbVisionModel = null;
    let geminiApiKey = null;
    let dbGeminiVisionModel = null;
    let customPrompt: string | null = null;
    
    for (const row of settingsRows) {
      if (row.setting_key === 'active_ai_provider') activeAiProvider = row.setting_value;
      if (row.setting_key === 'openrouter_api_key') dbApiKey = row.setting_value;
      if (row.setting_key === 'openrouter_model_vision') dbVisionModel = row.setting_value;
      if (row.setting_key === 'gemini_api_key') geminiApiKey = row.setting_value;
      if (row.setting_key === 'gemini_model_vision') dbGeminiVisionModel = row.setting_value;
      if (row.setting_key === 'ai_prompt_analyze_design') customPrompt = row.setting_value;
    }

    const apiKey = activeAiProvider === 'gemini' 
      ? (geminiApiKey || process.env.GEMINI_API_KEY)
      : (dbApiKey || process.env.OPENROUTER_API_KEY);

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Sistem API anahtarı (Admin) yapılandırılmamış.' }, { status: 500 });
    }

    const scrapingApiKey = rows.length > 0 ? rows[0].scraping_api_key : null;
    const scrapingProvider = rows.length > 0 && rows[0].scraping_provider ? rows[0].scraping_provider : 'scraperapi';
    const workerUrl = (rows.length > 0 ? rows[0].cloudflare_worker_url : null) || process.env.CLOUDFLARE_WORKER_URL;

    // Resolve Etsy API OAuth token
    let etsyAccessToken: string | undefined = undefined;
    let etsyApiKey = process.env.ETSY_API_KEY;
    let etsySharedSecret = process.env.ETSY_SHARED_SECRET;
    for (const row of settingsRows) {
      if (row.setting_key === 'etsy_keystring') etsyApiKey = row.setting_value;
      if (row.setting_key === 'etsy_shared_secret') etsySharedSecret = row.setting_value;
    }

    const effectiveUserId = userId || (rows.length > 0 ? (rows[0] as any).user_id : null);
    if (effectiveUserId) {
      try {
        const { getValidEtsyToken } = await import('@/lib/etsy-token-manager');
        const tokenRes = await getValidEtsyToken(effectiveUserId);
        if (tokenRes.success && tokenRes.access_token) {
          etsyAccessToken = tokenRes.access_token;
          etsyApiKey = tokenRes.api_key || etsyApiKey;
          etsySharedSecret = tokenRes.shared_secret || etsySharedSecret;
        }
      } catch (e: any) {
        console.warn('Could not resolve Etsy token for design analyze:', e.message);
      }
    }
    
    // Parse JSON models from workspace as fallback
    let visionModel = 'google/gemini-2.0-flash-001'; // reliable vision model default
    try {
      if (rows.length > 0 && rows[0].openrouter_model && rows[0].openrouter_model.startsWith('{')) {
        const parsed = JSON.parse(rows[0].openrouter_model);
        if (parsed.vision) {
          visionModel = parsed.vision;
        }
      }
    } catch(e) {}
    
    // Override with global setting if present
    if (activeAiProvider === 'gemini') {
      visionModel = dbGeminiVisionModel || 'gemini-1.5-flash';
    } else {
      if (dbVisionModel) {
        visionModel = dbVisionModel;
      }
    }

    // Fetch active categories from DB
    const activeCategories = await db.select().from(etsyTaxonomyCache).where(eq(etsyTaxonomyCache.isActive, true));
    let taxonomyHint = '';
    if (activeCategories.length > 0) {
      taxonomyHint = `Choose the most appropriate taxonomyId from this list ONLY:\n` + activeCategories.map(c => `- ID: ${c.id} (${c.name}, ${c.path})`).join('\n');
    } else {
      taxonomyHint = `Choose a taxonomyId like 482 for T-shirts, 2202 for Sweatshirts, etc.`;
    }

    // Prepare OpenRouter Prompt for Vision Analysis
    let prompt = DEFAULT_ANALYZE_DESIGN_PROMPT;

    if (customPrompt && customPrompt.trim().length > 10) {
      prompt = customPrompt;
    }

    // Replace dynamic placeholders
    prompt = prompt.replace('{{taxonomyHint}}', taxonomyHint);

    // Resolve Image data for AI (supports base64, relative /public files, and remote URLs)
    let mimeType = 'image/png';
    let base64Data = '';
    let aiImageUrl = src;

    const base64Match = src.match(/^data:([^;]+);base64,(.+)$/);
    if (base64Match) {
      mimeType = base64Match[1];
      base64Data = base64Match[2];
      aiImageUrl = src;
    } else if (src.startsWith('/')) {
      // Local relative path (e.g. /sample-uploads/... or /api/uploads/...)
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const cleanPath = src.split('?')[0];
        const filePath = path.join(process.cwd(), 'public', cleanPath);
        const buffer = await fs.readFile(filePath);
        const ext = path.extname(cleanPath).toLowerCase();
        mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
        base64Data = buffer.toString('base64');
        aiImageUrl = `data:${mimeType};base64,${base64Data}`;
      } catch (err) {
        console.warn('Local image read fallback:', err);
      }
    } else if (src.startsWith('http://') || src.startsWith('https://')) {
      try {
        const imgRes = await fetch(src);
        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          mimeType = imgRes.headers.get('content-type') || 'image/png';
          base64Data = buffer.toString('base64');
          aiImageUrl = `data:${mimeType};base64,${base64Data}`;
        }
      } catch (err) {
        console.warn('Remote image fetch error:', err);
      }
    }

    if (!base64Data && src.length > 100 && !src.startsWith('http')) {
      base64Data = src.replace(/^data:image\/\w+;base64,/, '');
      aiImageUrl = `data:image/png;base64,${base64Data}`;
    }

    let content = '';

    if (activeAiProvider === 'gemini') {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: visionModel });
      
      const inlineData = {
        mimeType,
        data: base64Data
      };
      
      const result = await model.generateContent([
        prompt,
        { inlineData }
      ]);
      const response = await result.response;
      content = response.text();
    } else {
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
                { type: 'image_url', image_url: { url: aiImageUrl } }
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
      content = aiData.choices?.[0]?.message?.content || '{}';
    }
    
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
    
    // 1. Check existing keywords in database keyword pool
    let existingRows: any[] = [];
    const existingMap = new Map<string, any>();
    if (uniqueKeywords.length > 0) {
      existingRows = await sql`
        SELECT * FROM keyword_pool WHERE keyword = ANY(${uniqueKeywords as any})
      `;
      for (const r of existingRows) {
        existingMap.set(r.keyword.toLowerCase(), r);
      }
    }

    // 2. Immediately ensure all uniqueKeywords are saved in keyword_pool
    for (const kw of uniqueKeywords) {
      const existing = existingMap.get(kw);
      const id = existing?.id || crypto.randomUUID();
      const charLen = kw.length;
      const tagOk = charLen <= 20;

      await sql`
        INSERT INTO keyword_pool (
          id, keyword, usage_count, etsy_score, opportunity_score, total_listings,
          competition_level, bestseller_count, is_etsy_suggested, autocomplete_rank,
          char_length, tag_eligible, avg_price, last_scrape_error, raw_metrics,
          last_evaluated_at, created_at
        )
        VALUES (
          ${id}, ${kw}, 1, 0, 0, 0,
          'Taranacak', 0, false, 0,
          ${charLen}, ${tagOk}, '0.00', null, '{}'::jsonb,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (keyword) DO UPDATE
        SET usage_count = keyword_pool.usage_count + 1
      `;
    }

    const scrapeOptions: ScrapingOptions = {
      etsyAccessToken,
      etsyApiKey,
      etsySharedSecret,
      apiKey: scrapingApiKey,
      provider: scrapingProvider,
      workerUrl
    };

    // 3. Trigger deep Etsy keyword metric evaluation in background (non-blocking)
    (async () => {
      try {
        const discoveredTopTagsMap = new Map<string, number>();

        for (const kw of uniqueKeywords) {
          const existing = existingMap.get(kw);
          const isFresh = existing && existing.last_evaluated_at && (Date.now() - new Date(existing.last_evaluated_at).getTime() < 7 * 24 * 60 * 60 * 1000) && existing.competition_level !== 'Engellendi / Hata' && existing.competition_level !== 'Taranacak';

          if (isFresh) {
            const rm = typeof existing.raw_metrics === 'string' ? JSON.parse(existing.raw_metrics) : (existing.raw_metrics || {});
            if (Array.isArray(rm.topTags)) {
              for (const t of rm.topTags) {
                const cleanT = String(t).toLowerCase().trim();
                if (cleanT && cleanT !== kw && cleanT.length <= 20 && !uniqueKeywords.includes(cleanT)) {
                  discoveredTopTagsMap.set(cleanT, (discoveredTopTagsMap.get(cleanT) || 0) + 1);
                }
              }
            }
          } else {
            try {
              const scraped = await scrapeEtsyKeywordData(kw, scrapeOptions);
              const charLen = kw.length;
              const tagOk = charLen <= 20;

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
                  raw_metrics = ${JSON.stringify(scraped.rawMetrics)}::jsonb,
                  last_evaluated_at = CURRENT_TIMESTAMP
                WHERE keyword = ${kw}
              `;

              if (scraped.rawMetrics?.topTags && Array.isArray(scraped.rawMetrics.topTags)) {
                for (const topTag of scraped.rawMetrics.topTags) {
                  const cleanTag = String(topTag).toLowerCase().trim();
                  if (cleanTag && cleanTag !== kw && cleanTag.length <= 20 && !uniqueKeywords.includes(cleanTag)) {
                    discoveredTopTagsMap.set(cleanTag, (discoveredTopTagsMap.get(cleanTag) || 0) + 1);
                  }
                }
              }

              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (scrapeErr: any) {
              console.warn(`Evaluation error for primary keyword "${kw}":`, scrapeErr.message);
            }
          }
        }

        // Top Co-Occurring tags
        const topDiscoveredTags = Array.from(discoveredTopTagsMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([tag]) => tag);

        if (topDiscoveredTags.length > 0) {
          const existingCoRows = await sql`
            SELECT * FROM keyword_pool WHERE keyword = ANY(${topDiscoveredTags as any})
          `;
          const existingCoMap = new Map(existingCoRows.map(r => [r.keyword.toLowerCase(), r]));

          for (const coTag of topDiscoveredTags) {
            const existingCo = existingCoMap.get(coTag);
            const isCoFresh = existingCo && existingCo.last_evaluated_at && (Date.now() - new Date(existingCo.last_evaluated_at).getTime() < 7 * 24 * 60 * 60 * 1000) && existingCo.competition_level !== 'Engellendi / Hata' && existingCo.competition_level !== 'Taranacak';

            if (isCoFresh) {
              await sql`
                UPDATE keyword_pool
                SET usage_count = COALESCE(usage_count, 0) + 1
                WHERE keyword = ${coTag}
              `;
            } else {
              try {
                const coScraped = await scrapeEtsyKeywordData(coTag, scrapeOptions);
                const coId = existingCo?.id || crypto.randomUUID();
                const coCharLen = coTag.length;

                await sql`
                  INSERT INTO keyword_pool (
                    id, keyword, usage_count, etsy_score, opportunity_score, total_listings,
                    competition_level, bestseller_count, is_etsy_suggested, autocomplete_rank,
                    char_length, tag_eligible, avg_price, last_scrape_error, raw_metrics,
                    last_evaluated_at, created_at
                  )
                  VALUES (
                    ${coId}, ${coTag}, ${existingCo ? (existingCo.usage_count || 1) + 1 : 1},
                    ${coScraped.opportunityScore}, ${coScraped.opportunityScore}, ${coScraped.totalListings},
                    ${coScraped.competitionLevel}, ${coScraped.bestsellerCount}, ${coScraped.isEtsySuggested},
                    ${coScraped.autocompleteRank}, ${coCharLen}, true, ${coScraped.avgPrice},
                    ${coScraped.scrapeError},
                    ${JSON.stringify({ ...coScraped.rawMetrics, source: 'competitor_co_occurring_tag' })}::jsonb,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                  )
                  ON CONFLICT (keyword) DO UPDATE
                  SET
                    usage_count = keyword_pool.usage_count + 1,
                    etsy_score = ${coScraped.opportunityScore},
                    opportunity_score = ${coScraped.opportunityScore},
                    total_listings = ${coScraped.totalListings},
                    competition_level = ${coScraped.competitionLevel},
                    bestseller_count = ${coScraped.bestsellerCount},
                    is_etsy_suggested = ${coScraped.isEtsySuggested},
                    autocomplete_rank = ${coScraped.autocompleteRank},
                    avg_price = ${coScraped.avgPrice},
                    last_scrape_error = ${coScraped.scrapeError},
                    raw_metrics = ${JSON.stringify({ ...coScraped.rawMetrics, source: 'competitor_co_occurring_tag' })}::jsonb,
                    last_evaluated_at = CURRENT_TIMESTAMP
                `;

                await new Promise(resolve => setTimeout(resolve, 200));
              } catch (coErr: any) {
                console.warn(`Evaluation error for co-occurring tag "${coTag}":`, coErr.message);
              }
            }
          }
        }
      } catch (bgErr: any) {
        console.warn('Background keyword scraping task error:', bgErr.message);
      }
    })();

    return NextResponse.json({
      success: true,
      analysis: {
        description,
        keywords: uniqueKeywords,
        analyzedAt: Date.now(),
        primarySubject: parsedResult.primarySubject || '',
        primaryAesthetic: parsedResult.primaryAesthetic || '',
        niche: parsedResult.primarySubject ? (parsedResult.primaryAesthetic ? `${parsedResult.primarySubject} (${parsedResult.primaryAesthetic})` : parsedResult.primarySubject) : (parsedResult.niche || ''),
        userNotes: parsedResult.userNotes || '',
        productType: parsedResult.productType || '',
        taxonomyId: parsedResult.taxonomyId || null
      }
    });

  } catch (error: any) {
    console.error('Design Analyze Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
