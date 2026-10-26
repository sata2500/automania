/**
 * Otomatik niş araştırması: her otomasyon çalıştırmasında tasarımın konusu, hedef kitlesi ve stili
 * yapay zekâ tarafından belirlenir.
 *
 * Karar girdileri:
 *  - Takvim: önümüzdeki ~4 aydaki ABD özel günleri (Etsy'de ürünler 6-10 hafta önceden aranmaya başlar)
 *  - Mağaza performansı: kullanıcının Etsy ilanlarından en çok favorilenen / görüntülenenler
 *  - Etsy verisi: kelime havuzundaki fırsat puanı yüksek anahtar kelimeler
 *  - Web araması (admin panelinden açılıp kapatılır): Google Search ile güncel trendler, Pinterest ve
 *    Google Trends sinyalleri
 *  - Tekrar önleme: aynı otomasyonun son çalıştırmalarında kullanılan nişler
 */
import { sql } from '@/lib/db';
import { loadSettings } from '@/lib/app-settings';
import { withAiRetry } from '@/lib/ai-retry';
import { DEFAULT_NICHE_RESEARCH_PROMPT } from '@/lib/default-prompts';
import { fillPrompt } from '@/lib/prompt-registry';
import { loadPrompt } from '@/lib/prompt-settings';
import { createGoogleClient, loadGoogleConnection } from '@/lib/google-genai-client';

export type NicheResearchResult = {
  niche: string;
  targetAudience: string;
  style: string;
  designBrief: string;
  occasion: string | null;
  keywords: string[];
  reasoning: string;
  sources: Array<{ title: string; url: string }>;
  searchedWeb: boolean;
  model: string;
};

export type ResearchContext = {
  today: Date;
  productType: string;
  categoryPath?: string | null;
  focus?: string;
  upcomingEvents: Array<{ name: string; date: string; daysAway: number }>;
  topListings: Array<{ title: string; favorites: number; views: number; tags: string[] }>;
  poolKeywords: Array<{ keyword: string; score: number | null; listings: number | null }>;
  recentNiches: string[];
};

// ─── Takvim ──────────────────────────────────────────────────────────────────

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month + 1, -offset));
}

/** Paskalya (Gregoryen, anonim algoritma). */
function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month, day));
}

function eventsForYear(year: number): Array<{ name: string; date: Date }> {
  return [
    { name: "New Year's", date: new Date(Date.UTC(year, 0, 1)) },
    { name: "Valentine's Day", date: new Date(Date.UTC(year, 1, 14)) },
    { name: "St. Patrick's Day", date: new Date(Date.UTC(year, 2, 17)) },
    { name: 'Easter', date: easterSunday(year) },
    { name: 'Teacher Appreciation Week', date: nthWeekdayOfMonth(year, 4, 1, 1) },
    { name: "Mother's Day", date: nthWeekdayOfMonth(year, 4, 0, 2) },
    { name: 'Graduation season', date: new Date(Date.UTC(year, 4, 25)) },
    { name: 'Memorial Day', date: lastWeekdayOfMonth(year, 4, 1) },
    { name: 'Pride Month', date: new Date(Date.UTC(year, 5, 1)) },
    { name: "Father's Day", date: nthWeekdayOfMonth(year, 5, 0, 3) },
    { name: 'Fourth of July', date: new Date(Date.UTC(year, 6, 4)) },
    { name: 'Back to School', date: new Date(Date.UTC(year, 7, 15)) },
    { name: 'Labor Day', date: nthWeekdayOfMonth(year, 8, 1, 1) },
    { name: 'Fall / Autumn season', date: new Date(Date.UTC(year, 8, 22)) },
    { name: 'Halloween', date: new Date(Date.UTC(year, 9, 31)) },
    { name: 'Thanksgiving', date: nthWeekdayOfMonth(year, 10, 4, 4) },
    { name: 'Black Friday / Cyber Monday', date: new Date(nthWeekdayOfMonth(year, 10, 4, 4).getTime() + 86_400_000) },
    { name: 'Christmas', date: new Date(Date.UTC(year, 11, 25)) },
  ];
}

/** Bugünden itibaren `horizonDays` gün içindeki ABD özel günleri (yakından uzağa). */
export function upcomingUsEvents(today: Date, horizonDays = 120): Array<{ name: string; date: string; daysAway: number }> {
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const year = today.getUTCFullYear();
  return [...eventsForYear(year), ...eventsForYear(year + 1)]
    .map((event) => ({ name: event.name, date: event.date.toISOString().slice(0, 10), daysAway: Math.round((event.date.getTime() - start) / 86_400_000) }))
    .filter((event) => event.daysAway >= 0 && event.daysAway <= horizonDays)
    .sort((a, b) => a.daysAway - b.daysAway);
}

// ─── Prompt ve yanıt ─────────────────────────────────────────────────────────

/**
 * Araştırma prompt'u: admin panelindeki "Niş araştırması" talimatı verilerle doldurulur (saf fonksiyon;
 * testlerle doğrulanır). Boş veri bölümleri "none" yazılır.
 */
export function buildResearchPrompt(ctx: ResearchContext, template: string = DEFAULT_NICHE_RESEARCH_PROMPT): string {
  const list = (items: string[]) => (items.length > 0 ? items.join('\n') : 'none');
  return fillPrompt(template, {
    today: ctx.today.toISOString().slice(0, 10),
    productType: ctx.productType,
    category: ctx.categoryPath?.trim() || 'not specified',
    focus: ctx.focus?.trim() || 'none',
    upcomingEvents: list(ctx.upcomingEvents.slice(0, 8).map((e) => `- ${e.name}: ${e.date} (in ${e.daysAway} days)`)),
    topListings: list(ctx.topListings.slice(0, 8).map((l) => `- "${l.title}" (${l.favorites} favorites, ${l.views} views; tags: ${l.tags.slice(0, 6).join(', ')})`)),
    poolKeywords: list(ctx.poolKeywords.slice(0, 15).map((k) => `- "${k.keyword}"${k.score !== null ? ` score ${k.score}/100` : ''}${k.listings ? `, ${k.listings} competing listings` : ''}`)),
    recentNiches: ctx.recentNiches.length > 0 ? ctx.recentNiches.map((n) => `"${n}"`).join(', ') : 'none',
  });
}

const asText = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** Model yanıtından JSON nesnesini çıkarır; zorunlu alanlar yoksa null. */
export function parseResearchResponse(text: string): Omit<NicheResearchResult, 'sources' | 'searchedWeb' | 'model'> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const niche = asText(data.niche, 120);
  if (!niche) return null;
  const keywords = Array.isArray(data.keywords)
    ? data.keywords.map((k) => asText(k, 60).toLowerCase()).filter(Boolean).slice(0, 10)
    : [];
  return {
    niche,
    targetAudience: asText(data.targetAudience, 200),
    style: asText(data.style, 200),
    designBrief: asText(data.designBrief, 600),
    occasion: asText(data.occasion, 80) || null,
    keywords,
    reasoning: asText(data.reasoning, 800),
  };
}

// ─── Veri toplama ve çağrı ───────────────────────────────────────────────────

async function loadTopListings(userId: string): Promise<ResearchContext['topListings']> {
  try {
    const rows = await sql`
      SELECT title, num_favorers, views, tags FROM user_etsy_listings
      WHERE user_id = ${userId} AND state = 'active' AND (COALESCE(num_favorers, 0) > 0 OR COALESCE(views, 0) > 0)
      ORDER BY COALESCE(num_favorers, 0) * 20 + COALESCE(views, 0) DESC
      LIMIT 8
    `;
    return rows.map((row) => ({
      title: String(row.title ?? '').slice(0, 140),
      favorites: Number(row.num_favorers) || 0,
      views: Number(row.views) || 0,
      tags: Array.isArray(row.tags) ? (row.tags as unknown[]).map(String) : [],
    }));
  } catch (error) {
    console.warn('[NicheResearch] Shop listings could not be loaded', error instanceof Error ? error.message : error);
    return [];
  }
}

async function loadOpportunityKeywords(): Promise<ResearchContext['poolKeywords']> {
  try {
    const rows = await sql`
      SELECT keyword, COALESCE(opportunity_score, etsy_score) AS score, total_listings FROM keyword_pool
      WHERE COALESCE(opportunity_score, etsy_score, 0) > 0
      ORDER BY COALESCE(opportunity_score, etsy_score, 0) DESC
      LIMIT 15
    `;
    return rows.map((row) => ({
      keyword: String(row.keyword),
      score: row.score === null || row.score === undefined ? null : Number(row.score),
      listings: row.total_listings === null || row.total_listings === undefined ? null : Number(row.total_listings),
    }));
  } catch (error) {
    console.warn('[NicheResearch] Keyword pool could not be loaded', error instanceof Error ? error.message : error);
    return [];
  }
}

/** Bu otomasyonun son çalıştırmalarında seçilen nişler (tekrarı önlemek için). */
async function loadRecentNiches(templateId: string): Promise<string[]> {
  try {
    const rows = await sql`
      SELECT steps->'nicheResearch'->'output'->>'niche' AS niche FROM automation_runs
      WHERE template_id = ${templateId} AND steps->'nicheResearch'->'output'->>'niche' IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 12
    `;
    return [...new Set(rows.map((row) => String(row.niche)).filter(Boolean))];
  } catch (error) {
    console.warn('[NicheResearch] Recent niches could not be loaded', error instanceof Error ? error.message : error);
    return [];
  }
}

type GroundingChunk = { web?: { uri?: string; title?: string } };

/**
 * Niş araştırmasını yapar. Google bağlantısı (API anahtarı veya Vertex) gerekir; web araması admin
 * panelindeki "Niş araştırmasında web araması" ayarıyla kapatılabilir.
 */
export async function researchNiche(input: {
  userId: string;
  templateId: string;
  productType: string;
  categoryPath?: string | null;
  focus?: string;
  now?: Date;
}): Promise<NicheResearchResult> {
  const connection = await loadGoogleConnection();
  if (!connection) throw new Error('Niş araştırması için Google AI bağlantısı gerekli (admin panelinden ekleyin).');

  const settings = await loadSettings(['ai_research_web_search', 'ai_research_model', 'gemini_model_reasoning']).catch(() => ({} as Record<string, string>));
  const webSearch = settings.ai_research_web_search !== 'false';
  const model = settings.ai_research_model || settings.gemini_model_reasoning || 'gemini-2.5-flash';
  const today = input.now ?? new Date();

  const [topListings, poolKeywords, recentNiches] = await Promise.all([
    loadTopListings(input.userId),
    loadOpportunityKeywords(),
    loadRecentNiches(input.templateId),
  ]);
  const prompt = buildResearchPrompt({
    today,
    productType: input.productType || 'T-shirt',
    categoryPath: input.categoryPath,
    focus: input.focus,
    upcomingEvents: upcomingUsEvents(today),
    topListings,
    poolKeywords,
    recentNiches,
  }, await loadPrompt('ai_prompt_niche_research'));

  const client = createGoogleClient(connection, { model });
  const response = await withAiRetry(() => client.models.generateContent({
    model,
    contents: prompt,
    // Google Search aracı yapılandırılmış JSON yanıt moduyla birlikte kullanılamaz; JSON metinden ayrıştırılır.
    config: { temperature: 0.9, ...(webSearch ? { tools: [{ googleSearch: {} }] } : {}) },
  }), { label: 'niche research' });
  const text = response.text ?? '';
  const parsed = parseResearchResponse(text);
  if (!parsed) throw new Error('Niş araştırması geçerli bir sonuç döndürmedi.');

  const chunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) as GroundingChunk[];
  const sources = chunks
    .map((chunk) => ({ title: chunk.web?.title?.slice(0, 120) || '', url: chunk.web?.uri || '' }))
    .filter((source) => source.url.startsWith('https://'))
    .slice(0, 8);

  return { ...parsed, sources, searchedWeb: webSearch, model };
}
