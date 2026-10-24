/**
 * Otomasyon hattının saf (yan etkisiz) karar mantığı: hangi mockup'ların kullanılacağı, tasarım prompt'u,
 * SEO anahtar kelimeleri, sıradaki adım ve çalıştırmanın sonucu. Çalıştırıcı (`automation-runner.ts`) bunları
 * kullanır; ayrı tutuldukları için birim testleriyle doğrulanır.
 */
import type { MockupItem } from '@/types/pod';
import type { AutomationRunSteps, AutomationStepName, PodTemplateMockupConfig, PodTemplateSeoHints } from '@/types/templates';
import { MAX_ETSY_PHOTOS } from '@/lib/etsy-preflight';

export const AUTOMATION_STEP_ORDER: AutomationStepName[] = [
  'designGeneration',
  'backgroundRemoval',
  'mockupRender',
  'videoGeneration',
  'seoGeneration',
  'listingCreation',
];

/** Başarısız olsa da çalıştırmayı başarısız saymayan adımlar. */
const OPTIONAL_STEPS = new Set<AutomationStepName>(['videoGeneration']);

export function isStepDone(status: string | undefined): boolean {
  return status === 'completed' || status === 'skipped' || status === 'failed';
}

/** Henüz bitmemiş ilk adım (yoksa null). */
export function nextPendingStep(steps: Partial<AutomationRunSteps>): AutomationStepName | null {
  return AUTOMATION_STEP_ORDER.find((name) => !isStepDone(steps[name]?.status)) ?? null;
}

/** Tüm adımlar bittiğinde çalıştırmanın durumu: zorunlu bir adım başarısızsa 'failed'. */
export function deriveRunOutcome(steps: Partial<AutomationRunSteps>): { status: 'completed' | 'failed'; errorMessage: string | null } {
  for (const name of AUTOMATION_STEP_ORDER) {
    const step = steps[name];
    if (step?.status === 'failed' && !OPTIONAL_STEPS.has(name)) {
      return { status: 'failed', errorMessage: step.error || `${name} adımı başarısız oldu.` };
    }
  }
  return { status: 'completed', errorMessage: null };
}

function matchesFabric(mockup: MockupItem, fabricType: PodTemplateMockupConfig['fabricType'] | undefined): boolean {
  if (!fabricType || fabricType === 'all') return true;
  return mockup.apparelType === fabricType || mockup.apparelType === 'any';
}

/**
 * Şablonun mockup seçimini çalışma alanındaki gerçek mockup'larla eşleştirir.
 * - Baskı alanlı mockup'lar kumaş filtresine göre süzülür ve tasarım yerleştirilerek render edilir.
 * - Statik mockup'lar (beden tablosu vb.) olduğu gibi eklenir.
 * - Toplam fotoğraf sayısı Etsy sınırına (20) indirilir; ilk video mockup'ı ayrıca döner.
 */
export function selectAutomationMockups(mockups: MockupItem[], config: Partial<PodTemplateMockupConfig> | null | undefined) {
  const byId = new Map(mockups.map((m) => [m.id, m]));
  const pick = (ids: string[] | undefined) => (ids ?? []).map((id) => byId.get(id)).filter((m): m is MockupItem => Boolean(m));

  const render = pick(config?.printAreaMockupIds)
    .filter((m) => !m.isVideo && m.hasPrintArea !== false && (m.printAreas?.length ?? 0) > 0)
    .filter((m) => matchesFabric(m, config?.fabricType));
  const statics = pick(config?.staticMockupIds).filter((m) => !m.isVideo);
  const video = pick(config?.videoMockupIds).find((m) => m.isVideo) ?? null;

  const renderLimited = render.slice(0, MAX_ETSY_PHOTOS);
  const staticLimited = statics.slice(0, Math.max(0, MAX_ETSY_PHOTOS - renderLimited.length));
  return { render: renderLimited, statics: staticLimited, video };
}

// Aynı şablonun art arda çalıştırmalarında birbirinin kopyası tasarımlar çıkmasın diye prompt'a farklı bir yön eklenir.
const CREATIVE_DIRECTIONS = [
  'bold typography-led composition',
  'minimal line-art illustration',
  'vintage retro badge style',
  'playful hand-drawn doodle style',
  'clean modern flat illustration',
  'distressed screen-print look',
  'cute kawaii character style',
  'elegant botanical-inspired framing',
];

/**
 * Tasarım prompt'u: niş, hedef kitle ve ürün tipi her zaman korunur; "SEO notları" bunlara eklenir
 * (önceden notlar doluysa prompt'un tamamı oluyordu ve niş bilgisi kayboluyordu).
 */
export function buildDesignPrompt(hints: Partial<PodTemplateSeoHints> | null | undefined, variantSeed: number): string {
  const niche = hints?.primaryNiche?.trim();
  const audience = hints?.targetAudience?.trim();
  const productType = hints?.productType?.trim();
  const notes = hints?.customNotes?.trim();
  const direction = CREATIVE_DIRECTIONS[Math.abs(Math.floor(variantSeed)) % CREATIVE_DIRECTIONS.length];

  const parts = [
    `Print-ready ${productType || 'apparel'} design about ${niche || 'a trending gift theme'}`,
    audience ? `for ${audience}` : '',
  ].filter(Boolean).join(' ');
  return [
    `${parts}.`,
    `Creative direction: ${direction}.`,
    notes ? `Additional requirements: ${notes}` : '',
  ].filter(Boolean).join(' ');
}

/**
 * SEO adımına verilecek aday anahtar kelimeler: şablonun niş/kitle/ürün bilgisi ve havuzdan ilgili kelimeler.
 * Tekrarlar ve boşlar atılır; en fazla 20 kelime döner.
 */
export function buildAutomationKeywords(hints: Partial<PodTemplateSeoHints> | null | undefined, poolKeywords: string[] = []): string[] {
  const niche = hints?.primaryNiche?.trim().toLowerCase() || '';
  const audience = hints?.targetAudience?.trim().toLowerCase() || '';
  const product = hints?.productType?.trim().toLowerCase() || '';
  const productWord = product.split(/[\s,/]+/).find(Boolean) || 'shirt';

  const candidates = [
    niche,
    niche && `${niche} ${productWord}`,
    niche && `${niche} gift`,
    audience && `${audience} gift`,
    audience && `gift for ${audience}`,
    product,
    ...poolKeywords.map((k) => k.trim().toLowerCase()),
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const keyword of candidates) {
    if (!keyword || keyword.length > 60 || seen.has(keyword)) continue;
    seen.add(keyword);
    result.push(keyword);
    if (result.length >= 20) break;
  }
  return result;
}

/** Havuz araması için niş ve hedef kitleden anlamlı kelimeler (3+ harf, en fazla 5). */
export function topicSearchTerms(hints: Partial<PodTemplateSeoHints> | null | undefined): string[] {
  const stop = new Set(['and', 'for', 'the', 'with', 'gift', 'gifts', 'shirt', 'tee']);
  const words = `${hints?.primaryNiche || ''} ${hints?.targetAudience || ''}`
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !stop.has(w));
  return Array.from(new Set(words)).slice(0, 5);
}
