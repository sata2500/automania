import sql from '@/lib/db';
import { KEYWORD_MAX_SCORE_AGE_DAYS } from '@/lib/keyword-pool';
import { fillPrompt } from '@/lib/prompt-registry';
import { ModelNotConfiguredError } from '@/lib/ai-models';
import { loadPrompt } from '@/lib/prompt-settings';
import { AiTextConfigError, generateReasoningJson } from '@/lib/ai-text';
import { filterSafeKeywords, sanitizeTrademarkText, sanitizeEtsyTags } from '@/lib/trademark-shield';
import { getCurrentSeasonInfo, applySeasonalBonus } from '@/lib/seasonality';
import { containsWord, filterContaminatedTerms } from '@/lib/listing-subject';

/**
 * Etsy ilan metni (başlık, açıklama, etiketler) üretimi: otomasyon, Üretim'den gelen ilanlar ve Etsy'deki
 * ilanların iyileştirmesi bu servisi kullanır (bkz. listing-pipeline: değerlendirme ve düzeltme turu). Anahtar
 * kelime zenginleştirme (gerçek Etsy puanları), sezon bağlamı, marka (trademark) temizliği ve konu kirliliği
 * filtresi tek yerde uygulanır.
 */

export class ListingGenerationError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = 'ListingGenerationError';
  }
}

export type GenerateListingInput = {
  designDescription?: string;
  keywords: Array<string | { keyword?: string }>;
  productType?: string;
  userNotes?: string;
  primarySubject?: string;
  primaryAesthetic?: string;
  shopSections?: unknown;
  taxonomyId?: number | string;
  taxonomyProperties?: unknown;
  /** Otomasyonun kitlesi (ör. "men's apparel") */
  audienceGroup?: string;
  /** Alıcının seçebileceği ürün modelleri (ör. "Comfort Colors 1717; Bella+Canvas 3001") */
  garments?: string;
  /** İlan fotoğraflarının sıralı tanımları (alt metin yazılması için) */
  images?: string[];
  /** Ayarlar › İlan metni bilgileri (bkz. listing-copy); açıklamadaki ürün bilgilerinin tek kaynağı */
  storeFacts?: string;
  /** Etsy'deki bir ilan iyileştirilirken şu anki metin */
  currentListing?: { title: string; tags: string[]; description: string } | null;
  /** Değerlendirme sonrası düzeltilecek noktalar (ikinci tur) */
  revisionFeedback?: string[];
  /** Tasarım görseli: model metni gördüğü tasarıma göre yazar */
  designImage?: { buffer: Buffer; mimeType: string } | null;
  /** Yazarken web araması (güncel trend ve alıcı ifadeleri; etiketler yine Etsy verisiyle puanlanır) */
  webSearch?: boolean;
};

/** Talimatın sonuna eklenen bağlam: görsel ekliyse ve web araması açıksa modele nasıl kullanacağı söylenir. */
export function listingExtrasNote({ hasImage, webSearch }: { hasImage: boolean; webSearch: boolean }): string {
  const lines = [
    hasImage && '- The DESIGN IMAGE is attached. Describe what you actually see (subject, style, colors, text on the design); if the image and the analysis disagree, trust the image.',
    webSearch && '- You may use web search to check current US trends and how buyers phrase searches for this kind of design (Etsy, Pinterest, Google Trends). Prefer phrases from the KEYWORDS list with real Etsy scores; use a web-found phrase only if it clearly fits this design. Never use brand names, celebrities or copyrighted characters found on the web.',
    webSearch && '- Reply with the JSON object only (no commentary, no citations).',
  ].filter(Boolean);
  return lines.length > 0 ? `\n\nADDITIONAL CONTEXT:\n${lines.join('\n')}` : '';
}

/**
 * Havuzda gerçek Etsy verisi olmayan kelimeye puan uydurulmaz: puan `null` döner ve AI'ya
 * "veri yok" olarak iletilir. Sezon bonusu yalnızca gerçek bir taban puana eklenir.
 */
function scoreKeyword(keyword: string, row: KeywordMetricsRow | undefined) {
  const rawBase = row?.opportunity_score ?? row?.etsy_score ?? null;
  const hasData = rawBase !== null && rawBase !== undefined && Number(rawBase) > 0;
  const baseScore = hasData ? Number(rawBase) : null;
  const seasonal = baseScore !== null ? applySeasonalBonus(keyword, baseScore) : { finalScore: null, bonusApplied: 0, seasonReason: undefined };
  return {
    keyword,
    opportunity_score: seasonal.finalScore as number | null,
    base_score: baseScore,
    has_data: hasData,
    seasonal_bonus: seasonal.bonusApplied,
    seasonal_reason: seasonal.seasonReason,
    total_listings: row?.total_listings ?? 0,
    bestseller_count: row?.bestseller_count ?? 0,
    autocomplete_rank: row?.autocomplete_rank ?? 0,
    tag_eligible: keyword.length <= 20,
  };
}

/** Puanı olanlar önce (yüksekten düşüğe), verisi olmayanlar sonda. */
const byScore = (a: { opportunity_score: number | null }, b: { opportunity_score: number | null }) =>
  (b.opportunity_score ?? -1) - (a.opportunity_score ?? -1);

function describeKeyword(k: ReturnType<typeof scoreKeyword>, suffix = ''): string {
  let details = k.opportunity_score !== null ? `Score: ${k.opportunity_score}/100` : 'Score: no Etsy data yet (do not assume demand)';
  if (k.seasonal_bonus > 0) details += ` (Seasonal +${k.seasonal_bonus}: ${k.seasonal_reason})`;
  if (k.total_listings > 0) details += `, Listings: ${k.total_listings.toLocaleString('en-US')}`;
  if (k.bestseller_count > 0) details += `, Bestsellers: ${k.bestseller_count}`;
  if (k.autocomplete_rank > 0) details += `, Autocomplete: #${k.autocomplete_rank}`;
  details += `, Tag Fit: ${k.tag_eligible ? 'YES (<=20 char)' : 'NO (>20 char)'}`;
  return `- "${k.keyword}" (${details}${suffix})`;
}

type KeywordMetricsRow = {
  keyword: string;
  opportunity_score?: number | null;
  etsy_score?: number | null;
  total_listings?: number | null;
  bestseller_count?: number | null;
  autocomplete_rank?: number | null;
  tag_eligible?: boolean | null;
  avg_price?: string | number | null;
  raw_metrics?: unknown;
};
type ShopSection = { shop_section_id: number | string; title: string };

/** Modelin döndürdüğü ilan (bkz. "İlan metni üretimi" talimatının JSON biçimi). */
export type GeneratedListingJson = {
  title: string;
  description: string;
  selectedTags: string[];
  detectedSubject?: string;
  detectedAesthetic?: string;
  image_alt_texts?: unknown;
  shop_section_id?: unknown;
  taxonomy_properties_values?: unknown;
  materials?: unknown;
  styles?: unknown;
  [key: string]: unknown;
};
type TaxonomyProperty = {
  name: string;
  property_id: number;
  possible_values?: Array<{ name: string; value_id: number }>;
};

export async function generateListingContent(userId: string, input: GenerateListingInput) {
  const { designDescription, keywords, productType, userNotes, primarySubject, primaryAesthetic, shopSections, taxonomyId, taxonomyProperties, audienceGroup, garments, images, storeFacts, currentListing, revisionFeedback, designImage, webSearch = false } = input;
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new ListingGenerationError('İçerik oluşturmak için en az bir kelime gereklidir.', 400);
  }

  // Seasonality Context & Current Active Shopping Wave
  const currentSeason = getCurrentSeasonInfo();

  // Talimat admin panelindeki "İlan metni üretimi" prompt'udur (boşsa varsayılanı).
  const listingPrompt = await loadPrompt('ai_prompt_generate_listing');

  // Extract input keyword strings & apply Trademark Safety Shield
  const rawInputKeywords: string[] = keywords
    .map((k: string | { keyword?: string }) => (typeof k === 'string' ? k.trim() : (k?.keyword || '').trim()))
    .filter(Boolean);
  const { safe: safeInputKeywords, removed: trademarkRemovedKeywords } = filterSafeKeywords(rawInputKeywords);
  const uniqueInputKeywords = Array.from(new Set(safeInputKeywords.map(k => k.toLowerCase())));

  // Direct Database Keyword Pool Enrichment (Real Etsy Metrics & Co-Occurring Competitor Tags)
  const dbKeywordsMap = new Map<string, KeywordMetricsRow>();
  const coOccurringTagsList: string[] = [];

  if (uniqueInputKeywords.length > 0) {
    try {
      const dbKeywords = await sql`
        SELECT keyword, opportunity_score, etsy_score, total_listings, bestseller_count, 
               autocomplete_rank, tag_eligible, avg_price, raw_metrics
        FROM keyword_pool
        WHERE LOWER(keyword) = ANY(${uniqueInputKeywords})
          AND last_evaluated_at > NOW() - make_interval(days => ${KEYWORD_MAX_SCORE_AGE_DAYS}::int)
      `;

      for (const row of dbKeywords) {
        dbKeywordsMap.set(String(row.keyword).toLowerCase(), row as KeywordMetricsRow);

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

  // Filter co-occurring tags with Trademark Shield
  const { safe: safeCoOccurring } = filterSafeKeywords(coOccurringTagsList);

  // Rank competitor co-occurring tags by frequency of occurrence across listings
  const tagFrequency: Record<string, number> = {};
  safeCoOccurring.forEach(t => {
    tagFrequency[t] = (tagFrequency[t] || 0) + 1;
  });
  const rankedCoOccurringTags = Object.entries(tagFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .slice(0, 15);

  // Query DB for evaluated metrics of competitor co-occurring sub-keywords
  const dbCoOccurringMap = new Map<string, KeywordMetricsRow>();
  if (rankedCoOccurringTags.length > 0) {
    try {
      const dbCoRows = await sql`
        SELECT keyword, opportunity_score, etsy_score, total_listings, bestseller_count, 
               autocomplete_rank, tag_eligible, avg_price
        FROM keyword_pool
        WHERE LOWER(keyword) = ANY(${rankedCoOccurringTags})
          AND last_evaluated_at > NOW() - make_interval(days => ${KEYWORD_MAX_SCORE_AGE_DAYS}::int)
      `;
      for (const row of dbCoRows) {
        dbCoOccurringMap.set(String(row.keyword).toLowerCase(), row as KeywordMetricsRow);
      }
    } catch (e) {
      console.warn('Error fetching co-occurring metrics from DB:', e);
    }
  }

  const enrichedCoOccurring = rankedCoOccurringTags.map((tagStr) => scoreKeyword(tagStr, dbCoOccurringMap.get(tagStr))).sort(byScore);

  // Build enriched candidate keywords list sorted by Opportunity Score (with Seasonal Multiplier)
  const enrichedKeywords = uniqueInputKeywords.map((kStr) => scoreKeyword(kStr, dbKeywordsMap.get(kStr))).sort(byScore);

  const formattedKeywords = enrichedKeywords.map((k) => describeKeyword(k)).join('\n');

  const formattedCoOccurring = enrichedCoOccurring.length > 0
    ? enrichedCoOccurring.map((t) => describeKeyword(t, ', Proven Competitor Tag')).join('\n')
    : 'None detected yet in pool.';

  // Prepare dynamic values for placeholders
  const dynamicValues = {
    designDescription: designDescription || 'Apparel design for US market.',
    primarySubject: primarySubject || 'Extracted from design concept',
    primaryAesthetic: primaryAesthetic || 'Extracted from design concept',
    productType: productType || 'Not specified',
    userNotes: userNotes || 'None provided',
    keywords: formattedKeywords || 'None provided',
    coOccurringTags: formattedCoOccurring,
    taxonomyId: String(taxonomyId || 482),
    shopSections: shopSections && Array.isArray(shopSections) ? (shopSections as ShopSection[]).map((s) => `- ID: ${s.shop_section_id}, Title: "${s.title}"`).join('\n   ') : 'None',
    audienceGroup: typeof audienceGroup === 'string' && audienceGroup.trim() ? audienceGroup.trim() : 'not specified',
    garments: typeof garments === 'string' && garments.trim() ? garments.trim() : 'not specified',
    images: images && images.length > 0 ? images.map((label, i) => `- Photo ${i + 1}: ${label}`).join('\n   ') : 'None',
    storeFacts: storeFacts?.trim() || 'None provided',
    currentListing: currentListing
      ? `Title: ${currentListing.title}\nTags: ${currentListing.tags.join(', ')}\nDescription:\n${currentListing.description}`
      : 'None',
    revisionFeedback: revisionFeedback && revisionFeedback.length > 0 ? revisionFeedback.map((f) => `- ${f}`).join('\n') : 'None',
    taxonomyProperties: taxonomyProperties && Array.isArray(taxonomyProperties) ? (taxonomyProperties as TaxonomyProperty[]).map((p) => 
      `- Property "${p.name}" (ID: ${p.property_id}): \n     Values: ${(p.possible_values || []).map((v) => `${v.name} (ID: ${v.value_id})`).join(', ')}`
    ).join('\n   ') : 'None'
  };

  const prompt = fillPrompt(listingPrompt, dynamicValues) + listingExtrasNote({ hasImage: Boolean(designImage), webSearch });

  let generated: { data: unknown; model: string };
  try {
    generated = await generateReasoningJson(prompt, { label: 'listing generation', temperature: 0.7, image: designImage, webSearch });
  } catch (error) {
    if (error instanceof AiTextConfigError) throw new ListingGenerationError(error.message, 500);
    if (error instanceof ModelNotConfiguredError) throw new ListingGenerationError(error.message, 400);
    throw error;
  }
  const seoModel = generated.model;
  const parsedResult = (generated.data && typeof generated.data === 'object' ? generated.data : {}) as GeneratedListingJson;

  if (typeof parsedResult.title !== 'string' || typeof parsedResult.description !== 'string' || !Array.isArray(parsedResult.selectedTags)) {
    throw new Error('Yapay zeka eksik veri döndürdü.');
  }

  // 1. Post-Processing Trademark Sanitization (Zero IP Infringement Guarantee)
  const sanitizedTitleObj = sanitizeTrademarkText(parsedResult.title);
  parsedResult.title = sanitizedTitleObj.cleanText;

  // Ürün modelleri (ör. Comfort Colors 1717) satıcının kendi bilgisi: açıklamada adıyla kalır.
  const garmentNames = typeof garments === 'string' ? garments.split(';').map((g) => g.trim()).filter(Boolean) : [];
  const sanitizedDescObj = sanitizeTrademarkText(parsedResult.description, { allowedNames: garmentNames });
  parsedResult.description = sanitizedDescObj.cleanText;

  const { cleanTags, violationsFound } = sanitizeEtsyTags(parsedResult.selectedTags);

  // Alt metinler fotoğraf sırasıyla eşleşir; marka adı içeren kısımlar temizlenir.
  if (Array.isArray(parsedResult.image_alt_texts)) {
    parsedResult.image_alt_texts = parsedResult.image_alt_texts
      .slice(0, images?.length ?? 0)
      .map((alt: unknown) => (typeof alt === 'string' ? sanitizeTrademarkText(alt, { allowedNames: garmentNames }).cleanText.slice(0, 250) : ''));
  }

  // 2. Post-Processing Anti-Contamination Filter (Hard Code Safety Net)
  //    Kelime sınırıyla eşleşir ("vacation tee" kedi sayılmaz). Aktif sezonun bayram temaları
  //    (ör. Q4'te "christmas") sezon motoru tarafından önerildiği için silinmez.
  const seasonalAllowed = ['halloween', 'christmas'].filter((term) =>
    currentSeason.bonusRules.some((rule) => rule.keywords.some((k) => containsWord(k, term))),
  );
  const subjectText = `${parsedResult.detectedSubject || ''} ${primarySubject || ''} ${designDescription || ''}`;
  parsedResult.selectedTags = filterContaminatedTerms(
    cleanTags.filter((t: string) => t.length > 0 && t.length <= 20),
    (t: string) => t,
    { subjectText, allowedTerms: seasonalAllowed },
  ).slice(0, 13);

  return {
    listing: parsedResult,
    keywordsEnriched: enrichedKeywords,
    coOccurringTags: enrichedCoOccurring,
    seasonInfo: currentSeason,
    trademarkSafeguard: {
      cleanedInputKeywords: trademarkRemovedKeywords,
      titleViolationsCleaned: sanitizedTitleObj.violations,
      tagViolationsCleaned: violationsFound
    },
    modelUsed: seoModel
  };
}
