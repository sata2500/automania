/**
 * Etsy ilan SEO puanı (v2, 0-100). Üç parça; her biri kaynağıyla gösterilir:
 *  - Kurallar (25): Etsy sınırları (13 etiket, 20 / 140 karakter), tekrar ve marka; başlık ve açıklamanın biçimi.
 *    Etsy'nin güncel önerileri: başlık kısa ve net (ürün bir kez söylenir, doldurma yok); etiketler başlığı
 *    tekrarlamaz, onun sığdıramadığı aramaları yakalar; aynı kelimeyi birçok etikette tekrarlamak etiket israfıdır.
 *  - Etsy verisi (35): etiketlerin kelime havuzundaki güncel (≤14 gün) fırsat puanları ve başlığın başında
 *    güçlü bir aranan ifade olması. Puanı olmayan etiket puan almaz, hesaba katılmaz; güven göstergesini düşürür.
 *  - Yapay zekâ (40): görsel analizine göre başlık/etiket/açıklamanın tasarıma uygunluğu ve kalitesi
 *    (bkz. listing-ai-review). Yalnızca değerlendirme mevcut metinle yapıldıysa (aynı metin özeti) kullanılır.
 * Verisi olmayan parça "bilinmiyor" sayılır: puan eldeki parçaların en yüksek değerine oranlanır ve `partial` döner.
 * Saf fonksiyon (istemci ve sunucu ortak).
 */

export interface VisionAnalysisData {
  primarySubject?: string;
  primaryAesthetic?: string;
  detectedStyle?: string;
  detectedColors?: string[];
  productType?: string;
  description?: string;
  keywords?: string[];
  analyzedAt?: number | string;
}

export type SeoSource = 'rules' | 'etsy' | 'ai';

export interface SeoIssue {
  severity: 'critical' | 'warning' | 'tip';
  field: 'title' | 'tags' | 'description' | 'vision';
  message: string;
  fixSuggestion?: string;
  source?: SeoSource;
}

export interface KeywordPoolMetric {
  keyword: string;
  opportunityScore: number;
  totalListings?: number;
  competitionLevel?: string;
  bestsellerCount?: number;
  isEtsySuggested?: boolean;
  lastEvaluatedAt?: string | number | Date | null;
  isFresh?: boolean;
}

export interface TagMetricBreakdown {
  keyword: string;
  charLength: number;
  isValidLength: boolean; // <= 20 chars
  isMultiWord: boolean;
  opportunityScore: number;
  totalListings?: number;
  competitionLevel?: string;
  bestsellerCount?: number;
  isEtsySuggested?: boolean;
  inPool: boolean;
  isFresh?: boolean;
  /** Yapay zekâ değerlendirmesine göre tasarımla ilgisiz */
  irrelevant?: boolean;
  status: 'excellent' | 'good' | 'average' | 'poor' | 'invalid' | 'unknown';
}

/** Yapay zekâ değerlendirmesi (bkz. listing-ai-review): her ölçüt 0-10. */
export interface ListingAiReview {
  /** Değerlendirilen metnin özeti; metin değişince değerlendirme geçersiz olur. */
  textHash: string;
  scores: {
    /** Başlık ve etiketler tasarımdaki konu/stili doğru anlatıyor mu */
    relevance: number;
    /** Başlık kısa, net, okunur mu; ürün ve ana ifade başta mı */
    title: number;
    /** Etiketler farklı alıcı aramalarını kapsıyor mu, tekrar/doldurma yok mu */
    tags: number;
    /** Açıklama ürünü ve alıcıyı anlatıyor mu; bilgiler doğru ve eksiksiz mi */
    description: number;
  };
  notes: { title?: string; tags?: string; description?: string; overall?: string };
  irrelevantTags: string[];
  reviewedAt: string;
  model?: string;
}

export interface SeoEvaluationResult {
  version: 2;
  score: number;
  grade: SeoGrade;
  /** Bir parça (Etsy verisi veya yapay zekâ) eksikse puan eldekilere oranlanmıştır. */
  partial: boolean;
  breakdown: {
    rules: number;
    demand: number | null;
    ai: number | null;
    maxRules: 25;
    maxDemand: 35;
    maxAi: 40;
  };
  confidence: {
    scoredTags: number;
    totalTags: number;
    aiReviewed: boolean;
  };
  tagBreakdown: TagMetricBreakdown[];
  /** Birden çok etikette geçen kelimeler (kelime → etiket sayısı) */
  repeatedWords: Array<{ word: string; count: number }>;
  strengths: string[];
  issues: SeoIssue[];
  matchedPoolKeywords: KeywordPoolMetric[];
  missingPoolKeywords: KeywordPoolMetric[];
  aiReview: ListingAiReview | null;
  evaluatedAt: string;
}

/** Anahtar kelime havuzu satırı (veritabanı snake_case veya API camelCase). */
export type KeywordPoolInputRow = {
  keyword?: string | null;
  opportunity_score?: number | string | null;
  etsy_score?: number | string | null;
  total_listings?: number | string | null;
  totalListings?: number | string | null;
  competition_level?: string | null;
  competitionLevel?: string | null;
  bestseller_count?: number | string | null;
  bestsellerCount?: number | string | null;
  is_etsy_suggested?: boolean | null;
  isEtsySuggested?: boolean | null;
  last_evaluated_at?: string | Date | null;
  lastEvaluatedAt?: string | Date | null;
};

export type SeoGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

/** Uygulama genelindeki tek harf notu ölçeği (Stüdyo ve İlanlarım aynı eşikleri kullanır). */
export function gradeForSeoScore(score: number): SeoGrade {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/** Puanların kullanıldığı en uzun süre (kelime havuzuyla aynı: daha eski puanlar güncel sayılmaz). */
const MAX_SCORE_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const STOPWORDS = new Set(['a', 'an', 'the', 'and', 'or', 'for', 'of', 'with', 'in', 'on', 'to', 'my', 'your', 'our', 'is', 'it', 'by', 'at', 'as', '&']);
/** Aynı ürün kelimesinin yazım biçimleri tek kök sayılır. */
const WORD_ALIASES: Record<string, string> = {
  tshirt: 'shirt', 't-shirt': 'shirt', tee: 'shirt', tees: 'shirt', shirts: 'shirt', tshirts: 'shirt', 't-shirts': 'shirt',
  sweatshirts: 'sweatshirt', hoodies: 'hoodie', gifts: 'gift',
};
const GENERIC_WORDS = new Set(['shirt', 'gift', 'unisex', 'women', 'men', 'womens', 'mens']);
/** Ürün kelimeleri: başlık ve kategoride zaten geçer; etiketlerde tekrarı daha sıkı değerlendirilir. */
const PRODUCT_ROOTS = new Set(['shirt', 'sweatshirt', 'hoodie', 'top', 'apparel', 'clothing', 'crewneck', 'tank']);

/** Kelimenin kökü: küçük harf, eş yazımlar birleşir, basit çoğul eki atılır. */
export function wordRoot(word: string): string {
  const lower = word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (WORD_ALIASES[lower]) return WORD_ALIASES[lower];
  if (lower.length > 4 && lower.endsWith('ies')) return `${lower.slice(0, -3)}y`;
  if (lower.length > 3 && lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1);
  return lower;
}

/** Metnin anlamlı kelime kökleri (bağlaçlar hariç; "t-shirt" tek kelime sayılır). */
export function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .map((w) => w.replace(/^-+|-+$/g, ''))
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
    .map(wordRoot);
}

/** Birden çok etikette geçen kökler (en çok geçen önce). */
export function repeatedTagWords(tags: string[]): Array<{ word: string; count: number }> {
  const counts = new Map<string, number>();
  for (const tag of tags) for (const root of new Set(contentWords(tag))) counts.set(root, (counts.get(root) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count);
}

/** Değerlendirilen metnin kısa özeti (yapay zekâ değerlendirmesinin hangi metne ait olduğunu bilmek için). */
export function listingTextHash(title: string, tags: string[], description: string): string {
  const text = `${title.trim()}\u0000${tags.map((t) => t.trim().toLowerCase()).join('|')}\u0000${description.trim()}`;
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function significantWords(text: string): Set<string> {
  return new Set(contentWords(text).filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w)));
}

function poolMetric(row: KeywordPoolInputRow, now: number): KeywordPoolMetric | null {
  if (!row.keyword) return null;
  const lastEval = row.last_evaluated_at || row.lastEvaluatedAt || null;
  const age = lastEval ? now - new Date(lastEval).getTime() : Infinity;
  return {
    keyword: String(row.keyword),
    opportunityScore: Number(row.opportunity_score || row.etsy_score || 0),
    totalListings: Number(row.total_listings || row.totalListings || 0),
    competitionLevel: String(row.competition_level || row.competitionLevel || 'Bilinmiyor'),
    bestsellerCount: Number(row.bestseller_count || row.bestsellerCount || 0),
    isEtsySuggested: Boolean(row.is_etsy_suggested || row.isEtsySuggested),
    lastEvaluatedAt: lastEval,
    isFresh: age <= MAX_SCORE_AGE_MS,
  };
}

export function evaluateEtsyListingSeo(params: {
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  /** Geriye dönük uyumluluk: puana katılmaz (görsel uyumu yapay zekâ değerlendirmesi ölçer). */
  visionAnalysis?: VisionAnalysisData | null;
  keywordPoolRows?: KeywordPoolInputRow[];
  /** Mevcut metne ait olan (textHash eşleşen) inceleme kullanılır; birden çok aday verilebilir. */
  aiReview?: ListingAiReview | Array<ListingAiReview | null> | null;
  now?: number;
}): SeoEvaluationResult {
  const now = params.now ?? Date.now();
  const title = (params.title || '').trim();
  const description = (params.description || '').trim();
  const tags = (params.tags || []).map((t) => String(t).trim()).filter(Boolean);
  const issues: SeoIssue[] = [];
  const strengths: string[] = [];
  const issue = (source: SeoSource, field: SeoIssue['field'], severity: SeoIssue['severity'], message: string, fixSuggestion?: string) =>
    issues.push({ source, field, severity, message, fixSuggestion });

  const poolMap = new Map<string, KeywordPoolMetric>();
  for (const row of params.keywordPoolRows || []) {
    const metric = poolMetric(row, now);
    if (metric) poolMap.set(metric.keyword.toLowerCase().trim(), metric);
  }

  const currentHash = listingTextHash(title, tags, description);
  const candidates = Array.isArray(params.aiReview) ? params.aiReview : [params.aiReview];
  const aiReview = candidates.find((r): r is ListingAiReview => Boolean(r && r.textHash === currentHash)) ?? null;
  const irrelevant = new Set((aiReview?.irrelevantTags ?? []).map((t) => t.toLowerCase().trim()));

  // ── Etiket dökümü ────────────────────────────────────────────────────────────
  const tagBreakdown: TagMetricBreakdown[] = tags.map((tag) => {
    const metric = poolMap.get(tag.toLowerCase());
    const fresh = Boolean(metric?.isFresh && metric.opportunityScore > 0);
    const score = fresh ? metric!.opportunityScore : 0;
    const isValidLength = tag.length <= 20;
    const status: TagMetricBreakdown['status'] = !isValidLength ? 'invalid'
      : !fresh ? 'unknown'
      : score >= 75 ? 'excellent' : score >= 55 ? 'good' : score >= 40 ? 'average' : 'poor';
    return {
      keyword: tag,
      charLength: tag.length,
      isValidLength,
      isMultiWord: /[\s-]/.test(tag),
      opportunityScore: score,
      totalListings: metric?.totalListings,
      competitionLevel: metric?.competitionLevel,
      bestsellerCount: metric?.bestsellerCount,
      isEtsySuggested: metric?.isEtsySuggested,
      inPool: Boolean(metric),
      isFresh: metric?.isFresh,
      irrelevant: irrelevant.has(tag.toLowerCase()),
      status,
    };
  });

  // ── 1. Kurallar (25) ─────────────────────────────────────────────────────────
  let rules = 0;

  // Etiket sayısı (6)
  if (tags.length === 13) {
    rules += 6;
    strengths.push('13 etiketin tamamı kullanılmış.');
  } else {
    rules += tags.length >= 10 ? 4 : tags.length >= 5 ? 2 : 0;
    issue('rules', 'tags', tags.length >= 10 ? 'warning' : 'critical', `${13 - tags.length} etiket eksik (${tags.length}/13).`, 'Her etiket ayrı bir arama yakalar; 13 etiketin tamamını kullanın.');
  }

  // Geçerlilik (4): 20 karakter sınırı ve aynı etiketin tekrarı
  const overLength = tags.filter((t) => t.length > 20);
  const duplicates = tags.length - new Set(tags.map((t) => t.toLowerCase())).size;
  rules += Math.max(0, 4 - overLength.length * 2 - duplicates * 2);
  if (overLength.length > 0) issue('rules', 'tags', 'critical', `${overLength.length} etiket 20 karakteri aşıyor: ${overLength.map((t) => `"${t}"`).join(', ')}.`, 'Etsy 20 karakterden uzun etiketi kabul etmez; kısaltın.');
  if (duplicates > 0) issue('rules', 'tags', 'warning', `${duplicates} etiket birebir tekrar ediyor.`, 'Her etiket farklı bir arama olmalı.');

  // Kelime tekrarı (6): aynı kök çok etikette geçerse etiketler aynı aramayı tekrar yakalar. Tasarımın konusu
  // ("cat mom gift", "retro cat lover") birkaç etikette doğal olarak geçer; ürün kelimesi ise (shirt, tee, hoodie)
  // başlıkta ve kategoride zaten var, etiketlerde en fazla iki kez kullanılmalı.
  const repeatedWords = repeatedTagWords(tags);
  const productRepeat = repeatedWords.filter((r) => PRODUCT_ROOTS.has(r.word) && r.count >= 3);
  const subjectRepeat = repeatedWords.filter((r) => !PRODUCT_ROOTS.has(r.word) && r.count >= 4);
  const maxSubject = subjectRepeat[0]?.count ?? 0;
  const repeatPenalty = (maxSubject >= 6 ? 4 : maxSubject === 5 ? 3 : maxSubject === 4 ? 1 : 0) + (productRepeat.length > 0 ? 2 + (productRepeat[0]!.count >= 5 ? 1 : 0) : 0);
  rules += Math.max(0, 6 - repeatPenalty);
  if (productRepeat.length > 0) {
    issue('rules', 'tags', productRepeat[0]!.count >= 5 ? 'warning' : 'tip',
      `Ürün kelimesi çok etikette tekrarlanıyor: ${productRepeat.map((r) => `"${r.word}" (${r.count})`).join(', ')}.`,
      'Etsy başlık, kategori ve etiketlerdeki kelimeleri birleştirerek eşleştirir; "shirt/tee" gibi ürün kelimesini her etikete yazmak etiket israfıdır. Bu etiketleri farklı aramalara (konu, stil, alıcı, özel gün) ayırın.');
  }
  if (subjectRepeat.length > 0) {
    issue('rules', 'tags', maxSubject >= 5 ? 'warning' : 'tip',
      `Bazı kelimeler çok etikette tekrarlanıyor: ${subjectRepeat.map((r) => `"${r.word}" (${r.count})`).join(', ')}.`,
      'Aynı kelimeyi taşıyan etiketler benzer aramaları yakalar; bir kısmını eş anlamlılara veya farklı alıcı niyetlerine çevirin.');
  }
  if (productRepeat.length === 0 && subjectRepeat.length === 0 && tags.length >= 10) {
    strengths.push('Etiketler aynı kelimeyi tekrarlamadan farklı aramaları kapsıyor.');
  }

  // Başlık biçimi (5): kısa ve net başlık; büyük harf ve kelime tekrarı yok.
  const titleWords = contentWords(title);
  const titleCounts = new Map<string, number>();
  for (const w of titleWords) titleCounts.set(w, (titleCounts.get(w) ?? 0) + 1);
  const titleRepeats = [...titleCounts.entries()].filter(([, n]) => n >= 3).map(([w]) => w);
  let titleForm = 0;
  if (title.length === 0) {
    issue('rules', 'title', 'critical', 'Başlık boş.');
  } else if (title.length > 140) {
    issue('rules', 'title', 'critical', `Başlık 140 karakter sınırını aşıyor (${title.length}).`, 'Başlığı 140 karakterin altına indirin.');
  } else if (title.length < 30) {
    titleForm = 2;
    issue('rules', 'title', 'warning', `Başlık çok kısa (${title.length} karakter).`, 'Ürünü, konusunu ve ana özelliğini (stil, alıcı) anlatan net bir başlık yazın.');
  } else if (title.length <= 110) {
    titleForm = 5;
    strengths.push(`Başlık kısa ve net (${title.length} karakter).`);
  } else {
    titleForm = 3;
    issue('rules', 'title', 'tip', `Başlık uzun (${title.length} karakter).`, 'Etsy kısa ve okunur başlıkları öneriyor: ürünü bir kez söyleyin, aynı anlamdaki ifadeleri etiketlere taşıyın.');
  }
  if (title.length > 20 && title === title.toUpperCase()) {
    titleForm = Math.max(0, titleForm - 2);
    issue('rules', 'title', 'warning', 'Başlık tamamen büyük harfle yazılmış.', 'Normal büyük-küçük harf kullanın.');
  }
  if (titleRepeats.length > 0) {
    titleForm = Math.max(0, titleForm - 2);
    issue('rules', 'title', 'warning', `Başlıkta aynı kelime 3+ kez geçiyor: ${titleRepeats.map((w) => `"${w}"`).join(', ')}.`, 'Kelime tekrarı doldurma gibi görünür; her ifadeyi bir kez kullanın.');
  }
  rules += titleForm;

  // Açıklama temeli (4): yeterli uzunluk + ilk cümlelerde ürün; beden/kumaş/bakım bilgisi.
  const lowerDesc = description.toLowerCase();
  const opening = lowerDesc.slice(0, 200);
  const leadWords = significantWords(title.slice(0, 60));
  const openingMentionsProduct = [...leadWords].some((w) => opening.includes(w));
  if (description.length >= 300 && openingMentionsProduct) {
    rules += 2;
  } else {
    issue('rules', 'description', description.length < 150 ? 'critical' : 'tip',
      description.length < 300 ? `Açıklama kısa (${description.length} karakter).` : 'Açıklamanın ilk cümleleri başlıktaki ürünü ve konuyu anmıyor.',
      'İlk 1-2 cümlede ürünün ne olduğunu ve kimin için olduğunu anlatın; ardından ürün bilgilerini verin.');
  }
  const sections = [
    /\b(size|sizing|fit)\b/.test(lowerDesc),
    /\b(wash|care|dry)\b/.test(lowerDesc),
    /\b(cotton|fabric|material|polyester|blend)\b/.test(lowerDesc),
  ].filter(Boolean).length;
  if (sections >= 2) {
    rules += 2;
  } else {
    issue('rules', 'description', 'tip', 'Açıklamada beden, kumaş veya bakım bilgisi eksik.', 'Ayarlar › İlan metni bilgileri doluysa yapay zekâ bunları ekler.');
  }

  // ── 2. Etsy verisi (35) ──────────────────────────────────────────────────────
  const scored = tagBreakdown.filter((t) => t.status !== 'unknown' && t.status !== 'invalid');
  let demand: number | null = null;
  if (scored.length > 0) {
    const avg = scored.reduce((sum, t) => sum + t.opportunityScore, 0) / scored.length;
    const tagDemand = Math.round((Math.min(100, avg) / 100) * 25);
    // Başlığın başı (ilk ~50 karakter): en güçlü puanlı ifadelerden birini içeriyor mu?
    const head = significantWords(title.slice(0, 50));
    const strong = [...scored].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 4);
    const leads = strong.some((t) => {
      const words = significantWords(t.keyword);
      return words.size > 0 && [...words].every((w) => head.has(w));
    });
    demand = tagDemand + (leads ? 10 : strong.some((t) => [...significantWords(t.keyword)].some((w) => head.has(w))) ? 5 : 0);
    if (avg >= 65) strengths.push(`Etiketlerin Etsy fırsat puanı yüksek (ortalama ${Math.round(avg)}).`);
    else issue('etsy', 'tags', avg < 45 ? 'warning' : 'tip', `Etiketlerin Etsy fırsat puanı ortalaması ${Math.round(avg)}.`, 'Kelime havuzunda bu tasarımla ilgili daha yüksek puanlı ifadeler varsa onları kullanın.');
    if (leads) strengths.push('Başlık, en güçlü aranan ifadelerden biriyle başlıyor.');
    else issue('etsy', 'title', 'tip', 'Başlığın başında en yüksek puanlı aranan ifade yok.', `Ör. "${strong[0]?.keyword}" ifadesini başlığın başına yakın kullanın.`);
  }
  const unknownTags = tagBreakdown.filter((t) => t.status === 'unknown').length;
  if (unknownTags > 0) {
    issue('etsy', 'tags', 'tip', `${unknownTags} etiketin güncel Etsy puanı yok; puana katılmadı.`, 'Bu etiketler kelime havuzunda taranınca puan kesinleşir.');
  }

  // ── 3. Yapay zekâ (40) ───────────────────────────────────────────────────────
  let ai: number | null = null;
  if (aiReview) {
    const clamp = (n: number) => Math.min(10, Math.max(0, Number(n) || 0));
    const s = aiReview.scores;
    ai = Math.round(clamp(s.relevance) + clamp(s.title) + clamp(s.tags) + clamp(s.description));
    const fields: Array<[keyof ListingAiReview['notes'], SeoIssue['field'], number]> = [
      ['title', 'title', clamp(s.title)], ['tags', 'tags', clamp(s.tags)], ['description', 'description', clamp(s.description)],
    ];
    for (const [key, field, value] of fields) {
      const note = aiReview.notes[key];
      if (!note) continue;
      if (value >= 8) strengths.push(note);
      else issue('ai', field, value < 5 ? 'warning' : 'tip', note);
    }
    if (aiReview.irrelevantTags.length > 0) {
      issue('ai', 'tags', 'warning', `Tasarımla ilgisiz görünen etiketler: ${aiReview.irrelevantTags.map((t) => `"${t}"`).join(', ')}.`, 'Bu etiketler yanlış aramalara çıkarır; tasarımın konusu ve stiliyle değiştirin.');
    }
  }

  // ── Toplam ───────────────────────────────────────────────────────────────────
  const available = 25 + (demand !== null ? 35 : 0) + (ai !== null ? 40 : 0);
  const raw = rules + (demand ?? 0) + (ai ?? 0);
  const score = Math.min(100, Math.max(0, Math.round((raw / available) * 100)));

  // Havuzda bu ilanla ortak kelimesi olan, kullanılmamış yüksek puanlı ifadeler
  const used = new Set(tags.map((t) => t.toLowerCase()));
  const listingWords = significantWords(`${title} ${tags.join(' ')}`);
  const missingPoolKeywords = [...poolMap.values()]
    .filter((m) => m.isFresh && m.opportunityScore >= 65 && m.keyword.length <= 20 && !used.has(m.keyword.toLowerCase()) && [...significantWords(m.keyword)].some((w) => listingWords.has(w)))
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 10);

  return {
    version: 2,
    score,
    grade: gradeForSeoScore(score),
    partial: demand === null || ai === null,
    breakdown: { rules, demand, ai, maxRules: 25, maxDemand: 35, maxAi: 40 },
    confidence: { scoredTags: scored.length, totalTags: tags.length, aiReviewed: Boolean(aiReview) },
    tagBreakdown,
    repeatedWords,
    strengths,
    issues,
    matchedPoolKeywords: scored.map((t) => poolMap.get(t.keyword.toLowerCase())!).filter(Boolean),
    missingPoolKeywords,
    aiReview,
    evaluatedAt: new Date(now).toISOString(),
  };
}

/** Kayıtlı değerlendirme eski sürümse (v1) yeniden hesaplanmalı. */
export function isCurrentSeoEvaluation(value: unknown): value is SeoEvaluationResult {
  return Boolean(value && typeof value === 'object' && (value as { version?: unknown }).version === 2);
}

const isReview = (value: unknown): value is ListingAiReview =>
  Boolean(value && typeof value === 'object' && typeof (value as ListingAiReview).textHash === 'string' && (value as ListingAiReview).scores);

/**
 * Kayıtlı değerlendirmedeki yapay zekâ incelemeleri: mevcut metnin incelemesi ve (varsa) onay bekleyen yapay zekâ
 * iyileştirmesinin incelemesi. Puan hesaplanırken yalnızca metne uyan kullanılır.
 */
export function storedAiReview(value: unknown): ListingAiReview[] {
  const parsed = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return null; } })() : value;
  if (!parsed || typeof parsed !== 'object') return [];
  const record = parsed as { aiReview?: unknown; improvement?: { aiReview?: unknown } };
  return [record.aiReview, record.improvement?.aiReview].filter(isReview);
}
