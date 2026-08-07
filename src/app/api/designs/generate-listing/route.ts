import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { designDescription, keywords } = body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ success: false, error: 'İçerik oluşturmak için en az bir kelime gereklidir.' }, { status: 400 });
    }

    // Query Workspace settings for SEO Copywriter AI Model
    const rows = await sql`
      SELECT openrouter_key, openrouter_model 
      FROM user_workspaces 
      WHERE openrouter_key IS NOT NULL AND openrouter_key != ''
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (rows.length === 0 || !rows[0].openrouter_key) {
      return NextResponse.json({ success: false, error: 'Sistem API anahtarı (Admin) yapılandırılmamış.' }, { status: 500 });
    }

    const apiKey = rows[0].openrouter_key;
    
    // Parse SEO Copywriter Model (defaults to llama-3.3-70b-instruct or text model if defined)
    let seoModel = 'meta-llama/llama-3.3-70b-instruct:free';
    try {
      if (rows[0].openrouter_model && rows[0].openrouter_model.startsWith('{')) {
        const parsed = JSON.parse(rows[0].openrouter_model);
        if (parsed.text || parsed.seo) {
          seoModel = parsed.text || parsed.seo;
        }
      }
    } catch(e) {}

    // Prepare prompt with design context and scored keyword metrics
    const prompt = `You are a World-Class Etsy SEO Copywriter and POD Listing Specialist for the US market.
We have a T-shirt / apparel design with the following details:

DESIGN CONCEPT:
${designDescription || 'Apparel design for US market.'}

ANALYZED KEYWORDS & METRICS (Keyword, Character Length, Opportunity Score 0-100, Total Listings, Autocomplete Rank):
${keywords.map((k: any) => `- "${k.keyword}" (Len: ${k.keyword?.length || 0}, Score: ${k.opportunity_score ?? k.etsy_score ?? 0}/100, Listings: ${k.total_listings || 0}, Autocomplete: ${k.is_etsy_suggested ? '#' + (k.autocomplete_rank || 1) : 'No'})`).join('\n')}

YOUR TASK:
1. SELECT THE TOP 13 ETSY TAGS: Select EXACTLY 13 tags from the analyzed keywords (or highly relevant variants). EVERY SINGLE TAG MUST BE AT MOST 20 CHARACTERS LONG (including spaces). Prioritize tags with highest opportunity scores, high demand, low competition, and strong niche relevance.
2. WRITE AN ETSY SEO TITLE: Max 140 characters. Include high-converting long-tail keywords separated cleanly by " | " or ", ". Make it appealing to US Etsy shoppers.
3. WRITE AN ETSY PRODUCT DESCRIPTION: A high-converting, professional description including product highlights, fabric/quality details, sizing recommendation, care instructions, and bullet points.

Return ONLY a valid JSON object in the following format with no markdown wrappers or extra commentary:
{
  "title": "Your 140-char SEO Title Here",
  "description": "Your detailed structured Etsy description here...",
  "selectedTags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13"],
  "suggestedBasePrice": 24.99
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

    // Enforce 20-character tag limit on AI tags
    parsedResult.selectedTags = parsedResult.selectedTags
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0 && t.length <= 20)
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
