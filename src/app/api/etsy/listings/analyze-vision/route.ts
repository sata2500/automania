import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { consumeRateLimit } from '@/lib/request-rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { evaluateEtsyListingSeo } from '@/lib/etsy-seo-evaluator';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { isR2Configured, getR2Client, getBucketName, extractKeyFromUrlOrKey } from '@/lib/r2';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export const maxDuration = 60;

async function resolveImageBuffer(src: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const base64Match = src.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (base64Match) {
    const rawMime = base64Match[1].split(';')[0].trim().toLowerCase();
    const cleanBase64 = base64Match[2].replace(/\s+/g, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    return { buffer, mimeType: rawMime || 'image/jpeg' };
  }

  if (src.startsWith('/api/r2/') || src.startsWith('api/r2/')) {
    const key = extractKeyFromUrlOrKey(src);
    if (isR2Configured() && key) {
      try {
        const client = getR2Client();
        const bucket = getBucketName();
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (res.Body) {
          const bytes = await res.Body.transformToByteArray();
          const ext = path.extname(key).toLowerCase();
          const mimeType = (res.ContentType || (ext === '.png' ? 'image/png' : 'image/jpeg')).split(';')[0].trim();
          return { buffer: Buffer.from(bytes), mimeType };
        }
      } catch (r2Err) {
        console.warn('[Vision API] Direct R2 get failed:', r2Err);
      }
    }
    const localFallbackPath = path.join(process.cwd(), '.data', 'uploads', path.basename(key));
    if (fsSync.existsSync(localFallbackPath)) {
      const buffer = await fs.readFile(localFallbackPath);
      const ext = path.extname(key).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      return { buffer, mimeType };
    }
  }

  if (src.startsWith('/api/uploads/')) {
    const filename = path.basename(src);
    const filePath = path.join(process.cwd(), '.data', 'uploads', filename);
    if (fsSync.existsSync(filePath)) {
      const buffer = await fs.readFile(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      return { buffer, mimeType };
    }
  }

  if (src.startsWith('/')) {
    const cleanPath = src.split('?')[0];
    const filename = path.basename(cleanPath);
    const dataUploadsPath = path.join(process.cwd(), '.data', 'uploads', filename);
    if (fsSync.existsSync(dataUploadsPath)) {
      const buffer = await fs.readFile(dataUploadsPath);
      const ext = path.extname(filename).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      return { buffer, mimeType };
    }

    const publicPath = path.join(process.cwd(), 'public', cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath);
    if (fsSync.existsSync(publicPath)) {
      const buffer = await fs.readFile(publicPath);
      const ext = path.extname(cleanPath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      return { buffer, mimeType };
    }
  }

  if (src.startsWith('http://') || src.startsWith('https://')) {
    if (isR2Configured()) {
      try {
        const key = extractKeyFromUrlOrKey(src);
        if (key) {
          const client = getR2Client();
          const bucket = getBucketName();
          const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
          if (res.Body) {
            const bytes = await res.Body.transformToByteArray();
            const ext = path.extname(key).toLowerCase();
            const mimeType = (res.ContentType || (ext === '.png' ? 'image/png' : 'image/jpeg')).split(';')[0].trim();
            return { buffer: Buffer.from(bytes), mimeType };
          }
        }
      } catch {}
    }

    try {
      const imgRes = await fetch(src);
      if (imgRes.ok) {
        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const rawMime = imgRes.headers.get('content-type') || 'image/jpeg';
        const mimeType = rawMime.split(';')[0].trim().toLowerCase();
        return { buffer, mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg' };
      }
    } catch (err) {
      console.warn('[Vision API] Remote image fetch error:', err);
    }
  }

  return null;
}

const VISION_PROMPT = `You are a professional Etsy E-Commerce Visual Merchandising and Image Analysis AI.
Carefully inspect this product listing cover image and extract key design attributes in STRICT JSON format:

{
  "primarySubject": "Concise main subject (e.g., 'Retro 80s Cyberpunk Samurai Cat', 'Vintage Minimalist Wildflower Bouquet')",
  "primaryAesthetic": "Aesthetic style (e.g., 'Vintage Distressed Retro', 'Minimalist Cottagecore Boho', 'Y2K Cyberpunk Grunge')",
  "detectedStyle": "Visual technique (e.g., 'Distressed Vector Illustration', 'Watercolour Painting', 'Typography & Line Art')",
  "detectedColors": ["Dominant color 1", "Dominant color 2", "Dominant color 3"],
  "productType": "Specific POD product garment (e.g., 'Comfort Colors 1717 Heavyweight T-Shirt', 'Gildan 18000 Crewneck Sweatshirt', 'Ceramic Coffee Mug')",
  "description": "2-3 sentences visually detailing the artwork, focal elements, typography, and mood.",
  "keywords": ["5-8 high intent visual search tags (max 20 chars each)"]
}

Return ONLY valid JSON matching this schema. No markdown backticks, no explanations.`;

export async function POST(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const rateLimit = consumeRateLimit(`ai:etsy-vision:${session.id}`, 10, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Etsy Vision AI analiz limiti aşıldı.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const body = await req.json();
    const { listingId, listingIds } = body;

    const targetIds: string[] = [];
    if (listingId) targetIds.push(String(listingId));
    if (Array.isArray(listingIds)) {
      for (const id of listingIds) {
        if (id && !targetIds.includes(String(id))) targetIds.push(String(id));
      }
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Analiz edilecek listing ID belirtilmedi.' }, { status: 400 });
    }
    if (targetIds.length > 10) {
      return NextResponse.json({ success: false, error: 'Tek istekte en fazla 10 listing analiz edilebilir.' }, { status: 400 });
    }

    // 1. Fetch AI Model Settings from app_settings
    const settingsRows = await sql`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key IN (
        'active_ai_provider', 
        'openrouter_api_key', 
        'openrouter_model_vision', 
        'gemini_api_key', 
        'gemini_model_vision'
      )
    `;

    let activeAiProvider = 'openrouter';
    let dbApiKey = null;
    let dbVisionModel = null;
    let geminiApiKey = null;
    let dbGeminiVisionModel = null;

    for (const row of settingsRows) {
      if (row.setting_key === 'active_ai_provider') activeAiProvider = row.setting_value;
      if (row.setting_key === 'openrouter_api_key') dbApiKey = row.setting_value;
      if (row.setting_key === 'openrouter_model_vision') dbVisionModel = row.setting_value;
      if (row.setting_key === 'gemini_api_key') geminiApiKey = row.setting_value;
      if (row.setting_key === 'gemini_model_vision') dbGeminiVisionModel = row.setting_value;
    }

    const apiKey = activeAiProvider === 'gemini'
      ? (geminiApiKey || process.env.GEMINI_API_KEY)
      : (dbApiKey || process.env.OPENROUTER_API_KEY);

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Admin panelinde Vision AI anahtarı yapılandırılmamış.' }, { status: 500 });
    }

    let visionModel = activeAiProvider === 'gemini' 
      ? (dbGeminiVisionModel || 'gemini-1.5-flash')
      : (dbVisionModel || 'google/gemini-2.0-flash-001');

    // 2. Fetch target listings from DB
    const listings = await sql`
      SELECT * FROM user_etsy_listings 
      WHERE user_id = ${session.id} AND listing_id = ANY(${targetIds as any})
    `;

    if (listings.length === 0) {
      return NextResponse.json({ success: false, error: 'Belirtilen ilanlar veritabanında bulunamadı.' }, { status: 404 });
    }

    // 3. Load keyword pool rows for SEO score re-calculation
    const keywordPoolRows = await sql`
      SELECT keyword, opportunity_score, etsy_score, total_listings, bestseller_count, is_etsy_suggested 
      FROM keyword_pool
      WHERE opportunity_score > 0 OR etsy_score > 0
    `;

    const results: any[] = [];
    const errors: string[] = [];

    for (const listing of listings) {
      const listingIdStr = String(listing.listing_id);
      let imageUrl = listing.primary_image_url;

      if (!imageUrl && Array.isArray(listing.images) && listing.images.length > 0) {
        imageUrl = listing.images[0]?.url_570xN || listing.images[0]?.url_fullxfull || listing.images[0]?.url_170x135;
      }

      if (!imageUrl) {
        errors.push(`İlan #${listingIdStr}: Kapak görseli URL'si bulunamadı.`);
        continue;
      }

      try {
        const resolvedImage = await resolveImageBuffer(imageUrl);
        if (!resolvedImage || !resolvedImage.buffer || resolvedImage.buffer.length < 50) {
          throw new Error(`Görsel dosyası depolama alanından okunamadı.`);
        }

        const { buffer, mimeType } = resolvedImage;
        const base64Data = buffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        let rawAiContent = '';

        if (activeAiProvider === 'gemini') {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: visionModel });
          let geminiMimeType = mimeType.toLowerCase();
          if (!['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'].includes(geminiMimeType)) {
            geminiMimeType = 'image/jpeg';
          }

          const result = await model.generateContent([
            VISION_PROMPT,
            {
              inlineData: {
                mimeType: geminiMimeType,
                data: base64Data
              }
            }
          ]);
          const resp = await result.response;
          rawAiContent = resp.text();
        } else {
          const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'X-Title': 'Automania Listing Vision Analyzer',
            },
            body: JSON.stringify({
              model: visionModel,
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: VISION_PROMPT },
                    { type: 'image_url', image_url: { url: dataUrl } }
                  ]
                }
              ]
            })
          });

          if (!openRouterRes.ok) {
            const err = await openRouterRes.text();
            throw new Error(`OpenRouter Hatası: ${openRouterRes.status} - ${err}`);
          }

          const aiData = await openRouterRes.json();
          rawAiContent = aiData.choices?.[0]?.message?.content || '{}';
        }

        // Clean JSON
        const jsonMatch = rawAiContent.match(/\{[\s\S]*\}/);
        const cleanedJson = jsonMatch ? jsonMatch[0] : rawAiContent;
        const parsedAnalysis = JSON.parse(cleanedJson);

        const visionData = {
          primarySubject: parsedAnalysis.primarySubject || '',
          primaryAesthetic: parsedAnalysis.primaryAesthetic || '',
          detectedStyle: parsedAnalysis.detectedStyle || '',
          detectedColors: Array.isArray(parsedAnalysis.detectedColors) ? parsedAnalysis.detectedColors : [],
          productType: parsedAnalysis.productType || '',
          description: parsedAnalysis.description || '',
          keywords: Array.isArray(parsedAnalysis.keywords) ? parsedAnalysis.keywords : [],
          visionModel,
          analyzedAt: new Date().toISOString()
        };

        // Re-evaluate SEO score with updated vision data
        const tags = Array.isArray(listing.tags) ? listing.tags : (typeof listing.tags === 'string' ? JSON.parse(listing.tags) : []);
        const newEvaluation = evaluateEtsyListingSeo({
          title: listing.title,
          description: listing.description,
          tags,
          visionAnalysis: visionData,
          keywordPoolRows
        });

        // Update DB
        await sql`
          UPDATE user_etsy_listings 
          SET 
            vision_analysis = ${JSON.stringify(visionData)}::jsonb,
            seo_score = ${newEvaluation.score},
            seo_evaluation = ${JSON.stringify(newEvaluation)}::jsonb,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ${session.id} AND listing_id = ${listingIdStr}
        `;

        results.push({
          listingId: listingIdStr,
          visionAnalysis: visionData,
          seoScore: newEvaluation.score,
          seoEvaluation: newEvaluation
        });

        // Short pause between images to prevent provider rate limiting
        if (listings.length > 1) {
          await new Promise(r => setTimeout(r, 200));
        }

      } catch (err: any) {
        console.error(`Vision analysis error on listing ${listingIdStr}:`, err);
        errors.push(`İlan #${listingIdStr}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      analyzedCount: results.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Vision Analyze API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
