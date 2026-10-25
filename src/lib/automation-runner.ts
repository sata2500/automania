/**
 * "Kur ve Unut" otomasyon hattı.
 * Adımlar: Tasarım üretimi → Arka plan kaldırma → Mockup render → (isteğe bağlı) Video → SEO metni → Etsy taslak ilanı
 *
 * Hat devam ettirilebilir: her adımın sonucu `automation_runs` kaydına yazılır ve tamamlanan adımlar bir daha
 * çalışmaz. Bir çağrının süre bütçesi dolarsa çalıştırma 'pending' durumuna geri alınır ve sonraki çağrı
 * (iç token ile yeni fonksiyon çağrısı, kullanıcının takip isteği veya saatlik zamanlayıcı) kaldığı yerden sürdürür.
 *
 * Bu modül `POST /api/automation/run` (after() ile), `POST /api/automation/execute` (iç token),
 * takip uç noktası ve zamanlayıcı tarafından çağrılır.
 */
import { db, sql } from '@/lib/db';
import { automationRuns, podTemplates, userWorkspaces } from '@/db/schema';
import { and, eq, inArray, sql as drizzleSql } from 'drizzle-orm';
import { loadAIConfig, generateImage } from '@/lib/ai-provider';
import { removeChromaBackground } from '@/lib/chroma-key';
import { KEY_COLORS, pickKeyBackground } from '@/lib/key-background';
import { uploadToR2, isR2Configured } from '@/lib/r2';
import { createOwnedUploadName } from '@/lib/upload-security';
import { loadSetting } from '@/lib/app-settings';
import { getConfiguredSecret } from '@/lib/internal-auth';
import { loadImageForUser } from '@/lib/media-source';
import { writeAuditLog } from '@/lib/audit-log';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { sanitizeEtsyTags } from '@/lib/etsy-format';
import { validateWhoMade } from '@/lib/etsy-preflight';
import { createEtsyDraftListing } from '@/lib/etsy-listing-service';
import { generateListingContent } from '@/lib/listing-generator';
import { detectPrimarySubject } from '@/lib/listing-subject';
import { researchNiche } from '@/lib/niche-research';
import {
  AUTOMATION_STEP_ORDER,
  buildAutomationKeywords,
  buildDesignPrompt,
  buildVideoPrompt,
  deriveRunOutcome,
  fillVideoPromptTemplate,
  effectiveSeoHints,
  type NicheResearchOutput,
  isStepDone,
  needsDarkGarmentDesign,
  nextPendingStep,
  selectAutomationMockups,
  topicSearchTerms,
} from '@/lib/automation-plan';
import type { DesignItem, EtsyVariationRow, MockupItem } from '@/types/pod';
import { variationConfigFromRows } from '@/lib/folder-template';
import type { AutomationRunSteps, AutomationStepName, GeneratedSeoData } from '@/types/templates';

export type AutomationRunInput = {
  runId: string;
  templateId: string;
  userId: string;
};

export type AutomationRunOutcome =
  | { ok: true; runId: string; resumed?: boolean }
  | { ok: false; runId: string; reason: 'not_found' | 'not_pending' | 'failed' | 'cancelled'; error?: string };

/** Bir çağrıda yeni adım başlatmak için kalan süre (fonksiyon sınırı 300 sn). */
const INVOCATION_BUDGET_MS = 170_000;
/** Video adımı yalnızca en az bu kadar süre kalmışsa başlatılır; aksi halde yeni çağrıya bırakılır. */
const VIDEO_MIN_REMAINING_MS = 260_000;
const VIDEO_MAX_WAIT_MS = 230_000;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

type RunRow = typeof automationRuns.$inferSelect;
type TemplateRow = typeof podTemplates.$inferSelect;

class StepSkipped extends Error {}

/** Otomasyonun ürettiği tasarımların Tasarımlar sekmesindeki klasörü. */
export const AUTOMATION_DESIGN_FOLDER = { id: 'design-folder-automation', name: 'Otomasyon Tasarımları', isCustom: true, type: 'design' as const };

async function loadPromptSetting(key: string): Promise<string> {
  try {
    return (await loadSetting(key)) ?? '';
  } catch (error) {
    console.error(`[Automation] Failed to load prompt setting ${key}`, error);
    return '';
  }
}

async function loadWorkspaceMockups(userId: string): Promise<MockupItem[]> {
  const [workspace] = await db
    .select({ mockups: userWorkspaces.mockups })
    .from(userWorkspaces)
    .where(eq(userWorkspaces.userId, userId));
  return (workspace?.mockups as MockupItem[] | undefined) ?? [];
}

/**
 * Şablon, Etsy SEO sekmesindeki bir varyasyon şablonuna bağlıysa onun güncel satırları kullanılır
 * (fiyat güncellemeleri şablonu yeniden kaydetmeden geçerli olur); bulunamazsa kayıtlı kopya.
 */
async function resolveVariationRows(userId: string, config: TemplateRow['variationConfig']): Promise<NonNullable<TemplateRow['variationConfig']>['rows']> {
  const fallback = config?.rows ?? [];
  if (!config?.sourceTemplateId) return fallback;
  try {
    const [workspace] = await db
      .select({ templates: userWorkspaces.etsyVariationTemplates })
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, userId));
    const source = ((workspace?.templates as Array<{ id: string; variations?: EtsyVariationRow[] }> | null) ?? [])
      .find((t) => t.id === config.sourceTemplateId);
    return source?.variations?.length ? variationConfigFromRows(source.variations).rows : fallback;
  } catch (error) {
    console.warn('[Automation] Variation template lookup failed; using saved rows.', error instanceof Error ? error.message : error);
    return fallback;
  }
}

async function jpegForListing(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(buffer).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
}

/** Veo çıktısını (Google Files URI veya data URL) kullanıcının depolamasına kopyalar; ilan bu dosyayı kullanır. */
async function persistGeneratedVideo(userId: string, runId: string, uri: string, googleApiKey: string): Promise<string> {
  let buffer: Buffer;
  if (uri.startsWith('data:')) {
    buffer = Buffer.from(uri.split(',')[1] || '', 'base64');
  } else {
    const url = new URL(uri);
    // Yalnızca Google'ın dosya sunucusundan indirilir; API anahtarı başka bir adrese gönderilmez.
    if (url.protocol !== 'https:' || url.hostname !== 'generativelanguage.googleapis.com') {
      throw new Error('Video beklenmeyen bir adresten döndü.');
    }
    const res = await fetch(url, { headers: { 'x-goog-api-key': googleApiKey } });
    if (!res.ok) throw new Error(`Video indirilemedi (HTTP ${res.status}).`);
    buffer = Buffer.from(await res.arrayBuffer());
  }
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_VIDEO_BYTES) throw new Error('Video boyutu geçersiz.');
  const upload = await uploadToR2(buffer, createOwnedUploadName(userId, `auto-video-${runId}`, 'video/mp4'), 'video/mp4');
  return upload.url;
}

/** Etsy mağaza bölümleri (bağlantı yoksa veya alınamazsa boş liste). */
async function loadShopSections(userId: string): Promise<Array<{ shop_section_id: number | string; title: string }>> {
  try {
    const token = await getValidEtsyToken(userId);
    if (!token.success || !token.access_token || !token.shop_id) return [];
    const res = await fetch(`https://openapi.etsy.com/v3/application/shops/${token.shop_id}/sections`, {
      headers: {
        'x-api-key': `${token.api_key || process.env.ETSY_API_KEY}:${token.shared_secret || process.env.ETSY_SHARED_SECRET || ''}`,
        Authorization: `Bearer ${token.access_token}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: Array<{ shop_section_id: number; title: string }> };
    return (data.results ?? []).filter((s) => s.title);
  } catch (error) {
    console.warn('[Automation] Shop sections could not be loaded', error instanceof Error ? error.message : error);
    return [];
  }
}

/** Havuzdan şablonun nişiyle ilgili, Etsy verisi olan anahtar kelimeler. */
async function loadRelatedPoolKeywords(terms: string[]): Promise<string[]> {
  if (terms.length === 0) return [];
  try {
    const patterns = terms.map((t) => `%${t.replace(/[%_\\]/g, '')}%`);
    const rows = await sql`
      SELECT keyword FROM keyword_pool
      WHERE LOWER(keyword) LIKE ANY(${patterns})
      ORDER BY COALESCE(opportunity_score, etsy_score, 0) DESC
      LIMIT 10
    `;
    return rows.map((row) => String(row.keyword));
  } catch (error) {
    console.warn('[Automation] Keyword pool lookup failed', error instanceof Error ? error.message : error);
    return [];
  }
}

// ─── Adımlar ─────────────────────────────────────────────────────────────────

type StepContext = {
  run: RunRow;
  template: TemplateRow;
  userId: string;
  runId: string;
  deadline: number;
  /** Bu çağrıda üretilen ve bir sonraki adımın kullanacağı tasarım (yeniden indirmeyi önler) */
  designPng?: Buffer;
  /** Çalıştırmanın adım kayıtları (niş araştırması çıktısı buradan okunur) */
  steps?: AutomationRunSteps;
};

/** Bu çalıştırmanın tasarım/SEO ipuçları: otomatik modda niş araştırmasının sonucu kullanılır. */
function runHints(ctx: StepContext) {
  return effectiveSeoHints(ctx.template.seoHints, ctx.steps?.nicheResearch?.output as NicheResearchOutput | undefined);
}

type StepResult = { patch?: Partial<RunRow>; output?: Record<string, unknown>; skipped?: string; warning?: string };

async function runDesignSteps(ctx: StepContext, steps: AutomationRunSteps, persist: (patch: Partial<RunRow>) => Promise<void>) {
  const { template, userId, runId } = ctx;
  const config = await loadAIConfig();
  const systemPromptTemplate = await loadPromptSetting('ai_prompt_generate_design');

  // Aynı şablonun çalıştırmaları farklı bir yaratıcı yönle başlar (kopya tasarımları önler).
  const seed = Array.from(runId).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const hints = runHints(ctx);
  const basePrompt = buildDesignPrompt(hints, seed);
  const finalPrompt = systemPromptTemplate.trim()
    ? systemPromptTemplate
        .replace(/\{\{userPrompt\}\}/g, basePrompt)
        .replace(/\{\{selectedStyle\}\}/g, hints.primaryNiche || '')
    : basePrompt;

  // Perde rengi konuya göre seçilir: yeşil ağırlıklı konularda (Noel, orman…) magenta, tasarımın yeşilleri korunur.
  const keyBackground = pickKeyBackground(`${hints.primaryNiche ?? ''} ${finalPrompt}`);
  const generatedImages = await generateImage(config, { prompt: finalPrompt, keyBackground });
  if (!generatedImages || generatedImages.length === 0) throw new Error('AI tasarımı üretemedi.');

  steps.designGeneration = { ...steps.designGeneration, status: 'completed', completedAt: new Date().toISOString(), output: { prompt: basePrompt } };
  steps.backgroundRemoval = { status: 'running', startedAt: new Date().toISOString() };
  await persist({ steps });

  // Kompozisyon (kare, ortalı, kenar boşlukları) görsel üretiminde istenir; burada kırpma yapılmaz.
  const { pngBuffer, width: designWidth, height: designHeight } = await removeChromaBackground(
    Buffer.from(generatedImages[0].data, 'base64'),
    { keyColor: KEY_COLORS[keyBackground] },
  );
  if (!isR2Configured()) throw new Error('Depolama (R2) yapılandırılmamış.');
  const uploadResult = await uploadToR2(pngBuffer, createOwnedUploadName(userId, `auto-design-${runId}`, 'image/png'), 'image/png');

  const newDesign: DesignItem = {
    id: `design-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${hints.primaryNiche || template.name} · ${new Date().toLocaleDateString('tr-TR')}`,
    folderId: AUTOMATION_DESIGN_FOLDER.id,
    src: uploadResult.url,
    width: designWidth,
    height: designHeight,
    targetApparel: 'both',
    isProductionActive: false,
    createdAt: Date.now(),
    tags: [],
    generatedByAI: true,
    promptUsed: finalPrompt,
  };

  // Atomik ekleme: eşzamanlı çalıştırmalar birbirinin tasarımını silmez; updated_at değiştiği için
  // açık istemciler yeni tasarımı senkronla görür. Tasarımlar sekmesinde "Otomasyon Tasarımları"
  // klasöründe toplanır (klasör yoksa oluşturulur).
  const folderJson = JSON.stringify([AUTOMATION_DESIGN_FOLDER]);
  await db.insert(userWorkspaces)
    .values({ userId, designs: [newDesign], folders: [AUTOMATION_DESIGN_FOLDER], updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userWorkspaces.userId,
      set: {
        designs: drizzleSql`COALESCE(${userWorkspaces.designs}, '[]'::jsonb) || ${JSON.stringify([newDesign])}::jsonb`,
        folders: drizzleSql`CASE WHEN COALESCE(${userWorkspaces.folders}, '[]'::jsonb) @> ${JSON.stringify([{ id: AUTOMATION_DESIGN_FOLDER.id }])}::jsonb
          THEN ${userWorkspaces.folders} ELSE COALESCE(${userWorkspaces.folders}, '[]'::jsonb) || ${folderJson}::jsonb END`,
        updatedAt: new Date(),
      },
    });

  ctx.designPng = pngBuffer;
  steps.backgroundRemoval = { ...steps.backgroundRemoval, status: 'completed', completedAt: new Date().toISOString() };
  ctx.run = { ...ctx.run, generatedDesignId: newDesign.id, generatedDesignUrl: uploadResult.url };
  await persist({ steps, generatedDesignId: newDesign.id, generatedDesignUrl: uploadResult.url });
}

async function runNicheResearch(ctx: StepContext): Promise<StepResult> {
  const { template, userId, runId } = ctx;
  const hints = template.seoHints;
  if (hints?.nicheMode !== 'auto') throw new StepSkipped('Tasarım konusu şablonda belirlendi.');
  const taxonomyId = template.automationSchedule?.etsy?.taxonomyId;
  let categoryPath: string | null = null;
  if (taxonomyId) {
    const rows = await sql`SELECT path, name FROM etsy_taxonomy_cache WHERE id = ${taxonomyId} LIMIT 1`.catch(() => []);
    categoryPath = rows[0] ? String(rows[0].path || rows[0].name) : null;
  }
  const result = await researchNiche({
    userId,
    templateId: template.id,
    productType: hints?.productType || 'T-shirt',
    categoryPath,
    focus: hints?.researchFocus,
  });
  console.log('[Automation] Niche research', { runId, niche: result.niche, searchedWeb: result.searchedWeb });
  return { output: { ...result } };
}

async function runMockupRender(ctx: StepContext): Promise<StepResult> {
  const { run, template, userId, runId } = ctx;
  if (!run.generatedDesignUrl) throw new Error('Tasarım bulunamadı.');
  const design = ctx.designPng ?? await loadImageForUser(userId, run.generatedDesignUrl);
  const mockups = await loadWorkspaceMockups(userId);
  const plan = selectAutomationMockups(mockups, template.mockupConfig);
  if (plan.render.length === 0 && plan.statics.length === 0) {
    throw new StepSkipped('Şablonda kullanılabilir mockup yok (seçili mockup silinmiş veya kumaş filtresine uymuyor).');
  }

  const { renderDesignOnMockup } = await import('@/lib/backend-render');
  // Koyu kumaşlarda (siyah, lacivert…) tasarımın açık tonlu sürümü basılır; bir kez üretilir.
  let darkGarmentDesign: Buffer | null = null;
  const designFor = async (mockup: MockupItem): Promise<Buffer> => {
    if (!needsDarkGarmentDesign(mockup)) return design;
    if (!darkGarmentDesign) {
      try {
        const { recolorDesign } = await import('@/lib/recolor');
        darkGarmentDesign = (await recolorDesign(design, 'dark_garment')).pngBuffer;
      } catch (error) {
        console.warn('[Automation] Dark garment recolor failed; using original design.', error instanceof Error ? error.message : error);
        darkGarmentDesign = design;
      }
    }
    return darkGarmentDesign;
  };
  const urls: string[] = [];
  const failures: string[] = [];
  for (const [index, mockup] of plan.render.entries()) {
    try {
      let composite = await loadImageForUser(userId, mockup.src);
      const mockupDesign = await designFor(mockup);
      // Birden fazla baskı alanı varsa tasarım hepsine yerleştirilir.
      for (const area of mockup.printAreas) composite = await renderDesignOnMockup(composite, mockupDesign, area);
      const jpeg = await jpegForListing(composite);
      const upload = await uploadToR2(jpeg, createOwnedUploadName(userId, `auto-mockup-${runId}-${index + 1}`, 'image/jpeg'), 'image/jpeg');
      urls.push(upload.url);
    } catch (error) {
      failures.push(`${mockup.name || mockup.id}: ${error instanceof Error ? error.message : 'render hatası'}`);
    }
  }
  // Statik görseller (beden tablosu vb.) render edilmeden, kendi adresleriyle eklenir.
  urls.push(...plan.statics.map((m) => m.src));

  if (urls.length === 0) throw new Error(`Hiçbir mockup üretilemedi. ${failures.join('; ')}`);
  return {
    patch: { generatedMockupUrls: urls },
    output: { rendered: urls.length - plan.statics.length, static: plan.statics.length, videoMockup: plan.video?.id ?? null },
    warning: failures.length > 0 ? `${failures.length} mockup üretilemedi: ${failures.join('; ')}` : undefined,
  };
}

async function runVideo(ctx: StepContext): Promise<StepResult> {
  const { template, userId, runId } = ctx;
  const schedule = template.automationSchedule;
  if (!schedule?.generateVideo) {
    // AI videosu istenmiyorsa şablondaki video mockup'ı (varsa) ilana eklenir.
    const mockups = await loadWorkspaceMockups(userId);
    const video = selectAutomationMockups(mockups, template.mockupConfig).video;
    if (video) return { patch: { generatedVideoUrl: video.src }, output: { source: 'mockup', mockupId: video.id } };
    throw new StepSkipped('Video istenmedi.');
  }

  const config = await loadAIConfig();
  const { generateVideo, isOmniVideoModel } = await import('@/lib/ai-provider');
  const videoSettings = schedule.video;
  const hints = runHints(ctx);
  const seo = ctx.run.generatedSeo as GeneratedSeoData | null;

  // Talimat admin panelindeki video prompt'udur (boşsa gerçekçi ürün tanıtımı varsayılanı).
  const adminTemplate = (await loadPromptSetting('ai_prompt_generate_video')).trim();
  const prompt = adminTemplate
    ? fillVideoPromptTemplate(adminTemplate, {
        title: seo?.title || hints.primaryNiche || template.name,
        designPrompt: String((ctx.steps?.designGeneration?.output as { prompt?: unknown } | undefined)?.prompt || buildDesignPrompt(hints, 0)),
        product: hints.productType || 'T-shirt',
        niche: hints.primaryNiche || '',
      })
    : buildVideoPrompt({ style: 'mannequin' }, hints);

  // Referans görsel: tasarımın basıldığı ilk mockup — video bu ürünü gösterir.
  const firstMockupUrl = ((ctx.run.generatedMockupUrls as string[] | null) ?? [])[0];
  let image: { data: Buffer; mimeType: 'image/jpeg' } | undefined;
  if (firstMockupUrl) {
    try {
      image = { data: await jpegForListing(await loadImageForUser(userId, firstMockupUrl)), mimeType: 'image/jpeg' };
    } catch (error) {
      console.warn('[Automation] Reference image for video could not be loaded', error instanceof Error ? error.message : error);
    }
  }

  // Model admin panelinden seçilir; otomasyon yalnızca videonun yönünü belirler.
  const model = config.videoModel;
  const aspectRatio = videoSettings?.aspectRatio === '9:16' ? '9:16' : '16:9';
  let generated;
  try {
    generated = await generateVideo(config, { prompt, model, image, aspectRatio, maxWaitMs: VIDEO_MAX_WAIT_MS });
  } catch (error) {
    // Omni Flash: Gemini API'de GA adı, Vertex'te önizleme adı geçerli olabilir; diğeri denenir.
    const alternate = isOmniVideoModel(model) && /NOT_FOUND|404|not found|not supported/i.test(error instanceof Error ? error.message : '')
      ? (model.endsWith('-preview') ? model.replace(/-preview$/, '') : `${model}-preview`)
      : null;
    if (!alternate) throw error;
    generated = await generateVideo(config, { prompt, model: alternate, image, aspectRatio, maxWaitMs: VIDEO_MAX_WAIT_MS });
  }
  const url = await persistGeneratedVideo(userId, runId, generated.uri, config.googleApiKey);
  return { patch: { generatedVideoUrl: url }, output: { source: 'ai', model, referenceImage: Boolean(image) } };
}

async function runSeo(ctx: StepContext): Promise<StepResult> {
  const { template, userId, run } = ctx;
  if (template.automationSchedule?.createListing !== true) throw new StepSkipped('Kuru çalıştırma: SEO ve ilan adımları kapalı.');
  const hints = runHints(ctx);
  const research = ctx.steps?.nicheResearch?.output as NicheResearchOutput | undefined;
  const poolKeywords = await loadRelatedPoolKeywords(topicSearchTerms(hints));
  // Araştırmanın önerdiği arama ifadeleri havuz kelimelerinden önce gelir.
  const keywords = buildAutomationKeywords(hints, [...(research?.keywords ?? []), ...poolKeywords]);
  if (keywords.length === 0) throw new StepSkipped('Şablonda niş veya hedef kitle bilgisi yok; SEO üretilemedi.');

  const designPrompt = String((run.steps as AutomationRunSteps | null)?.designGeneration?.output?.prompt || buildDesignPrompt(hints, 0));
  const subject = detectPrimarySubject(`${hints?.primaryNiche || ''} ${designPrompt}`);
  const taxonomyId = template.automationSchedule?.etsy?.taxonomyId;
  // Mağaza bölümü elle seçilmediyse yapay zekâ mağazadaki bölümlerden en uygununu seçer.
  const shopSections = template.automationSchedule?.etsy?.shopSectionId ? [] : await loadShopSections(userId);
  const result = await generateListingContent(userId, {
    designDescription: designPrompt,
    keywords,
    productType: hints?.productType || undefined,
    userNotes: hints?.customNotes || undefined,
    primarySubject: subject?.subject || hints?.primaryNiche || undefined,
    taxonomyId,
    shopSections: shopSections.length > 0 ? shopSections : undefined,
  });
  const listing = result.listing as { title: string; description: string; selectedTags: string[]; shop_section_id?: unknown };
  const chosenSection = shopSections.find((s) => String(s.shop_section_id) === String(listing.shop_section_id ?? ''));
  const seo: GeneratedSeoData = {
    title: listing.title,
    description: listing.description,
    tags: listing.selectedTags,
    taxonomyId: taxonomyId ?? null,
    taxonomyProperties: {},
    keywords,
    shopSectionId: chosenSection ? String(chosenSection.shop_section_id) : null,
    shopSectionTitle: chosenSection?.title ?? null,
  };
  return { patch: { generatedSeo: seo }, output: { model: result.modelUsed, tagCount: seo.tags.length, shopSection: chosenSection?.title ?? null } };
}

async function runListing(ctx: StepContext): Promise<StepResult> {
  const { template, userId, run, runId } = ctx;
  const schedule = template.automationSchedule;
  if (schedule?.createListing !== true) throw new StepSkipped('Kuru çalıştırma: Etsy ilanı oluşturulmadı.');
  // Idempotency: aynı çalıştırma ikinci bir ilan açmaz.
  if (run.etsyListingId) return { output: { listingId: run.etsyListingId, reused: true } };

  const seo = run.generatedSeo as GeneratedSeoData | null;
  if (!seo?.title) throw new StepSkipped('SEO metni olmadığı için ilan açılmadı.');
  const etsy = schedule.etsy;
  if (!etsy?.shippingProfileId || !etsy.readinessStateId) {
    throw new StepSkipped('Şablonda kargo profili veya hazırlık süresi seçilmemiş; "Etsy İlanı" adımından seçin.');
  }
  const whoMadeError = validateWhoMade({ whoMade: etsy.whoMade, isSupply: false, whenMade: etsy.whenMade });
  if (whoMadeError) throw new Error(whoMadeError);

  const tokenRes = await getValidEtsyToken(userId);
  if (!tokenRes.success || !tokenRes.access_token || !tokenRes.shop_id) {
    throw new Error(tokenRes.error || 'Etsy mağaza bağlantısı bulunamadı.');
  }
  const tags = sanitizeEtsyTags(seo.tags);
  if (tags.length === 0) throw new Error('Geçerli etiket üretilemedi.');

  const photos = ((run.generatedMockupUrls as string[] | null) ?? []).map((url) => ({ url, isVideo: false }));
  if (photos.length === 0) throw new Error('İlana eklenecek görsel yok.');
  const media = run.generatedVideoUrl ? [...photos, { url: run.generatedVideoUrl, isVideo: true }] : photos;
  // Satışa kapalı satırlar da gönderilir: Etsy envanterde tüm beden × renk kombinasyonlarını ister.
  const variationRows = await resolveVariationRows(userId, template.variationConfig);
  const variations = variationRows.some((row) => row.enabled !== false)
    ? variationRows.map((row) => ({ size: row.size, color: row.color, price: row.price, quantity: row.quantity, sku: row.sku || undefined, enabled: row.enabled !== false }))
    : [];

  const draft = await createEtsyDraftListing(userId, {
    etsyAccessToken: tokenRes.access_token,
    etsyShopId: tokenRes.shop_id,
    etsyApiKey: tokenRes.api_key || process.env.ETSY_API_KEY,
    etsySharedSecret: tokenRes.shared_secret || process.env.ETSY_SHARED_SECRET,
  }, {
    title: seo.title,
    description: seo.description,
    validTags: tags,
    price: etsy.price,
    quantity: 999,
    taxonomyId: Number(etsy.taxonomyId),
    who_made: etsy.whoMade,
    when_made: etsy.whenMade,
    is_supply: false,
    shipping_profile_id: etsy.shippingProfileId,
    readiness_state_id: etsy.readinessStateId,
    return_policy_id: etsy.returnPolicyId,
    shop_section_id: etsy.shopSectionId || seo.shopSectionId || undefined,
    variations,
    images: media,
  });

  const blocking = draft.uploadErrors.filter((e) => !e.startsWith('Bilgi:'));
  await writeAuditLog({
    userId,
    action: 'automation.etsy_draft_listing.created',
    resourceType: 'etsy_listing',
    resourceId: String(draft.listingId),
    metadata: { runId, templateId: template.id, imagesUploaded: draft.imagesUploaded, imagesRequested: draft.imageItems.length, uploadErrorCount: blocking.length },
  });
  return {
    patch: { etsyListingId: String(draft.listingId), generatedListingId: String(draft.listingId) },
    output: { listingId: draft.listingId, listingUrl: draft.listingUrl, imagesUploaded: draft.imagesUploaded, imagesRequested: draft.imageItems.length },
    warning: blocking.length > 0 ? `İlan taslak olarak açıldı ancak ${blocking.length} işlem tamamlanamadı: ${blocking.slice(0, 3).join(' ')}` : undefined,
  };
}

const STEP_RUNNERS: Partial<Record<AutomationStepName, (ctx: StepContext) => Promise<StepResult>>> = {
  nicheResearch: runNicheResearch,
  mockupRender: runMockupRender,
  videoGeneration: runVideo,
  seoGeneration: runSeo,
  listingCreation: runListing,
};

// ─── Çalıştırıcı ─────────────────────────────────────────────────────────────

export async function executeAutomationRun({ runId, templateId, userId }: AutomationRunInput): Promise<AutomationRunOutcome> {
  const [template] = await db
    .select()
    .from(podTemplates)
    .where(and(eq(podTemplates.id, templateId), eq(podTemplates.userId, userId)));

  const [existing] = await db
    .select()
    .from(automationRuns)
    .where(and(eq(automationRuns.id, runId), eq(automationRuns.userId, userId)));

  if (!template || !existing) return { ok: false, runId, reason: 'not_found' };

  // Aynı run'ın iki kez çalıştırılmasını engelle: yalnızca 'pending' durumundaki kayıt 'running'e geçebilir.
  const claimed = await db
    .update(automationRuns)
    .set({ status: 'running', startedAt: drizzleSql`COALESCE(${automationRuns.startedAt}, NOW())`, updatedAt: new Date() })
    .where(and(eq(automationRuns.id, runId), eq(automationRuns.status, 'pending')))
    .returning();
  if (claimed.length === 0) return { ok: false, runId, reason: 'not_pending' };

  const steps = { ...(claimed[0].steps as AutomationRunSteps) };
  const ctx: StepContext = { run: claimed[0], template, userId, runId, deadline: Date.now() + INVOCATION_BUDGET_MS, steps };
  const persist = async (patch: Partial<RunRow>) => {
    await db.update(automationRuns).set({ ...patch, updatedAt: new Date() }).where(eq(automationRuns.id, runId));
    ctx.run = { ...ctx.run, ...patch };
  };
  const isCancelled = async () => {
    const [row] = await db.select({ status: automationRuns.status }).from(automationRuns).where(eq(automationRuns.id, runId));
    return row?.status === 'cancelled';
  };

  let ranAnyStep = false;
  try {
    for (let step = nextPendingStep(steps); step; step = nextPendingStep(steps)) {
      if (ranAnyStep && await isCancelled()) return { ok: false, runId, reason: 'cancelled' };

      // Süre bütçesi: yeni adıma başlamadan önce kontrol et; video ayrıca uzun bir pencere ister.
      const remaining = ctx.deadline + (300_000 - INVOCATION_BUDGET_MS) - Date.now();
      const needsLongWindow = step === 'videoGeneration' && template.automationSchedule?.generateVideo === true;
      if (ranAnyStep && (Date.now() > ctx.deadline || (needsLongWindow && remaining < VIDEO_MIN_REMAINING_MS))) {
        if (await isCancelled()) return { ok: false, runId, reason: 'cancelled' };
        await persist({ status: 'pending', steps });
        return { ok: true, runId, resumed: true };
      }
      ranAnyStep = true;

      steps[step] = { status: 'running', startedAt: new Date().toISOString() };
      await persist({ steps });

      if (step === 'designGeneration' || step === 'backgroundRemoval') {
        // Tasarım ve arka plan kaldırma tek birimdir: ara çıktı (perde arka planlı görsel) saklanmaz.
        steps.designGeneration = { status: 'running', startedAt: new Date().toISOString() };
        await runDesignSteps(ctx, steps, persist);
        continue;
      }

      const runner = STEP_RUNNERS[step];
      try {
        const result = runner ? await runner(ctx) : {};
        steps[step] = {
          ...steps[step],
          status: 'completed',
          completedAt: new Date().toISOString(),
          ...(result.output || result.warning ? { output: { ...result.output, ...(result.warning ? { warning: result.warning } : {}) } } : {}),
        };
        await persist({ ...(result.patch ?? {}), steps });
      } catch (error) {
        const skipped = error instanceof StepSkipped;
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
        if (!skipped) console.error(`[Automation] Step ${step} failed`, { runId, message });
        steps[step] = { ...steps[step], status: skipped ? 'skipped' : 'failed', completedAt: new Date().toISOString(), error: message.slice(0, 500) };
        await persist({ steps });
        // Görsel üretilemezse sonraki adımların anlamı yok.
        if (!skipped && step === 'mockupRender') {
          for (const later of AUTOMATION_STEP_ORDER.slice(AUTOMATION_STEP_ORDER.indexOf(step) + 1)) {
            if (!isStepDone(steps[later]?.status)) steps[later] = { status: 'skipped', error: 'Önceki adım başarısız olduğu için atlandı.' };
          }
        }
        if (!skipped && step === 'seoGeneration' && !isStepDone(steps.listingCreation?.status)) {
          steps.listingCreation = { status: 'skipped', error: 'SEO metni üretilemediği için ilan açılmadı.' };
        }
      }
    }

    // Son adım sürerken iptal edildiyse 'cancelled' durumu korunur (üzerine 'completed' yazılmaz).
    if (await isCancelled()) {
      await persist({ steps });
      return { ok: false, runId, reason: 'cancelled' };
    }
    const outcome = deriveRunOutcome(steps);
    await persist({ status: outcome.status, errorMessage: outcome.errorMessage, completedAt: new Date(), steps });
    await db.update(podTemplates)
      .set({
        lastRunAt: new Date(),
        ...(outcome.status === 'completed' ? { totalListingsGenerated: drizzleSql`COALESCE(${podTemplates.totalListingsGenerated}, 0) + 1` } : {}),
      })
      .where(eq(podTemplates.id, templateId))
      .catch((error: unknown) => console.error('[Automation] Template stats update failed', error));

    return outcome.status === 'completed' ? { ok: true, runId } : { ok: false, runId, reason: 'failed', error: outcome.errorMessage ?? undefined };
  } catch (error) {
    console.error('[Automation] Run failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    for (const name of AUTOMATION_STEP_ORDER) {
      if (steps[name]?.status === 'running') steps[name] = { ...steps[name], status: 'failed', completedAt: new Date().toISOString(), error: message.slice(0, 500) };
    }
    await persist({ status: 'failed', errorMessage: message.slice(0, 1000), completedAt: new Date(), steps })
      .catch((dbError: unknown) => console.error('[Automation] Failed to persist failure state', dbError));
    return { ok: false, runId, reason: 'failed', error: message };
  }
}

/**
 * Uzun süredir ilerlemeyen çalıştırmaları 'failed' olarak işaretler. Ölçüt son güncelleme zamanıdır:
 * adım adım ilerleyen (devam ettirilen) bir çalıştırma, toplam süresi uzun olsa da kapatılmaz.
 */
export async function failStaleAutomationRuns(olderThanMinutes = 30, filter: { templateId?: string } = {}): Promise<number> {
  const rows = filter.templateId
    ? await sql`
        UPDATE automation_runs
        SET status = 'failed', error_message = 'Zaman aşımı: çalıştırma tamamlanamadı.', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE status IN ('running', 'pending') AND template_id = ${filter.templateId}
          AND COALESCE(updated_at, started_at, created_at) < CURRENT_TIMESTAMP - make_interval(mins => ${olderThanMinutes}::int)
        RETURNING id
      `
    : await sql`
        UPDATE automation_runs
        SET status = 'failed', error_message = 'Zaman aşımı: çalıştırma tamamlanamadı.', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE status IN ('running', 'pending')
          AND COALESCE(updated_at, started_at, created_at) < CURRENT_TIMESTAMP - make_interval(mins => ${olderThanMinutes}::int)
        RETURNING id
      `;
  return rows.length;
}

/** Bekleyen (yeni ya da yarıda kalmış) ve bir süredir dokunulmamış çalıştırmalar: zamanlayıcı bunları sürdürür. */
export async function findResumableRuns(idleSeconds = 60, limit = 10): Promise<AutomationRunInput[]> {
  const rows = await sql`
    SELECT id, template_id, user_id FROM automation_runs
    WHERE status = 'pending'
      AND COALESCE(updated_at, created_at) < CURRENT_TIMESTAMP - make_interval(secs => ${idleSeconds}::int)
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ runId: String(row.id), templateId: String(row.template_id), userId: String(row.user_id) }));
}

/** Kullanıcının çalıştırmasını iptal eder. Süren adım tamamlanır, sonraki adımlar başlatılmaz. */
export async function cancelAutomationRun(runId: string, userId: string): Promise<boolean> {
  const rows = await db
    .update(automationRuns)
    .set({ status: 'cancelled', errorMessage: 'Kullanıcı tarafından iptal edildi.', completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(automationRuns.id, runId), eq(automationRuns.userId, userId), inArray(automationRuns.status, ['pending', 'running'])))
    .returning({ id: automationRuns.id });
  return rows.length > 0;
}

const INITIAL_STEPS: AutomationRunSteps = {
  nicheResearch: { status: 'pending' },
  designGeneration: { status: 'pending' },
  backgroundRemoval: { status: 'pending' },
  mockupRender: { status: 'pending' },
  videoGeneration: { status: 'pending' },
  seoGeneration: { status: 'pending' },
  listingCreation: { status: 'pending' },
};

export type CreateRunResult =
  | { ok: true; runId: string }
  | { ok: false; reason: 'not_found' | 'inactive' | 'already_running'; runId?: string };

/** Bir şablon için 'pending' durumunda yeni bir çalıştırma kaydı oluşturur. */
export async function createAutomationRun(input: {
  templateId: string;
  userId: string;
  triggerType: 'manual' | 'scheduled';
  allowConcurrent?: boolean;
}): Promise<CreateRunResult> {
  const [template] = await db
    .select({ id: podTemplates.id, isActive: podTemplates.isActive })
    .from(podTemplates)
    .where(and(eq(podTemplates.id, input.templateId), eq(podTemplates.userId, input.userId)));
  if (!template) return { ok: false, reason: 'not_found' };
  if (!template.isActive) return { ok: false, reason: 'inactive' };

  if (!input.allowConcurrent) {
    const [activeRun] = await db
      .select({ id: automationRuns.id })
      .from(automationRuns)
      .where(and(
        eq(automationRuns.templateId, input.templateId),
        eq(automationRuns.userId, input.userId),
        inArray(automationRuns.status, ['pending', 'running']),
      ))
      .limit(1);
    if (activeRun) return { ok: false, reason: 'already_running', runId: activeRun.id };
  }

  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await db.insert(automationRuns).values({
    id: runId,
    templateId: input.templateId,
    userId: input.userId,
    status: 'pending',
    steps: INITIAL_STEPS,
    triggerType: input.triggerType,
  });
  return { ok: true, runId };
}

/**
 * Bekleyen çalıştırmayı işletir. INTERNAL_API_TOKEN tanımlıysa her çalıştırma (ve her devam)
 * `/api/automation/execute` üzerinden kendi fonksiyon çağrısında, kendi süre sınırıyla çalışır;
 * tanımlı değilse aynı süreç içinde çalıştırılır ve yarıda kalan kısım takip/zamanlayıcı ile sürdürülür.
 */
export async function dispatchAutomationRun(input: AutomationRunInput, appOrigin: string): Promise<void> {
  const token = getConfiguredSecret('INTERNAL_API_TOKEN');
  if (!token) {
    await executeAutomationRun(input);
    return;
  }
  try {
    const res = await fetch(new URL('/api/automation/execute', appOrigin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
      body: JSON.stringify(input),
    });
    if (!res.ok && res.status !== 409) {
      console.error('[Automation] Execute dispatch failed', { runId: input.runId, status: res.status });
    }
  } catch (error) {
    console.error('[Automation] Execute dispatch error', { runId: input.runId, error: error instanceof Error ? error.message : error });
  }
}

/**
 * Bir çalıştırmayı başlatır ve süre bütçesi dolduğunda (iç token varsa) yeni bir çağrıyla sürdürür.
 * İç token yoksa yarıda kalan çalıştırma, kullanıcının takip isteği veya saatlik zamanlayıcıyla devam eder.
 */
export async function runAndContinue(input: AutomationRunInput, appOrigin: string): Promise<void> {
  const outcome = await executeAutomationRun(input);
  if (outcome.ok && outcome.resumed && getConfiguredSecret('INTERNAL_API_TOKEN')) {
    await dispatchAutomationRun(input, appOrigin);
  }
}
