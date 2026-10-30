import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Bellek içi sahte veritabanı (yalnızca çalıştırıcının kullandığı zincirler) ──────────────
const state = vi.hoisted(() => ({
  run: null as Record<string, unknown> | null,
  template: null as Record<string, unknown> | null,
  mockups: [] as unknown[],
}));

vi.mock('@/db/schema', () => ({
  automationRuns: { __t: 'runs', status: 'status', startedAt: 'startedAt', id: 'id' },
  podTemplates: { __t: 'templates', totalListingsGenerated: 'total' },
  userWorkspaces: { __t: 'workspaces', designs: 'designs', userId: 'userId', mockups: 'mockups' },
}));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
  inArray: (...args: unknown[]) => args,
  lt: (...args: unknown[]) => args,
  or: (...args: unknown[]) => args,
  sql: () => ({ __sql: true }),
}));
vi.mock('@/lib/db', () => {
  const table = (t: { __t: string }) => t.__t;
  const db = {
    select: () => ({
      from: (t: { __t: string }) => ({
        where: () => {
          const name = table(t);
          const rows = name === 'runs' ? [state.run] : name === 'templates' ? [state.template] : [{ mockups: state.mockups }];
          const result = Promise.resolve(rows.filter(Boolean)) as Promise<unknown[]> & { limit: () => Promise<unknown[]> };
          result.limit = () => result;
          return result;
        },
      }),
    }),
    update: (t: { __t: string }) => ({
      set: (patch: Record<string, unknown>) => ({
        where: () => {
          const apply = () => {
            if (table(t) !== 'runs' || !state.run) return [];
            // Sahiplenme: yalnızca 'pending' kayıt 'running'e geçebilir.
            if (patch.status === 'running' && state.run.status !== 'pending') return [];
            state.run = { ...state.run, ...patch };
            return [state.run];
          };
          const result = Promise.resolve().then(apply) as Promise<unknown> & { returning: () => Promise<unknown[]>; catch: Promise<unknown>['catch'] };
          result.returning = () => Promise.resolve(apply());
          return result;
        },
      }),
    }),
    insert: () => ({ values: () => ({ onConflictDoUpdate: async () => undefined }) }),
  };
  return { db, sql: vi.fn(async () => []) };
});

vi.mock('@/lib/ai-provider', () => ({
  loadAIConfig: vi.fn(async () => ({ googleApiKey: 'k', videoModel: 'veo-admin' })),
  generateImage: vi.fn(async () => [{ data: 'aGVsbG8=' }]),
  generateVideo: vi.fn(async () => ({ uri: 'data:video/mp4;base64,AAAA', mimeType: 'video/mp4' })),
  isOmniVideoModel: (m: string) => m.startsWith('gemini-omni'),
}));
const recolor = vi.hoisted(() => vi.fn(async () => ({ pngBuffer: Buffer.from('dark-ink') })));
vi.mock('@/lib/recolor', () => ({ recolorDesign: recolor }));
vi.mock('@/lib/chroma-key', () => ({ removeChromaBackground: vi.fn(async () => ({ pngBuffer: Buffer.from('png'), width: 2048, height: 2048 })) }));
vi.mock('@/lib/background-removal', () => ({ removeVariantBackground: vi.fn(async () => ({ pngBuffer: Buffer.from('ai-variant'), width: 2048, height: 2048 })) }));
vi.mock('@/lib/r2', () => ({
  isR2Configured: () => true,
  uploadToR2: vi.fn(async (_b: Buffer, key: string) => ({ url: `/api/r2/${key}`, key, size: 1 })),
  deleteFromR2: vi.fn(async () => ({ deletedCount: 1 })),
}));
vi.mock('@/lib/upload-security', () => ({ createOwnedUploadName: (u: string, n: string) => `user-${u}-${n}` }));
const listingDefaults = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));
vi.mock('@/lib/user-settings', async () => {
  const { normalizeListingDefaults } = await import('@/lib/listing-defaults');
  return { loadListingDefaults: vi.fn(async () => ({ ...normalizeListingDefaults(listingDefaults.value), saved: Boolean(listingDefaults.value) })) };
});
vi.mock('@/lib/app-settings', () => ({ loadSetting: vi.fn(async () => ''), loadSettings: vi.fn(async () => ({})) }));
vi.mock('@/lib/internal-auth', () => ({ getConfiguredSecret: () => undefined }));
vi.mock('@/lib/media-source', () => ({ loadImageForUser: vi.fn(async () => Buffer.from('img')) }));
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/backend-render', () => ({ renderDesignOnMockup: vi.fn(async () => Buffer.from('composite')) }));
vi.mock('sharp', () => ({ default: () => ({ flatten: () => ({ jpeg: () => ({ toBuffer: async () => Buffer.from('jpeg') }) }) }) }));
vi.mock('@/lib/etsy-token-manager', () => ({
  getValidEtsyToken: vi.fn(async () => ({ success: true, access_token: 'tok', shop_id: '42', api_key: 'key' })),
}));
const createDraft = vi.hoisted(() => vi.fn(async () => ({
  listingId: 777, listingUrl: 'https://etsy/l/777', variationsUpdated: true, imagesUploaded: 2, imageItems: ['a', 'b'], videoItems: [], uploadErrors: [],
})));
vi.mock('@/lib/etsy-listing-service', () => ({ createEtsyDraftListing: createDraft }));
const generateListing = vi.hoisted(() => vi.fn(async () => ({
  listing: {
    title: 'Funny Cat Mom Shirt', description: 'Great shirt.', selectedTags: ['cat mom', 'funny cat'],
    taxonomy_properties_values: [{ property_id: 1, value_ids: [10, 11] }, { property_id: 999, value_ids: [1] }],
    materials: ['Cotton'], styles: ['Minimalist'],
    image_alt_texts: ['Black tee with a funny cat print', 'Size chart'],
  },
  modelUsed: 'test-model',
})));
vi.mock('@/lib/listing-generator', () => ({ generateListingContent: generateListing }));
// Değerlendirme ve düzeltme turu ayrı test edilir (listing-pipeline); burada yalnızca üretici çağrılır.
vi.mock('@/lib/listing-pipeline', () => ({
  generateBestListing: vi.fn(async (userId: string, input: Record<string, unknown>) => {
    const { design: _design, storeFacts: _facts, ...generatorInput } = input;
    void _design; void _facts;
    const generate = generateListing as unknown as (...args: unknown[]) => Promise<Record<string, unknown>>;
    return { ...(await generate(userId, generatorInput)), evaluation: { score: 90 }, aiReview: null, attempts: 1 };
  }),
}));
vi.mock('@/lib/listing-copy', () => ({ loadStoreCopyFacts: vi.fn(async () => 'None provided') }));
vi.mock('@/lib/listing-category', () => ({ loadFolderCategory: vi.fn(async () => null), pickListingCategory: vi.fn(async () => null) }));
vi.mock('@/lib/etsy-taxonomy-properties', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/etsy-taxonomy-properties')>()),
  fetchTaxonomyProperties: vi.fn(async () => [
    { property_id: 1, name: 'Sleeve length', possible_values: [{ value_id: 10, name: 'Short sleeve' }, { value_id: 11, name: 'Long sleeve' }] },
    { property_id: 200, name: 'Primary color', possible_values: [{ value_id: 1, name: 'Black' }] },
  ]),
}));
const research = vi.hoisted(() => vi.fn(async () => ({
  niche: 'retro camping dad', targetAudience: 'outdoorsy dads', style: 'vintage distressed', designBrief: 'Retro sunset over a tent.',
  occasion: "Father's Day", keywords: ['camping dad shirt'], reasoning: 'Babalar günü yaklaşıyor.', sources: [], searchedWeb: true, model: 'm',
})));
vi.mock('@/lib/niche-research', () => ({ researchNiche: research }));
// Tasarımın görsel analizi varsayılan olarak kullanılamaz (null); ilgili testte etkinleştirilir.
const designVision = vi.hoisted(() => vi.fn(async (): Promise<unknown> => { throw new Error('vision disabled in tests'); }));
vi.mock('@/lib/design-vision', () => ({ analyzeDesignImage: designVision }));
const poolScore = vi.hoisted(() => vi.fn(async () => ({ evaluated: [], competitorTags: [], pending: [], scraped: 0 })));
vi.mock('@/lib/keyword-pool', () => ({ KEYWORD_MAX_SCORE_AGE_DAYS: 14, scoreKeywords: poolScore }));
vi.mock('@/lib/scraper-credentials', () => ({ loadScraperCredentials: vi.fn(async () => ({ scrapingApiKey: '', scrapingProvider: 'scraperapi' })) }));
// Etsy mağaza bölümleri ağ isteği yapılmadan boş döner.
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));

import { executeAutomationRun } from './automation-runner';

const pendingSteps = () => ({
  designGeneration: { status: 'pending' },
  backgroundRemoval: { status: 'pending' },
  mockupRender: { status: 'pending' },
  videoGeneration: { status: 'pending' },
  seoGeneration: { status: 'pending' },
  listingCreation: { status: 'pending' },
});

const baseTemplate = (schedule: Record<string, unknown> = {}) => ({
  id: 't1',
  userId: 'u1',
  name: 'Kedi',
  isActive: true,
  totalListingsGenerated: 0,
  seoHints: { primaryNiche: 'Funny Cat', targetAudience: 'cat moms', productType: 'T-Shirt', customNotes: '' },
  mockupConfig: { printAreaMockupIds: ['m1'], staticMockupIds: ['chart'], videoMockupIds: [], fabricType: 'all', multiPrintAreaSupport: false },
  variationConfig: { rows: [{ id: 'r', size: 'M', color: 'Black', price: 25, quantity: 10, sku: '', enabled: true }], sizes: [], colors: [] },
  automationSchedule: {
    enabled: false, cronExpression: '0 9 * * *', timezone: 'UTC', nextRunAt: null, listingsPerRun: 1, publishMode: 'draft',
    createListing: true,
    listingMode: 'draft',
    etsy: {
      shippingProfileId: '11', readinessStateId: '22', taxonomyId: 482, price: 24.99, whoMade: 'i_did', whenMade: 'made_to_order',
      productionPartnerIds: ['5'], shouldAutoRenew: true, itemWeight: 6, itemWeightUnit: 'oz',
    },
    ...schedule,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  state.run = { id: 'run1', templateId: 't1', userId: 'u1', status: 'pending', steps: pendingSteps(), generatedMockupUrls: [], etsyListingId: null };
  state.template = baseTemplate();
  state.mockups = [
    { id: 'm1', name: 'Light', src: '/api/r2/user-u1-m1.png', apparelType: 'light', printAreas: [{ id: 'a', x: 10, y: 10, width: 30, height: 30 }], width: 1000, height: 1000 },
    { id: 'chart', name: 'Chart', src: '/api/r2/user-u1-chart.png', apparelType: 'any', printAreas: [], hasPrintArea: false, width: 1000, height: 1000 },
  ];
});

describe('executeAutomationRun', () => {
  it('runs the full pipeline and creates exactly one draft listing', async () => {
    const outcome = await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });
    expect(outcome).toEqual({ ok: true, runId: 'run1' });
    expect(state.run?.status).toBe('completed');
    expect(state.run?.etsyListingId).toBe('777');
    // Kategori özellikleri: yapay zekânın seçimi doğrulanıp (bilinmeyen/renk atılır) taslağa yazılır.
    const draftInput = (createDraft.mock.calls[0] as unknown as [unknown, unknown, Record<string, unknown>])[2];
    expect(draftInput.taxonomy_properties_values).toEqual({ '1': [10] });
    expect(draftInput.materials).toEqual(['Cotton']);
    // Mağaza ayarları ve yapay zekânın fotoğraf alt metinleri ilana aktarılır.
    expect(draftInput).toMatchObject({ production_partner_id: ['5'], should_auto_renew: true, item_weight: 6, item_weight_unit: 'oz' });
    expect((draftInput.images as Array<{ altText?: string }>).map((i) => i.altText)).toEqual(['Black tee with a funny cat print', 'Size chart']);
    const listingImages = (generateListing.mock.calls[0] as unknown as [unknown, { images?: string[] }])[1].images;
    expect(listingImages).toHaveLength(2);
    expect(listingImages?.[0]).toContain('mockup with the design');
    expect(listingImages?.[1]).toContain('static info image');
    const listingInput = (generateListing.mock.calls[0] as unknown as [unknown, { taxonomyProperties?: Array<{ property_id: number }> }])[1];
    expect(listingInput.taxonomyProperties?.map((p) => p.property_id)).toEqual([1]);
    const steps = state.run?.steps as Record<string, { status: string }>;
    expect(steps.mockupRender.status).toBe('completed');
    expect(steps.videoGeneration.status).toBe('skipped'); // video istenmedi
    expect(steps.listingCreation.status).toBe('completed');

    expect(createDraft).toHaveBeenCalledTimes(1);
    const [, , input] = createDraft.mock.calls[0] as unknown as [string, unknown, { images: Array<{ url: string }>; variations: unknown[]; shipping_profile_id: string }];
    expect(input.images.map((m) => m.url)).toEqual(['/api/r2/user-u1-auto-mockup-run1-1', '/api/r2/user-u1-chart.png']);
    expect(input.variations).toHaveLength(1);
    expect(input.shipping_profile_id).toBe('11');
    // İlan, tasarım adımında üretilen SKU ile açılır; ham görsel arka plan kaldırmadan sonra silinir.
    const designOutput = (state.run?.steps as Record<string, { output?: { sku?: string; rawUrl?: string } }>).designGeneration.output;
    expect(designOutput?.sku).toMatch(/^[A-Z]{3}-\d{6}-[2-9A-Z]{4}$/);
    expect((input as unknown as { sku?: string }).sku).toBe(designOutput?.sku);
    const { deleteFromR2 } = await import('@/lib/r2');
    expect(vi.mocked(deleteFromR2)).toHaveBeenCalledWith([designOutput?.rawUrl]);
    // 4K ham çıktı genel 20 MB görsel sınırına takılmadan okunur.
    const { loadImageForUser } = await import('@/lib/media-source');
    const rawLoad = vi.mocked(loadImageForUser).mock.calls.find((call) => call[1] === designOutput?.rawUrl);
    expect(rawLoad?.[2]?.maxBytes).toBeGreaterThan(20 * 1024 * 1024);
  });

  it('review mode keeps the listing in the review queue instead of sending it to Etsy', async () => {
    state.template = baseTemplate({ listingMode: 'review' });
    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });
    expect(createDraft).not.toHaveBeenCalled();
    const listing = (state.run?.steps as Record<string, { status: string; output?: { review?: { status: string } } }>).listingCreation;
    expect(listing.status).toBe('completed');
    expect(listing.output?.review?.status).toBe('awaiting');
    expect(state.run?.status).toBe('completed');
  });

  it('does not open a second listing when a resumed run already has one', async () => {
    state.run = {
      ...state.run!,
      etsyListingId: '555',
      generatedSeo: { title: 'x', description: 'y', tags: ['a'] },
      generatedMockupUrls: ['/api/r2/user-u1-x.jpg'],
      steps: { ...pendingSteps(), designGeneration: { status: 'completed' }, backgroundRemoval: { status: 'completed' }, mockupRender: { status: 'completed' }, videoGeneration: { status: 'skipped' }, seoGeneration: { status: 'completed' } },
    };
    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });
    expect(createDraft).not.toHaveBeenCalled();
    expect(state.run?.status).toBe('completed');
  });

  it('dry run skips SEO and listing creation', async () => {
    state.template = baseTemplate({ createListing: false });
    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });
    const steps = state.run?.steps as Record<string, { status: string }>;
    expect(steps.seoGeneration.status).toBe('skipped');
    expect(steps.listingCreation.status).toBe('skipped');
    expect(generateListing).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
    expect(state.run?.status).toBe('completed');
  });

  it('skips the listing with a clear reason when shipping settings are missing', async () => {
    state.template = baseTemplate({ etsy: { shippingProfileId: '', readinessStateId: '', taxonomyId: 482, price: 20, whoMade: 'i_did', whenMade: 'made_to_order' } });
    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });
    const listing = (state.run?.steps as Record<string, { status: string; error?: string }>).listingCreation;
    expect(listing.status).toBe('skipped');
    expect(listing.error).toMatch(/kargo profili/i);
    expect(createDraft).not.toHaveBeenCalled();
  });

  it('fills missing shipping settings from the user listing defaults; variations only come from templates', async () => {
    listingDefaults.value = {
      etsy: { shippingProfileId: '77', readinessStateId: '88' },
      variations: { sizes: ['M', 'L'], colors: ['Black'], basePrice: 25, sizePrices: {}, quantity: 10 },
    };
    state.template = baseTemplate({ etsy: { shippingProfileId: '', readinessStateId: '', taxonomyId: 482, price: 20, whoMade: 'i_did', whenMade: 'made_to_order' } });
    (state.template as Record<string, unknown>).variationConfig = { rows: [] };
    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });
    listingDefaults.value = null;
    const [, , input] = createDraft.mock.calls[0] as unknown as [string, unknown, { shipping_profile_id: string; readiness_state_id: string; variations: Array<{ size: string }> }];
    expect(input).toMatchObject({ shipping_profile_id: '77', readiness_state_id: '88' });
    // Şablonda varyasyon yoksa ilan tek fiyatla açılır (eski varsayılan varyasyonlar kullanılmaz).
    expect(input.variations ?? []).toEqual([]);
  });

  it('analyzes the generated design and leads the listing keywords with its best-scoring keywords', async () => {
    designVision.mockResolvedValueOnce({
      description: 'A ghost in a leopard hat holding coffee', keywords: ['spooky ghost', 'leopard ghost', 'fall vibes'],
      primarySubject: 'ghost', primaryAesthetic: 'retro', niche: 'ghost (retro)', userNotes: '', productType: 'T-shirt', taxonomyId: null,
    });
    poolScore.mockResolvedValueOnce({
      evaluated: [{ id: '1', keyword: 'leopard ghost', opportunity_score: 80 }, { id: '2', keyword: 'spooky ghost', opportunity_score: 20 }],
      competitorTags: ['halloween shirt'], pending: ['fall vibes'], scraped: 2,
    } as never);
    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });
    const [, listingInput] = generateListing.mock.calls[0] as unknown as [string, { keywords: string[]; designDescription: string; primarySubject?: string }];
    expect(listingInput.designDescription).toBe('A ghost in a leopard hat holding coffee');
    expect(listingInput.primarySubject).toBe('ghost');
    expect(listingInput.keywords).toEqual(expect.arrayContaining(['leopard ghost', 'spooky ghost', 'halloween shirt']));
    expect(listingInput.keywords.indexOf('leopard ghost')).toBeLessThan(listingInput.keywords.indexOf('spooky ghost'));
    const seoOutput = (state.run?.steps as Record<string, { output?: Record<string, unknown> }>).seoGeneration.output;
    expect(seoOutput?.designAnalysis).toEqual({ keywords: 3, scored: 2, pending: 1 });
  });

  it('refuses to run a record that is not pending', async () => {
    state.run = { ...state.run!, status: 'running' };
    const outcome = await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });
    expect(outcome).toMatchObject({ ok: false, reason: 'not_pending' });
  });

  it('marks the run failed when Etsy rejects the listing', async () => {
    createDraft.mockRejectedValueOnce(new Error('Etsy reddetti: geçersiz kategori'));
    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });
    expect(state.run?.status).toBe('failed');
    expect(state.run?.errorMessage).toBe('Etsy reddetti: geçersiz kategori');
  });
});

describe('manual production listing', () => {
  it('writes the listing text for uploaded mockups and puts it in the review queue without a template', async () => {
    const { generateImage } = await import('@/lib/ai-provider');
    state.template = null; // manuel ilanın şablonu yoktur
    state.run = {
      ...state.run!,
      templateId: 'manual',
      generatedMockupUrls: ['/api/r2/user-u1-m1.webp', '/api/r2/user-u1-m2.webp'],
      generatedDesignUrl: '/api/r2/user-u1-design.png',
      steps: {
        nicheResearch: { status: 'skipped', output: { niche: 'lady electrician', keywords: ['electrician gift'] } },
        designGeneration: { status: 'completed', output: { prompt: 'Vintage botanical wire cutters', sku: 'TSH-261029-ABCD' } },
        backgroundRemoval: { status: 'completed', output: { sku: 'TSH-261029-ABCD' } },
        mockupRender: {
          status: 'completed',
          output: {
            photos: ['white tee', 'black tee'],
            listingSettings: {
              etsy: { shippingProfileId: '11', readinessStateId: '22', taxonomyId: 482, price: 24.99, whoMade: 'i_did', whenMade: 'made_to_order' },
              variations: [{ id: 'm-black', size: 'M', color: 'Black', price: 24.99, quantity: 999, sku: '', enabled: true }],
              productType: 'T-shirt', subject: 'lady electrician',
            },
          },
        },
        videoGeneration: { status: 'skipped' },
        seoGeneration: { status: 'pending' },
        listingCreation: { status: 'pending' },
      },
    };
    const outcome = await executeAutomationRun({ runId: 'run1', templateId: 'manual', userId: 'u1' });
    expect(outcome).toEqual({ ok: true, runId: 'run1' });
    const steps = state.run?.steps as Record<string, { status: string; output?: { review?: { status: string } } }>;
    expect(steps.seoGeneration.status).toBe('completed');
    expect(steps.listingCreation.output?.review?.status).toBe('awaiting');
    expect(createDraft).not.toHaveBeenCalled(); // Etsy'ye değil Hazır İlanlar'a
    expect(vi.mocked(generateImage)).not.toHaveBeenCalled();
    const listingInput = (generateListing.mock.calls[0] as unknown as [unknown, { images?: string[]; primarySubject?: string }])[1];
    expect(listingInput.images).toEqual(['white tee', 'black tee']);
  });
});

describe('resuming a run cut off by the function time limit', () => {
  it('continues the interrupted design step without regenerating the stored design', async () => {
    const { generateImage } = await import('@/lib/ai-provider');
    state.run = {
      ...state.run!,
      steps: {
        ...pendingSteps(),
        designGeneration: {
          status: 'running', attempts: 1,
          output: { prompt: 'p', finalPrompt: 'fp', keyBackground: 'green', sku: 'TSH-261029-ABCD', rawUrl: '/api/r2/user-u1-auto-raw-run1', rawMimeType: 'image/png' },
        },
      },
    };
    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });
    const steps = state.run?.steps as Record<string, { status: string; attempts?: number; output?: { sku?: string } }>;
    expect(steps.designGeneration).toMatchObject({ status: 'completed', attempts: 2 });
    expect(steps.backgroundRemoval.output?.sku).toBe('TSH-261029-ABCD');
    // Ana tasarım tekrar üretilmez (yalnızca SEO/ilan gibi görsel dışı adımlar çalışır).
    expect(vi.mocked(generateImage)).not.toHaveBeenCalled();
  });

  it('gives up on a step that keeps getting cut off', async () => {
    state.run = { ...state.run!, steps: { ...pendingSteps(), designGeneration: { status: 'running', attempts: 3 } } };
    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });
    const steps = state.run?.steps as Record<string, { status: string; error?: string }>;
    expect(steps.designGeneration.status).toBe('failed');
    expect(steps.designGeneration.error).toMatch(/zaman aşımı/);
    expect(steps.mockupRender.status).toBe('skipped');
    expect(state.run?.status).toBe('failed');
  });
});

describe('cancellation', () => {
  it('keeps the cancelled status when the user cancels during the last step', async () => {
    state.template = baseTemplate({ createListing: false });
    // Kullanıcı mockup adımı sürerken iptal eder.
    const { renderDesignOnMockup } = await import('@/lib/backend-render');
    vi.mocked(renderDesignOnMockup).mockImplementationOnce(async () => {
      state.run = { ...state.run!, status: 'cancelled' };
      return Buffer.from('composite');
    });
    const outcome = await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });
    expect(outcome).toMatchObject({ ok: false, reason: 'cancelled' });
    expect(state.run?.status).toBe('cancelled');
  });
});

describe('folder automation', () => {
  it('prints the light-ink variant on dark garments and sends the design and first mockup as video references', async () => {
    state.template = baseTemplate({ createListing: false, generateVideo: true, video: { aspectRatio: '9:16' } });
    (state.template as Record<string, unknown>).mockupConfig = { folderId: 'f1', printAreaMockupIds: [], staticMockupIds: [], videoMockupIds: [], fabricType: 'all', multiPrintAreaSupport: false };
    state.mockups = [
      { id: 'w', name: 'White', src: '/api/r2/user-u1-w.png', folderId: 'f1', apparelType: 'light', printAreas: [{ id: 'a', x: 1, y: 1, width: 10, height: 10 }], width: 10, height: 10 },
      { id: 'b', name: 'Black', src: '/api/r2/user-u1-b.png', folderId: 'f1', apparelType: 'dark', printAreas: [{ id: 'a', x: 1, y: 1, width: 10, height: 10 }], width: 10, height: 10 },
    ];
    const { renderDesignOnMockup } = await import('@/lib/backend-render');
    const { generateVideo } = await import('@/lib/ai-provider');

    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });

    expect(recolor).toHaveBeenCalledTimes(1);
    const designs = vi.mocked(renderDesignOnMockup).mock.calls.map((call) => String(call[1]));
    expect(designs).toEqual(['png', 'dark-ink']);
    const [, options] = vi.mocked(generateVideo).mock.calls[0] as unknown as [unknown, { model: string; aspectRatio: string; referenceImages?: Array<{ mimeType: string }>; prompt: string }];
    expect(options.model).toBe('veo-admin'); // model admin panelinden
    expect(options.aspectRatio).toBe('9:16');
    // Tasarım ve ilk mockup referans olarak verilir (ilk kare olarak değil).
    expect(options.referenceImages?.map((r) => r.mimeType)).toEqual(['image/jpeg', 'image/jpeg']);
    expect(options.prompt).toMatch(/mannequin/);
    expect((state.run?.steps as Record<string, { status: string }>).videoGeneration.status).toBe('completed');
  });
});

describe('fabric variants', () => {
  const folderSetup = (seoHints: Record<string, unknown>) => {
    state.template = baseTemplate({ createListing: false });
    const t = state.template as Record<string, unknown>;
    t.mockupConfig = { folderId: 'f1', printAreaMockupIds: [], staticMockupIds: [], videoMockupIds: [], fabricType: 'all', multiPrintAreaSupport: false };
    t.seoHints = { ...(t.seoHints as object), ...seoHints };
    state.mockups = [
      { id: 'w', name: 'White', src: '/api/r2/user-u1-w.png', folderId: 'f1', apparelType: 'light', printAreas: [{ id: 'a', x: 1, y: 1, width: 10, height: 10 }], width: 10, height: 10 },
      { id: 'b', name: 'Black', src: '/api/r2/user-u1-b.png', folderId: 'f1', apparelType: 'dark', printAreas: [{ id: 'a', x: 1, y: 1, width: 10, height: 10 }], width: 10, height: 10 },
    ];
  };

  it('redraws the design for dark garments with the image model and prints that version on dark mockups', async () => {
    folderSetup({ designFabric: 'light', fabricVariant: true, audienceGroup: 'men' });
    const { removeVariantBackground } = await import('@/lib/background-removal');
    vi.mocked(removeVariantBackground).mockResolvedValueOnce({ pngBuffer: Buffer.from('ai-dark'), width: 2048, height: 2048 });
    const { generateImage } = await import('@/lib/ai-provider');
    const { renderDesignOnMockup } = await import('@/lib/backend-render');

    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });

    const calls = vi.mocked(generateImage).mock.calls as unknown as Array<[unknown, { prompt: string; image?: unknown }]>;
    expect(calls).toHaveLength(2);
    expect(calls[0]![1].prompt).toMatch(/men's apparel/);
    expect(calls[1]![1].image).toBeDefined();
    expect(calls[1]![1].prompt).toMatch(/dark-colored garments/);
    expect(recolor).not.toHaveBeenCalled();
    expect(vi.mocked(renderDesignOnMockup).mock.calls.map((call) => String(call[1]))).toEqual(['png', 'ai-dark']);
  });

  it('falls back to automatic recolor with a warning when the variant cannot be drawn', async () => {
    folderSetup({ designFabric: 'light', fabricVariant: true });
    const { generateImage } = await import('@/lib/ai-provider');
    vi.mocked(generateImage).mockResolvedValueOnce([{ data: 'aGVsbG8=' }] as never).mockRejectedValueOnce(new Error('edit not supported'));

    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });

    expect(recolor).toHaveBeenCalledWith(expect.anything(), 'dark_garment');
    const output = (state.run?.steps as Record<string, { output?: { warning?: string } }>).backgroundRemoval.output;
    expect(output?.warning).toMatch(/Koyu kumaş versiyonu üretilemedi/);
    expect(state.run?.status).toBe('completed');
  });

  it('uses one design everywhere when it is made for both fabrics', async () => {
    folderSetup({ designFabric: 'universal', fabricVariant: true });
    const { generateImage } = await import('@/lib/ai-provider');
    const { renderDesignOnMockup } = await import('@/lib/backend-render');

    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });

    expect(vi.mocked(generateImage)).toHaveBeenCalledTimes(1);
    expect(recolor).not.toHaveBeenCalled();
    expect(vi.mocked(renderDesignOnMockup).mock.calls.map((call) => String(call[1]))).toEqual(['png', 'png']);
  });
});

describe('automatic niche research', () => {
  it('researches the niche first and feeds it to the design and SEO steps', async () => {
    state.template = baseTemplate();
    (state.template as Record<string, unknown>).seoHints = { productType: 'T-shirt', targetAudience: '', customNotes: '', primaryNiche: '', nicheMode: 'auto' };
    state.run = { ...state.run!, steps: { nicheResearch: { status: 'pending' }, ...pendingSteps() } };
    const { generateImage } = await import('@/lib/ai-provider');

    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });

    expect(research).toHaveBeenCalledTimes(1);
    const steps = state.run?.steps as Record<string, { status: string; output?: { niche?: string } }>;
    expect(steps.nicheResearch.status).toBe('completed');
    expect(steps.nicheResearch.output?.niche).toBe('retro camping dad');
    const [, imageOptions] = vi.mocked(generateImage).mock.calls[0] as unknown as [unknown, { prompt: string }];
    expect(imageOptions.prompt).toMatch(/retro camping dad/);
    expect(imageOptions.prompt).toMatch(/vintage distressed/);
    const [, listingInput] = generateListing.mock.calls[0] as unknown as [string, { keywords: string[] }];
    expect(listingInput.keywords).toContain('camping dad shirt');
  });

  it('skips research for templates with a manual niche', async () => {
    state.run = { ...state.run!, steps: { nicheResearch: { status: 'pending' }, ...pendingSteps() } };
    await executeAutomationRun({ runId: 'run1', templateId: 't1', userId: 'u1' });
    expect(research).not.toHaveBeenCalled();
    expect((state.run?.steps as Record<string, { status: string }>).nicheResearch.status).toBe('skipped');
  });
});
