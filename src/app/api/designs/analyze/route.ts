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
    const rows = await sql`
      SELECT openrouter_key, openrouter_model 
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
    
    // Parse JSON models
    let visionModel = 'meta-llama/llama-3.2-11b-vision-instruct:free'; // fallback default
    let writerModel = 'meta-llama/llama-3.2-11b-vision-instruct:free'; // fallback default
    try {
      if (rows[0].openrouter_model && rows[0].openrouter_model.startsWith('{')) {
        const parsed = JSON.parse(rows[0].openrouter_model);
        if (parsed.vision) {
          visionModel = parsed.vision;
          writerModel = parsed.vision; // Fallback to vision model by default
        }
        if (parsed.reasoning) writerModel = parsed.reasoning;
      }
    } catch(e) {}

    // Prepare OpenRouter Prompt for Vision Analysis
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
    
    // Check which ones are new
    let existingKeywords: string[] = [];
    if (uniqueKeywords.length > 0) {
      const existingRows = await sql`
        SELECT keyword FROM keyword_pool WHERE keyword = ANY(${uniqueKeywords as any})
      `;
      existingKeywords = existingRows.map(r => r.keyword);
    }

    const newKeywords = uniqueKeywords.filter(k => !existingKeywords.includes(k));

    let newScores: Record<string, number> = {};

    let webSearchFailed = false;

    if (newKeywords.length > 0) {
      // Evaluate new keywords using SEO Writer model
      const evalPrompt = `Use web search (Google/Etsy/Pinterest) to find CURRENT, real-time search volume and competition data for the following keywords in the US market.
Score each keyword from 0 to 100 based on HIGH search volume and LOW competition. 
Return ONLY a valid JSON object mapping the exact keyword to its integer score. No markdown.
Keywords: ${JSON.stringify(newKeywords)}
Example Output:
{
  "vintage shirt": 85,
  "retro": 70
}`;

      try {
        let payload: any = {
          model: writerModel,
          messages: [
            {
              role: 'user',
              content: evalPrompt
            }
          ],
          plugins: [
            { id: "web", max_results: 5 }
          ]
        };

        let evalRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'X-Title': 'Automania POD Studio',
          },
          body: JSON.stringify(payload)
        });

        if (evalRes.status === 402) {
          webSearchFailed = true;
          delete payload.plugins;
          payload.messages[0].content = `Evaluate the following keywords for Etsy/Pinterest print-on-demand search volume and relevance in the US market.
Score each keyword from 0 to 100 based on HIGH search volume and LOW competition. 
Return ONLY a valid JSON object mapping the exact keyword to its integer score. No markdown.
Keywords: ${JSON.stringify(newKeywords)}
Example Output:
{
  "vintage shirt": 85,
  "retro": 70
}`;
          evalRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'X-Title': 'Automania POD Studio',
            },
            body: JSON.stringify(payload)
          });
        }

        if (evalRes.ok) {
          const evalData = await evalRes.json();
          let evalContent = evalData.choices?.[0]?.message?.content || '{}';
          const evalJsonMatch = evalContent.match(/\{[\s\S]*\}/);
          if (evalJsonMatch) {
            newScores = JSON.parse(evalJsonMatch[0]);
          }
        }
      } catch (e) {
        console.warn('Failed to evaluate new keywords:', e);
      }
    }

    for (const kw of uniqueKeywords) {
      const id = crypto.randomUUID();
      const score = newScores[kw] !== undefined ? newScores[kw] : null;
      
      if (newKeywords.includes(kw)) {
        await sql`
          INSERT INTO keyword_pool (id, keyword, usage_count, etsy_score, last_evaluated_at, created_at)
          VALUES (${id}, ${kw}, 1, ${score}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (keyword) DO NOTHING
        `;
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
      },
      warning: webSearchFailed ? "Yeterli bakiye olmadığı için kelime puanlamasında web araması devre dışı bırakıldı." : undefined
    });

  } catch (error: any) {
    console.error('Design Analyze Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
