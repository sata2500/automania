import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { designDescription, keywords, productType, userNotes, primarySubject, primaryAesthetic } = body;

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
      WHERE setting_key IN ('openrouter_api_key', 'openrouter_model_reasoning')
    `;
    
    let dbApiKey = null;
    let dbReasoningModel = null;
    
    settingsRows.forEach(row => {
      if (row.setting_key === 'openrouter_api_key') dbApiKey = row.setting_value;
      if (row.setting_key === 'openrouter_model_reasoning') dbReasoningModel = row.setting_value;
    });

    const apiKey = dbApiKey || process.env.OPENROUTER_API_KEY;

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
    if (dbReasoningModel) {
      seoModel = dbReasoningModel;
    }

    // Prepare prompt with strict Visual Validation Layer and Anti-Contamination rules
    const prompt = `You are an Elite Etsy SEO Specialist and POD Listing Copywriter for the US market.
We have an apparel design with the following details:

DESIGN CONCEPT / DESCRIPTION:
${designDescription || 'Apparel design for US market.'}

PRIMARY SUBJECT / THEME DETECTED:
${primarySubject || 'Extracted from design concept'}

PRIMARY AESTHETIC / STYLE DETECTED:
${primaryAesthetic || 'Extracted from design concept'}

APPAREL BRANDS / GARMENT TYPES IN LISTING:
${productType || 'Comfort Colors 1717, Bella Canvas 3001, Youth Unisex Tee'}

USER CUSTOM NOTES:
${userNotes || 'Soft ring-spun cotton, retail fit, size up for oversized aesthetic look.'}

CANDIDATE KEYWORDS & METRICS:
${keywords.map((k: any) => `- "${k.keyword}" (Len: ${k.keyword?.length || 0}, Score: ${k.opportunity_score ?? k.etsy_score ?? 0}/100)`).join('\n')}

CRITICAL VISUAL VALIDATION & ANTI-CONTAMINATION RULES:
1. STRICT SUBJECT FILTERING: Only include keywords directly relevant to the actual design subject (${primarySubject || 'design subject'}) and aesthetic (${primaryAesthetic || 'aesthetic'}). ABSOLUTELY FORBID and ELIMINATE any unrelated subjects, animals, or themes (for example, if the subject is Rabbit, NEVER use 'dog', 'cat', 'horse', 'nurse', 'teacher', etc.).
2. 13 TAG DISTRIBUTION: Select EXACTLY 13 tags. EVERY SINGLE TAG MUST BE AT MOST 20 CHARACTERS LONG (including spaces). Distribute tags across:
   - Subject + Product (e.g., cottagecore rabbit, bunny lover gift)
   - Quote / Message (e.g., grow through quote, inspirational tee)
   - Aesthetic / Style (e.g., wildflower shirt, botanical shirt)
   - Buyer Intent / Gifting (e.g., self care gift, nature lover gift)
   - Micro-Niche & Mindset (e.g., growth mindset, cottagecore shirt)
3. ETSY SEO TITLE: Max 140 characters. Structure: Primary Message -> Subject/Animal -> Aesthetic -> Botanical -> Buyer Intent. Example: "Grow Through What You Go Through Shirt, Cottagecore Rabbit Tee, Wildflower Botanical Shirt, Inspirational Gift".
4. ETSY DESCRIPTION: Balanced, high-converting description. Broaden buyer intent beyond just mental health to include nature lovers, rabbit lovers, cottagecore fans, self-care gifts, and everyday botanical apparel. Include PRODUCT HIGHLIGHTS, GARMENT OPTIONS, SIZING, CARE, SHIPPING.

Return ONLY a valid JSON object in the following format:
{
  "title": "Your 140-char SEO Title Here",
  "description": "Your structured Etsy description here...",
  "selectedTags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13"],
  "suggestedBasePrice": 24.99,
  "detectedSubject": "rabbit",
  "detectedAesthetic": "cottagecore botanical"
}`;

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
    let content = aiData.choices?.[0]?.message?.content || '{}';

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
