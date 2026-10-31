/**
 * İlan metninin yapay zekâ değerlendirmesi (SEO puanının 40 puanlık kısmı): başlık, etiket ve açıklama tasarımın
 * görsel analizine göre sabit bir ölçüt tablosuyla 0-10 puanlanır (admin › "İlan değerlendirme" talimatı).
 * Rastgelelik kapalıdır (temperature 0); sonuç metin özetiyle saklanır, metin değişmedikçe yeniden çağrılmaz.
 */
import { fillPrompt } from '@/lib/prompt-registry';
import { loadPrompt } from '@/lib/prompt-settings';
import { generateReasoningJson } from '@/lib/ai-text';
import { listingTextHash, type ListingAiReview } from '@/lib/etsy-seo-evaluator';

export type ReviewDesignContext = {
  description?: string | null;
  primarySubject?: string | null;
  primaryAesthetic?: string | null;
  productType?: string | null;
};

export type ReviewListingInput = {
  title: string;
  tags: string[];
  description: string;
  design: ReviewDesignContext;
  /** Mağaza bilgileri: klasörün ürün bilgisi, kargo ve hazırlık süresi (bkz. listing-copy) */
  storeFacts: string;
};

const score = (value: unknown) => Math.min(10, Math.max(0, Math.round(Number(value) || 0)));
const note = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, 300) : undefined);

/** Model yanıtını doğrular (eksik alanlar 0 / boş). Saf fonksiyon. */
export function parseListingReview(data: unknown, input: Pick<ReviewListingInput, 'title' | 'tags' | 'description'>, model?: string): ListingAiReview {
  const raw = (data && typeof data === 'object' ? data : {}) as {
    scores?: Record<string, unknown>; notes?: Record<string, unknown>; irrelevantTags?: unknown;
  };
  const tagSet = new Set(input.tags.map((t) => t.toLowerCase().trim()));
  return {
    textHash: listingTextHash(input.title, input.tags, input.description),
    scores: {
      relevance: score(raw.scores?.relevance),
      title: score(raw.scores?.title),
      tags: score(raw.scores?.tags),
      description: score(raw.scores?.description),
    },
    notes: {
      title: note(raw.notes?.title),
      tags: note(raw.notes?.tags),
      description: note(raw.notes?.description),
      overall: note(raw.notes?.overall),
    },
    // Yalnızca ilanda gerçekten olan etiketler (model uydurursa yok sayılır)
    irrelevantTags: Array.isArray(raw.irrelevantTags)
      ? raw.irrelevantTags.filter((t): t is string => typeof t === 'string' && tagSet.has(t.toLowerCase().trim()))
      : [],
    reviewedAt: new Date().toISOString(),
    model,
  };
}

export async function reviewListingWithAi(input: ReviewListingInput): Promise<ListingAiReview> {
  const prompt = fillPrompt(await loadPrompt('ai_prompt_review_listing'), {
    designDescription: input.design.description || 'Not available',
    primarySubject: input.design.primarySubject || 'Not available',
    primaryAesthetic: input.design.primaryAesthetic || 'Not available',
    productType: input.design.productType || 'Not available',
    storeFacts: input.storeFacts || 'None provided',
    title: input.title,
    titleLength: String(input.title.length),
    tags: input.tags.map((t) => `"${t}"`).join(', '),
    description: input.description,
  });
  const { data, model } = await generateReasoningJson(prompt, { label: 'listing review', temperature: 0, maxOutputTokens: 2048 });
  return parseListingReview(data, input, model);
}
