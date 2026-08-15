import { NextResponse } from 'next/server';
import sql, { db, ensureKeywordPoolColumns } from '@/lib/db';
import { etsyTaxonomyCache } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_ANALYZE_DESIGN_PROMPT } from '@/lib/default-prompts';
import { scrapeEtsyKeywordData, ScrapingOptions } from '@/lib/etsy-scraper';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { getSession } from '@/lib/auth-server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60; // Allow up to 60s for vision AI + synchronous Etsy keyword & competitor tag evaluation

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const { src, name } = await request.json();

    if (!src) {
      return NextResponse.json({ success: false, error: 'Görsel URL veya base64 gerekli.' }, { status: 400 });
    }

    // 1. Session ve Workspace Ayarlarını Çek
    const session = await getSession();

    const workspaceRows = await sql`
      SELECT user_id, etsy_shop_id, etsy_access_token, openrouter_model, scraping_api_key, scraping_provider, cloudflare_worker_url 
      FROM user_workspaces 
      ORDER BY (CASE WHEN etsy_access_token IS NOT NULL THEN 1 ELSE 2 END), updated_at DESC
      LIMIT 5
    `;

    // 2. Global Sistem Ayarlarını Çek (API Anahtarları, Vision Modelleri, Prompts, Etsy API Key)
    const settingsRows = await sql`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key IN (
        'active_ai_provider', 
        'openrouter_api_key', 
        'openrouter_model_vision', 
        'gemini_api_key', 
        'gemini_model_vision', 
        'ai_prompt_analyze_design',
        'etsy_keystring',
        'etsy_shared_secret',
        'scraping_api_key'
      )
    `;
    
    let activeAiProvider = 'openrouter';
    let dbApiKey = null;
    let dbVisionModel = null;
    let geminiApiKey = null;
    let dbGeminiVisionModel = null;
    let customPrompt: string | null = null;
    let etsyApiKey = process.env.ETSY_API_KEY;
    let etsySharedSecret = process.env.ETSY_SHARED_SECRET;
    let scrapingApiKey = workspaceRows[0]?.scraping_api_key || process.env.SCRAPER_API_KEY || '';
    let scrapingProvider = workspaceRows[0]?.scraping_provider || 'scraperapi';
    let workerUrl = (workspaceRows.length > 0 ? workspaceRows[0].cloudflare_worker_url : null) || process.env.CLOUDFLARE_WORKER_URL;
    
    for (const row of settingsRows) {
      if (row.setting_key === 'active_ai_provider') activeAiProvider = row.setting_value;
      if (row.setting_key === 'openrouter_api_key') dbApiKey = row.setting_value;
      if (row.setting_key === 'openrouter_model_vision') dbVisionModel = row.setting_value;
      if (row.setting_key === 'gemini_api_key') geminiApiKey = row.setting_value;
      if (row.setting_key === 'gemini_model_vision') dbGeminiVisionModel = row.setting_value;
      if (row.setting_key === 'ai_prompt_analyze_design') customPrompt = row.setting_value;
      if (row.setting_key === 'etsy_keystring' && row.setting_value) etsyApiKey = row.setting_value;
      if (row.setting_key === 'etsy_shared_secret' && row.setting_value) etsySharedSecret = row.setting_value;
      if (row.setting_key === 'scraping_api_key' && row.setting_value && !scrapingApiKey) scrapingApiKey = row.setting_value;
    }

    const apiKey = activeAiProvider === 'gemini' 
      ? (geminiApiKey || process.env.GEMINI_API_KEY)
      : (dbApiKey || process.env.OPENROUTER_API_KEY);

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Sistem Vision AI API anahtarı (Admin) yapılandırılmamış.' }, { status: 500 });
    }

    // 3. Etsy Resmi API OAuth Token Çözümleme (Kullanıcı Oturumu veya Workspace Önceliğiyle)
    let etsyAccessToken: string | undefined = undefined;
    const targetUserId = userId || session?.id || workspaceRows[0]?.user_id;

    if (targetUserId) {
      try {
        const tokenRes = await getValidEtsyToken(targetUserId);
        if (tokenRes.success && tokenRes.access_token) {
          etsyAccessToken = tokenRes.access_token;
          etsyApiKey = tokenRes.api_key || etsyApiKey;
          etsySharedSecret = tokenRes.shared_secret || etsySharedSecret;
        }
      } catch (e: any) {
        console.warn('Etsy token error for target user:', e.message);
      }
    }

    // Fallback: Diğer workspace kayıtlarında aktif token ara
    if (!etsyAccessToken && workspaceRows.length > 0) {
      for (const ws of workspaceRows) {
        if (ws.user_id && ws.user_id !== targetUserId) {
          try {
            const wsTokenRes = await getValidEtsyToken(ws.user_id);
            if (wsTokenRes.success && wsTokenRes.access_token) {
              etsyAccessToken = wsTokenRes.access_token;
              etsyApiKey = wsTokenRes.api_key || etsyApiKey;
              etsySharedSecret = wsTokenRes.shared_secret || etsySharedSecret;
              break;
            }
          } catch (err) {
            // sessizce devam et
          }
        }
      }
    }
    
    // Vision model belirleme
    let visionModel = 'google/gemini-2.0-flash-001';
    try {
      if (workspaceRows.length > 0 && workspaceRows[0].openrouter_model && workspaceRows[0].openrouter_model.startsWith('{')) {
        const parsed = JSON.parse(workspaceRows[0].openrouter_model);
        if (parsed.vision) {
          visionModel = parsed.vision;
        }
      }
    } catch(e) {}
    
    if (activeAiProvider === 'gemini') {
      visionModel = dbGeminiVisionModel || 'gemini-1.5-flash';
    } else {
      if (dbVisionModel) {
        visionModel = dbVisionModel;
      }
    }

    // Etsy Taxonomy aktif kategorilerini al
    const activeCategories = await db.select().from(etsyTaxonomyCache).where(eq(etsyTaxonomyCache.isActive, true));
    let taxonomyHint = '';
    if (activeCategories.length > 0) {
      taxonomyHint = `Choose the most appropriate taxonomyId from this list ONLY:\n` + activeCategories.map(c => `- ID: ${c.id} (${c.name}, ${c.path})`).join('\n');
    } else {
      taxonomyHint = `Choose a taxonomyId like 482 for T-shirts, 2202 for Sweatshirts, etc.`;
    }

    // AI Vision Analiz Prompt'unu Hazırla
    let prompt = DEFAULT_ANALYZE_DESIGN_PROMPT;
    if (customPrompt && customPrompt.trim().length > 10) {
      prompt = customPrompt;
    }
    prompt = prompt.replace('{{taxonomyHint}}', taxonomyHint);

    // Görseli Base64 veya URL olarak çözümle
    let mimeType = 'image/png';
    let base64Data = '';
    let aiImageUrl = src;

    const base64Match = src.match(/^data:([^;]+);base64,(.+)$/);
    if (base64Match) {
      mimeType = base64Match[1];
      base64Data = base64Match[2];
      aiImageUrl = src;
    } else if (src.startsWith('/')) {
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

    // 4. Vision AI Analizini Çalıştır
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
    
    // JSON Temizleme
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

    // 5. Anahtar Kelimeleri Temizle ve Etsy 20 Karakter Kuralına Göre Filtrele
    await ensureKeywordPoolColumns();
    const uniqueKeywords = (Array.from(new Set(
      keywords
        .map((k: string) => k.toLowerCase().trim())
        .filter((k: string) => k.length > 0 && k.length <= 20)
    )) as string[]);
    
    // 6. Kelime Havuzundaki Mevcut Kayıtları Çek
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

    const scrapeOptions: ScrapingOptions = {
      etsyAccessToken,
      etsyApiKey,
      etsySharedSecret,
      userId: targetUserId,
      apiKey: scrapingApiKey,
      provider: scrapingProvider,
      workerUrl
    };

    // 7. Senkron Etsy Kelime Puanlama & Havuz Kayıt Pipeline'ı (AWAIT - Tamamlanana Kadar Bekler)
    const discoveredTopTagsMap = new Map<string, number>();

    for (const kw of uniqueKeywords) {
      const existing = existingMap.get(kw);
      const isFresh = existing && 
                      existing.last_evaluated_at && 
                      (Date.now() - new Date(existing.last_evaluated_at).getTime() < 7 * 24 * 60 * 60 * 1000) && 
                      existing.competition_level !== 'Engellendi / Hata' && 
                      existing.competition_level !== 'Taranacak' &&
                      existing.competition_level !== 'Henüz Taranmadı';

      if (isFresh) {
        // Zaten taze ve puanlanmış kelime: Kullanım sayısını artır
        await sql`
          UPDATE keyword_pool 
          SET usage_count = COALESCE(usage_count, 0) + 1 
          WHERE keyword = ${kw}
        `;

        // Önbellekteki rakip etiketleri topla
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
        // Havuzda yok veya taranmamış/tarihi geçmiş: Etsy API ile tara ve puanla
        try {
          const scraped = await scrapeEtsyKeywordData(kw, scrapeOptions);
          const charLen = kw.length;
          const tagOk = charLen <= 20;
          const id = existing?.id || crypto.randomUUID();

          await sql`
            INSERT INTO keyword_pool (
              id, keyword, usage_count, etsy_score, opportunity_score, total_listings,
              competition_level, bestseller_count, is_etsy_suggested, autocomplete_rank,
              char_length, tag_eligible, avg_price, last_scrape_error, raw_metrics,
              last_evaluated_at, created_at
            )
            VALUES (
              ${id}, ${kw}, ${existing ? (existing.usage_count || 1) + 1 : 1},
              ${scraped.opportunityScore}, ${scraped.opportunityScore}, ${scraped.totalListings},
              ${scraped.competitionLevel}, ${scraped.bestsellerCount}, ${scraped.isEtsySuggested},
              ${scraped.autocompleteRank}, ${charLen}, ${tagOk}, ${scraped.avgPrice},
              ${scraped.scrapeError},
              ${JSON.stringify(scraped.rawMetrics)}::jsonb,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            ON CONFLICT (keyword) DO UPDATE
            SET 
              usage_count = keyword_pool.usage_count + 1,
              etsy_score = ${scraped.opportunityScore},
              opportunity_score = ${scraped.opportunityScore},
              total_listings = ${scraped.totalListings},
              competition_level = ${scraped.competitionLevel},
              bestseller_count = ${scraped.bestsellerCount},
              is_etsy_suggested = ${scraped.isEtsySuggested},
              autocomplete_rank = ${scraped.autocompleteRank},
              char_length = ${charLen},
              tag_eligible = ${tagOk},
              avg_price = ${scraped.avgPrice},
              last_scrape_error = ${scraped.scrapeError},
              raw_metrics = ${JSON.stringify(scraped.rawMetrics)}::jsonb,
              last_evaluated_at = CURRENT_TIMESTAMP
          `;

          // Rakip ilanlardan çıkarılan etiketleri topla
          if (scraped.rawMetrics?.topTags && Array.isArray(scraped.rawMetrics.topTags)) {
            for (const topTag of scraped.rawMetrics.topTags) {
              const cleanTag = String(topTag).toLowerCase().trim();
              if (cleanTag && cleanTag !== kw && cleanTag.length <= 20 && !uniqueKeywords.includes(cleanTag)) {
                discoveredTopTagsMap.set(cleanTag, (discoveredTopTagsMap.get(cleanTag) || 0) + 1);
              }
            }
          }

          // Rate limit dostu 100ms bekleme
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (scrapeErr: any) {
          console.warn(`Evaluation error for primary keyword "${kw}":`, scrapeErr.message);
        }
      }
    }

    // 8. Birlikte Kullanılan Rakip Alt Kelimeleri (Co-Occurring Competitor Tags) Puanla ve Havuza Kaydet
    const topDiscoveredTags = Array.from(discoveredTopTagsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);

    if (topDiscoveredTags.length > 0) {
      const existingCoRows = await sql`
        SELECT * FROM keyword_pool WHERE keyword = ANY(${topDiscoveredTags as any})
      `;
      const existingCoMap = new Map(existingCoRows.map(r => [r.keyword.toLowerCase(), r]));

      for (const coTag of topDiscoveredTags) {
        const existingCo = existingCoMap.get(coTag);
        const isCoFresh = existingCo && 
                          existingCo.last_evaluated_at && 
                          (Date.now() - new Date(existingCo.last_evaluated_at).getTime() < 7 * 24 * 60 * 60 * 1000) && 
                          existingCo.competition_level !== 'Engellendi / Hata' && 
                          existingCo.competition_level !== 'Taranacak' &&
                          existingCo.competition_level !== 'Henüz Taranmadı';

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
            const coTagOk = coCharLen <= 20;

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
                ${coScraped.autocompleteRank}, ${coCharLen}, ${coTagOk}, ${coScraped.avgPrice},
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
                char_length = ${coCharLen},
                tag_eligible = ${coTagOk},
                avg_price = ${coScraped.avgPrice},
                last_scrape_error = ${coScraped.scrapeError},
                raw_metrics = ${JSON.stringify({ ...coScraped.rawMetrics, source: 'competitor_co_occurring_tag' })}::jsonb,
                last_evaluated_at = CURRENT_TIMESTAMP
            `;

            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (coErr: any) {
            console.warn(`Evaluation error for co-occurring tag "${coTag}":`, coErr.message);
          }
        }
      }
    }

    // 9. Güncellenen ve Puanlanan Tüm Kelimeleri Çekerek Yanıta Ekle
    const allTrackedKeywords = [...uniqueKeywords, ...topDiscoveredTags];
    let evaluatedKeywords: any[] = [];
    if (allTrackedKeywords.length > 0) {
      evaluatedKeywords = await sql`
        SELECT 
          id, 
          keyword, 
          etsy_score, 
          opportunity_score, 
          total_listings, 
          competition_level, 
          bestseller_count, 
          is_etsy_suggested, 
          autocomplete_rank, 
          avg_price, 
          char_length, 
          tag_eligible, 
          raw_metrics,
          last_scrape_error
        FROM keyword_pool
        WHERE keyword = ANY(${allTrackedKeywords as any})
      `;
    }

    return NextResponse.json({
      success: true,
      hasEtsyApi: !!etsyAccessToken,
      analysis: {
        description,
        keywords: uniqueKeywords,
        evaluatedKeywords,
        discoveredCompetitorTags: topDiscoveredTags,
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
