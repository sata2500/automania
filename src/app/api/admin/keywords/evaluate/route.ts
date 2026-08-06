import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { ids, limit = 50 } = body;

    // We need the admin's API key and model to evaluate
    const settingsRows = await sql`
      SELECT openrouter_key, openrouter_model 
      FROM user_workspaces 
      WHERE openrouter_key IS NOT NULL 
        AND openrouter_key != ''
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (settingsRows.length === 0 || !settingsRows[0].openrouter_key) {
      return NextResponse.json({ success: false, error: 'Sistem API anahtarı (Admin) yapılandırılmamış.' }, { status: 500 });
    }

    const apiKey = settingsRows[0].openrouter_key;
    
    // Parse JSON models
    let writerModel = 'meta-llama/llama-3.2-11b-vision-instruct:free'; // fallback default
    try {
      if (settingsRows[0].openrouter_model && settingsRows[0].openrouter_model.startsWith('{')) {
        const parsed = JSON.parse(settingsRows[0].openrouter_model);
        if (parsed.vision) writerModel = parsed.vision; // Fallback to vision model by default
        if (parsed.reasoning) writerModel = parsed.reasoning;
      }
    } catch(e) {}

    let targetKeywords: { id: string, keyword: string }[] = [];

    // If specific IDs are provided, use them. Otherwise, find oldest evaluated keywords.
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const rows = await sql`
        SELECT id, keyword FROM keyword_pool WHERE id = ANY(${ids as any})
      `;
      targetKeywords = rows as { id: string, keyword: string }[];
    } else {
      // Find keywords that haven't been evaluated in the last 7 days (or never evaluated)
      const rows = await sql`
        SELECT id, keyword FROM keyword_pool 
        WHERE last_evaluated_at IS NULL 
           OR last_evaluated_at < NOW() - INTERVAL '7 days'
        ORDER BY last_evaluated_at ASC NULLS FIRST
        LIMIT ${limit}
      `;
      targetKeywords = rows as { id: string, keyword: string }[];
    }

    if (targetKeywords.length === 0) {
      return NextResponse.json({ success: true, message: 'Değerlendirilecek kelime bulunamadı.', evaluatedCount: 0 });
    }

    const keywordList = targetKeywords.map(k => k.keyword);

    // Prepare Prompt for Evaluation
    const evalPrompt = `Use web search (Google/Etsy/Pinterest) to find CURRENT, real-time search volume and competition data for the following keywords in the US market.
Score each keyword from 0 to 100 based on HIGH search volume and LOW competition. 
Return ONLY a valid JSON object mapping the exact keyword to its integer score. No markdown formatting.
Keywords: ${JSON.stringify(keywordList)}
Example Output:
{
  "vintage shirt": 85,
  "retro": 70
}`;

    let payload: any = {
      model: writerModel,
      messages: [
        { role: 'user', content: evalPrompt }
      ],
      plugins: [
        { id: "web", max_results: 5 }
      ]
    };

    let openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Automania POD Studio Admin',
      },
      body: JSON.stringify(payload)
    });

    let webSearchFailed = false;

    if (openRouterRes.status === 402) {
      webSearchFailed = true;
      // Fallback: Remove web plugin if account has insufficient credits
      delete payload.plugins;
      payload.messages[0].content = `Evaluate the following keywords for Etsy/Pinterest print-on-demand search volume and relevance in the US market.
Score each keyword from 0 to 100 based on HIGH search volume and LOW competition. 
Return ONLY a valid JSON object mapping the exact keyword to its integer score. No markdown formatting.
Keywords: ${JSON.stringify(keywordList)}
Example Output:
{
  "vintage shirt": 85,
  "retro": 70
}`;

      openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Automania POD Studio Admin',
        },
        body: JSON.stringify(payload)
      });
    }

    if (!openRouterRes.ok) {
      const err = await openRouterRes.text();
      throw new Error(`OpenRouter API hatası: ${openRouterRes.status} - ${err}`);
    }

    const aiData = await openRouterRes.json();
    let content = aiData.choices?.[0]?.message?.content || '{}';
    
    // Cleanup if model wrapped in markdown
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    let parsedScores: Record<string, number> = {};
    try {
      parsedScores = JSON.parse(content);
    } catch (e) {
      throw new Error('Yapay zeka geçerli bir JSON formatı döndürmedi.');
    }

    // Update the database with new scores
    let evaluatedCount = 0;
    for (const item of targetKeywords) {
      const score = parsedScores[item.keyword];
      if (score !== undefined) {
        await sql`
          UPDATE keyword_pool 
          SET etsy_score = ${score}, last_evaluated_at = CURRENT_TIMESTAMP
          WHERE id = ${item.id}
        `;
        evaluatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      evaluatedCount,
      totalRequested: targetKeywords.length,
      warning: webSearchFailed ? "Yeterli bakiye olmadığı için web araması devre dışı bırakıldı." : undefined
    });

  } catch (error: any) {
    console.error('Keywords Evaluate API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
