/**
 * Etsy SEO Üretim Servisi (2026 Standartları)
 * =============================================
 * Gemini / OpenRouter kullanarak 2026 Etsy SEO standartlarına uygun
 * listing içeriği üretir.
 *
 * 2026 Etsy SEO Kuralları:
 * - Başlık: Maks 140 karakter, en güçlü anahtar kelimeler başa
 * - Etiket: Tam olarak 13 adet, 1–20 karakter arası, çoğul kullan
 * - Açıklama: İlk 160 karakter kritik (arama snippet'ı)
 * - Yeni: Etsy "Semantic Match" — anlamsal eşleşme, exact match yetersiz
 */

import { generateText, AIProviderConfig } from './ai-provider';

// ─── Tipler ──────────────────────────────────────────────────────────────────

export interface EtsySeoInput {
  /** Ürün tipi (örn: "T-Shirt", "Mug") */
  productType: string;
  /** Birincil niş (örn: "Dog Lover Gifts", "Funny Quotes") */
  primaryNiche: string;
  /** Hedef kitle */
  targetAudience: string;
  /** Tasarım açıklaması (AI'nin ürettiği) */
  designDescription: string;
  /** Özel notlar */
  customNotes?: string;
  /** Etsy mağazasının ana dili */
  language?: 'en' | 'tr';
}

export interface EtsySeoOutput {
  /** Başlık (maks 140 karakter) */
  title: string;
  /** Açıklama (HTML yok, sade metin) */
  description: string;
  /** 13 adet etiket */
  tags: string[];
  /** Etsy taxonomy ID (varsa) */
  taxonomyId?: number;
  /** Üretilen anahtar kelimeler (dahili referans) */
  keywords: string[];
  /** SEO kalite skoru (0–100) */
  seoScore: number;
}

// ─── SEO Skoru ────────────────────────────────────────────────────────────────

function calculateSeoScore(output: Omit<EtsySeoOutput, 'seoScore'>): number {
  let score = 0;

  // Başlık kalitesi
  if (output.title.length >= 80 && output.title.length <= 140) score += 25;
  else if (output.title.length >= 50) score += 15;

  // Tag sayısı
  if (output.tags.length === 13) score += 25;
  else if (output.tags.length >= 10) score += 15;

  // Tag uzunlukları
  const validTags = output.tags.filter(t => t.length >= 2 && t.length <= 20);
  score += Math.round((validTags.length / 13) * 20);

  // Açıklama
  if (output.description.length >= 400) score += 20;
  else if (output.description.length >= 200) score += 10;

  // Anahtar kelime örtüşmesi
  const titleLower = output.title.toLowerCase();
  const matchingKeywords = output.keywords.filter(k =>
    titleLower.includes(k.toLowerCase())
  );
  score += Math.min(10, matchingKeywords.length * 2);

  return Math.min(100, score);
}

// ─── Ana Üretim Fonksiyonu ────────────────────────────────────────────────────

export async function generateEtsySeo(
  config: AIProviderConfig,
  input: EtsySeoInput
): Promise<EtsySeoOutput> {
  const systemInstruction = `You are an expert Etsy SEO specialist following 2026 best practices.
Key rules:
- Titles: Max 140 chars, most important keywords first, use commas to separate phrases
- Tags: Exactly 13 tags, 2-20 chars each, use phrases not single words, use plurals
- Description: First 160 chars are critical (shown in search snippets), natural language
- Use semantic variations (synonyms) not just exact repeats
- Target US/English market unless specified otherwise
- Respond in valid JSON only`;

  const prompt = `Generate Etsy listing SEO for this product:
Product Type: ${input.productType}
Design/Theme: ${input.designDescription}
Primary Niche: ${input.primaryNiche}
Target Audience: ${input.targetAudience}
${input.customNotes ? `Additional Notes: ${input.customNotes}` : ''}

Return ONLY valid JSON with this exact structure:
{
  "title": "string (max 140 chars, keywords first)",
  "description": "string (min 400 chars, first 160 chars critical)",
  "tags": ["tag1", "tag2", ..., "tag13"],
  "keywords": ["keyword1", "keyword2", ...],
  "taxonomyId": null
}`;

  const rawText = await generateText(config, {
    prompt,
    systemInstruction,
    maxOutputTokens: 1500,
    temperature: 0.6,
    jsonOutput: true,
  });

  let parsed: any;
  try {
    // JSON temizle (bazı modeller ```json ... ``` sarıyor)
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`SEO üretim hatası: Geçersiz JSON yanıtı.\nRaw: ${rawText.substring(0, 200)}`);
  }

  // Doğrulama ve temizleme
  const title = (parsed.title ?? '').substring(0, 140);
  const description = parsed.description ?? '';
  const tags: string[] = (parsed.tags ?? [])
    .slice(0, 13)
    .map((t: string) => t.substring(0, 20).toLowerCase());
  const keywords: string[] = parsed.keywords ?? [];

  // 13 tag'e tamamla (eksikse boş ekle)
  while (tags.length < 13) {
    const fallback = input.primaryNiche.toLowerCase().split(' ')[tags.length % 3];
    if (fallback && !tags.includes(fallback)) tags.push(fallback);
    else break;
  }

  const output: Omit<EtsySeoOutput, 'seoScore'> = {
    title,
    description,
    tags,
    keywords,
    taxonomyId: parsed.taxonomyId ?? undefined,
  };

  return {
    ...output,
    seoScore: calculateSeoScore(output),
  };
}

/**
 * Var olan bir SEO içeriğini yeniden optimize eder.
 */
export async function optimizeEtsySeo(
  config: AIProviderConfig,
  existing: Partial<EtsySeoOutput>,
  hints: Partial<EtsySeoInput>
): Promise<EtsySeoOutput> {
  const systemInstruction = `You are an Etsy SEO expert. Improve the given listing content following 2026 best practices. Respond in valid JSON only.`;

  const prompt = `Improve this Etsy listing for better search ranking:

Current Title: ${existing.title ?? 'N/A'}
Current Tags: ${existing.tags?.join(', ') ?? 'N/A'}
Current Description (first 300 chars): ${existing.description?.substring(0, 300) ?? 'N/A'}

Product Type: ${hints.productType ?? 'unknown'}
Target Audience: ${hints.targetAudience ?? 'general'}
Primary Niche: ${hints.primaryNiche ?? 'general'}

Apply 2026 Etsy SEO best practices:
- Stronger title (max 140 chars, high-volume keywords first)
- Exactly 13 relevant tags (2-20 chars, use phrases)
- More compelling description (first 160 chars are the search snippet)

Return ONLY valid JSON:
{
  "title": "...",
  "description": "...",
  "tags": ["...", "...", ...13 items],
  "keywords": ["..."],
  "taxonomyId": null
}`;

  return generateEtsySeo(config, {
    productType: hints.productType ?? 'Product',
    primaryNiche: hints.primaryNiche ?? existing.title ?? 'General',
    targetAudience: hints.targetAudience ?? 'General audience',
    designDescription: existing.description?.substring(0, 200) ?? '',
    customNotes: hints.customNotes,
  });
}
