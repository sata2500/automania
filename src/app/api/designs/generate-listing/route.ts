import { NextResponse } from 'next/server';
import sql, { db } from '@/lib/db';
import { DEFAULT_GENERATE_LISTING_PROMPT } from '@/lib/default-prompts';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { designDescription, keywords, productType, userNotes, primarySubject, primaryAesthetic, shopSections, taxonomyId, taxonomyProperties } = body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ success: false, error: 'İçerik oluşturmak için en az bir kelime gereklidir.' }, { status: 400 });
    }

    // Query Workspace settings for SEO Copywriter AI Model
    const rows = await sql`
      SELECT openrouter_model 
      FROM user_workspaces 
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    // Get API Key and Models from app_settings or env
    const settingsRows = await sql`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key IN ('active_ai_provider', 'openrouter_api_key', 'openrouter_model_reasoning', 'gemini_api_key', 'gemini_model_reasoning', 'ai_prompt_generate_listing')
    `;
    
    let activeAiProvider = 'openrouter';
    let dbApiKey = null;
    let dbReasoningModel = null;
    let geminiApiKey = null;
    let dbGeminiReasoningModel = null;
    let customPrompt: string | null = null;
    
    for (const row of settingsRows) {
      if (row.setting_key === 'active_ai_provider') activeAiProvider = row.setting_value;
      if (row.setting_key === 'openrouter_api_key') dbApiKey = row.setting_value;
      if (row.setting_key === 'openrouter_model_reasoning') dbReasoningModel = row.setting_value;
      if (row.setting_key === 'gemini_api_key') geminiApiKey = row.setting_value;
      if (row.setting_key === 'gemini_model_reasoning') dbGeminiReasoningModel = row.setting_value;
      if (row.setting_key === 'ai_prompt_generate_listing') customPrompt = row.setting_value;
    }

    const apiKey = activeAiProvider === 'gemini' 
      ? (geminiApiKey || process.env.GEMINI_API_KEY)
      : (dbApiKey || process.env.OPENROUTER_API_KEY);

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Sistem API anahtarı (Admin) yapılandırılmamış.' }, { status: 500 });
    }
    
    // Parse SEO Copywriter Model fallback
    let seoModel = 'google/gemma-4-26b-a4b-it:free';
    try {
      if (rows.length > 0 && rows[0].openrouter_model) {
        const raw = rows[0].openrouter_model.trim();
        if (raw.startsWith('{')) {
          const parsed = JSON.parse(raw);
          seoModel = parsed.reasoning || parsed.text || parsed.seo || parsed.vision || seoModel;
        } else if (raw.length > 0) {
          seoModel = raw;
        }
      }
    } catch(e) {}

    // Override with global setting if present
    if (activeAiProvider === 'gemini') {
      seoModel = dbGeminiReasoningModel || 'gemini-1.5-pro';
    } else {
      if (dbReasoningModel) {
        seoModel = dbReasoningModel;
      }
    }

    // Prepare prompt with strict Visual Validation Layer and Anti-Contamination rules
    let prompt = DEFAULT_GENERATE_LISTING_PROMPT;

    if (customPrompt && customPrompt.trim().length > 10) {
      prompt = customPrompt;
    }

    // Extract input keyword strings
    const inputKeywords: string[] = keywords
      .map((k: any) => (typeof k === 'string' ? k.trim() : (k?.keyword || '').trim()))
      .filter(Boolean);
    const uniqueInputKeywords = Array.from(new Set(inputKeywords.map(k => k.toLowerCase())));

    // Direct Database Keyword Pool Enrichment (Real Etsy Metrics & Co-Occurring Competitor Tags)
    let dbKeywordsMap = new Map<string, any>();
    let coOccurringTagsList: string[] = [];

    if (uniqueInputKeywords.length > 0) {
      try {
        const dbKeywords = await sql`
          SELECT keyword, opportunity_score, etsy_score, total_listings, bestseller_count, 
                 autocomplete_rank, tag_eligible, avg_price, raw_metrics
          FROM keyword_pool
          WHERE LOWER(keyword) = ANY(${uniqueInputKeywords as any})
        `;

        for (const row of dbKeywords) {
          dbKeywordsMap.set(row.keyword.toLowerCase(), row);

          // Extract competitor co-occurring tags from raw_metrics.topTags
          const rm = typeof row.raw_metrics === 'string' ? JSON.parse(row.raw_metrics) : (row.raw_metrics || {});
          if (Array.isArray(rm.topTags)) {
            for (const tag of rm.topTags) {
              const cleanTag = String(tag).trim().toLowerCase();
              if (cleanTag && cleanTag.length <= 20 && !uniqueInputKeywords.includes(cleanTag)) {
                coOccurringTagsList.push(cleanTag);
              }
            }
          }
        }
      } catch (dbErr) {
        console.warn('Error fetching keyword metrics from DB in generate-listing:', dbErr);
      }
    }

    // Rank competitor co-occurring tags by frequency of occurrence across listings
    const tagFrequency: Record<string, number> = {};
    coOccurringTagsList.forEach(t => {
      tagFrequency[t] = (tagFrequency[t] || 0) + 1;
    });
    const rankedCoOccurringTags = Object.entries(tagFrequency)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)
      .slice(0, 15);

    // Query DB for evaluated metrics of competitor co-occurring sub-keywords
    let dbCoOccurringMap = new Map<string, any>();
    if (rankedCoOccurringTags.length > 0) {
      try {
        const dbCoRows = await sql`
          SELECT keyword, opportunity_score, etsy_score, total_listings, bestseller_count, 
                 autocomplete_rank, tag_eligible, avg_price
          FROM keyword_pool
          WHERE LOWER(keyword) = ANY(${rankedCoOccurringTags as any})
        `;
        for (const row of dbCoRows) {
          dbCoOccurringMap.set(row.keyword.toLowerCase(), row);
        }
      } catch (e) {
        console.warn('Error fetching co-occurring metrics from DB:', e);
      }
    }

    const enrichedCoOccurring = rankedCoOccurringTags.map(tagStr => {
      const dbData = dbCoOccurringMap.get(tagStr);
      const score = dbData?.opportunity_score ?? dbData?.etsy_score ?? 80;
      const listings = dbData?.total_listings ?? 0;
      const bestsellers = dbData?.bestseller_count ?? 0;
      const autoRank = dbData?.autocomplete_rank ?? 0;
      const tagOk = tagStr.length <= 20;

      return {
        keyword: tagStr,
        opportunity_score: score,
        total_listings: listings,
        bestseller_count: bestsellers,
        autocomplete_rank: autoRank,
        tag_eligible: tagOk
      };
    }).sort((a, b) => b.opportunity_score - a.opportunity_score);

    // Build enriched candidate keywords list sorted by Opportunity Score
    const enrichedKeywords = uniqueInputKeywords.map(kStr => {
      const dbData = dbKeywordsMap.get(kStr);
      const score = dbData?.opportunity_score ?? dbData?.etsy_score ?? 75;
      const listings = dbData?.total_listings ?? 0;
      const bestsellers = dbData?.bestseller_count ?? 0;
      const autoRank = dbData?.autocomplete_rank ?? 0;
      const tagOk = kStr.length <= 20;

      return {
        keyword: kStr,
        opportunity_score: score,
        total_listings: listings,
        bestseller_count: bestsellers,
        autocomplete_rank: autoRank,
        tag_eligible: tagOk
      };
    }).sort((a, b) => b.opportunity_score - a.opportunity_score);

    const formattedKeywords = enrichedKeywords.map(k => {
      let details = `Score: ${k.opportunity_score}/100`;
      if (k.total_listings > 0) details += `, Listings: ${k.total_listings.toLocaleString('en-US')}`;
      if (k.bestseller_count > 0) details += `, Bestsellers: ${k.bestseller_count}`;
      if (k.autocomplete_rank > 0) details += `, Autocomplete: #${k.autocomplete_rank}`;
      details += `, Tag Fit: ${k.tag_eligible ? 'YES (<=20 char)' : 'NO (>20 char)'}`;
      return `- "${k.keyword}" (${details})`;
    }).join('\n');

    const formattedCoOccurring = enrichedCoOccurring.length > 0
      ? enrichedCoOccurring.map(t => {
          let details = `Score: ${t.opportunity_score}/100`;
          if (t.total_listings > 0) details += `, Listings: ${t.total_listings.toLocaleString('en-US')}`;
          if (t.bestseller_count > 0) details += `, Bestsellers: ${t.bestseller_count}`;
          if (t.autocomplete_rank > 0) details += `, Autocomplete: #${t.autocomplete_rank}`;
          details += `, Tag Fit: ${t.tag_eligible ? 'YES (<=20 char)' : 'NO (>20 char)'}`;
          return `- "${t.keyword}" (${details}, Proven Competitor Tag)`;
        }).join('\n')
      : 'None detected yet in pool.';

    // Prepare dynamic values for placeholders
    const dynamicValues = {
      designDescription: designDescription || 'Apparel design for US market.',
      primarySubject: primarySubject || 'Extracted from design concept',
      primaryAesthetic: primaryAesthetic || 'Extracted from design concept',
      productType: productType || 'Comfort Colors 1717, Bella Canvas 3001, Youth Unisex Tee',
      userNotes: userNotes || 'Soft ring-spun cotton, retail fit, size up for oversized aesthetic look.',
      keywords: formattedKeywords || 'None provided',
      coOccurringTags: formattedCoOccurring,
      taxonomyId: String(taxonomyId || 482),
      shopSections: shopSections && Array.isArray(shopSections) ? shopSections.map((s: any) => `- ID: ${s.shop_section_id}, Title: "${s.title}"`).join('\n   ') : 'None',
      taxonomyProperties: taxonomyProperties && Array.isArray(taxonomyProperties) ? taxonomyProperties.map((p: any) => 
        `- Property "${p.name}" (ID: ${p.property_id}): \n     Values: ${p.possible_values.map((v: any) => `${v.name} (ID: ${v.value_id})`).join(', ')}`
      ).join('\n   ') : 'None'
    };

    // Replace all placeholders
    prompt = prompt
      .replace(/\{\{designDescription\}\}/g, dynamicValues.designDescription)
      .replace(/\{\{primarySubject\}\}/g, dynamicValues.primarySubject)
      .replace(/\{\{primaryAesthetic\}\}/g, dynamicValues.primaryAesthetic)
      .replace(/\{\{productType\}\}/g, dynamicValues.productType)
      .replace(/\{\{userNotes\}\}/g, dynamicValues.userNotes)
      .replace(/\{\{keywords\}\}/g, dynamicValues.keywords)
      .replace(/\{\{coOccurringTags\}\}/g, dynamicValues.coOccurringTags)
      .replace(/\{\{taxonomyId\}\}/g, dynamicValues.taxonomyId)
      .replace(/\{\{shopSections\}\}/g, dynamicValues.shopSections)
      .replace(/\{\{taxonomyProperties\}\}/g, dynamicValues.taxonomyProperties);

    let content = '';

    if (activeAiProvider === 'gemini') {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: seoModel });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      content = response.text();
    } else {
      const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Automania POD Studio Listing Generator',
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
        throw new Error(`OpenRouter SEO API Hatası: ${openRouterRes.status} - ${err}`);
      }

      const aiData = await openRouterRes.json();
      content = aiData.choices?.[0]?.message?.content || '{}';
    }

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

    if (!parsedResult.title || !parsedResult.description || !parsedResult.selectedTags || !Array.isArray(parsedResult.selectedTags)) {
      throw new Error('Yapay zeka eksik veri döndürdü.');
    }

    // Post-Processing Anti-Contamination Filter (Hard Code Safety Net)
    const detectedSubj = (parsedResult.detectedSubject || primarySubject || '').toLowerCase();
    const forbiddenTerms = ['dog', 'cat', 'horse', 'nurse', 'teacher', 'halloween', 'christmas']
      .filter(term => !detectedSubj.includes(term) && !(designDescription || '').toLowerCase().includes(term));

    parsedResult.selectedTags = parsedResult.selectedTags
      .map((t: string) => t.trim())
      .filter((t: string) => {
        if (t.length === 0 || t.length > 20) return false;
        const lower = t.toLowerCase();
        return !forbiddenTerms.some(term => lower.includes(term));
      })
      .slice(0, 13);

    return NextResponse.json({
      success: true,
      listing: parsedResult,
      keywordsEnriched: enrichedKeywords,
      coOccurringTags: enrichedCoOccurring,
      modelUsed: seoModel
    });

  } catch (error: any) {
    console.error('Generate Listing API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
