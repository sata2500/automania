import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const { src, name } = await request.json();

    if (!src) {
      return NextResponse.json({ success: false, error: 'Görsel URL veya base64 gerekli.' }, { status: 400 });
    }

    // Admin kullanıcısının API anahtarını ve Vision modelini çekiyoruz
    const demoAdminId = 'user-demo-101';
    const googleAdminId = 'user-' + Buffer.from('salihtanriseven25@gmail.com').toString('base64').replace(/=/g, '').toLowerCase();
    
    const rows = await sql`
      SELECT openrouter_key, openrouter_model 
      FROM user_workspaces 
      WHERE user_id IN (${demoAdminId}, ${googleAdminId})
        AND openrouter_key IS NOT NULL 
        AND openrouter_key != ''
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (rows.length === 0 || !rows[0].openrouter_key) {
      return NextResponse.json({ success: false, error: 'Sistem API anahtarı (Admin) yapılandırılmamış.' }, { status: 500 });
    }

    const apiKey = rows[0].openrouter_key;
    
    // Parse JSON models to get vision
    let visionModel = 'meta-llama/llama-3.2-11b-vision-instruct:free'; // fallback default
    try {
      if (rows[0].openrouter_model && rows[0].openrouter_model.startsWith('{')) {
        const parsed = JSON.parse(rows[0].openrouter_model);
        if (parsed.vision) visionModel = parsed.vision;
      }
    } catch(e) {}

    // Prepare OpenRouter Prompt
    const prompt = `Analyze this T-shirt/apparel design specifically for the US market (Etsy/Pinterest). 
Provide a medium-length description covering the niche, style (e.g. vintage, distressed, typography, illustration), target audience, and its relevance/meaning for the US market. 
Also extract 10-15 highly relevant SEO keywords.

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
    const uniqueKeywords = (Array.from(new Set(keywords.map((k: string) => k.toLowerCase().trim()))) as string[]).filter(k => k.length > 0);
    
    for (const kw of uniqueKeywords) {
      const id = crypto.randomUUID();
      await sql`
        INSERT INTO keyword_pool (id, keyword, usage_count, created_at)
        VALUES (${id}, ${kw}, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (keyword) DO UPDATE SET
          usage_count = keyword_pool.usage_count + 1,
          last_evaluated_at = CURRENT_TIMESTAMP
      `;
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
