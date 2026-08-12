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

    // Prepare dynamic values for placeholders
    const dynamicValues = {
      designDescription: designDescription || 'Apparel design for US market.',
      primarySubject: primarySubject || 'Extracted from design concept',
      primaryAesthetic: primaryAesthetic || 'Extracted from design concept',
      productType: productType || 'Comfort Colors 1717, Bella Canvas 3001, Youth Unisex Tee',
      userNotes: userNotes || 'Soft ring-spun cotton, retail fit, size up for oversized aesthetic look.',
      keywords: keywords.map((k: any) => `- "${k.keyword}" (Len: ${k.keyword?.length || 0}, Score: ${k.opportunity_score ?? k.etsy_score ?? 0}/100)`).join('\n'),
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
      modelUsed: seoModel
    });

  } catch (error: any) {
    console.error('Generate Listing API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
