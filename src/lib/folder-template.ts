/**
 * Mockup klasörü ↔ otomasyon şablonu bağlantısı.
 *
 * Bir klasörün "Otomasyon Şablonu" ile Toplu Üretim › Otomasyon Şablonları aynı kaydı kullanır:
 * şablonun `mockupConfig.folderId` alanı bağlı klasörü gösterir. Eski "klasör şablon ayarları"
 * kayıtları (açıklama alanında JSON) bu biçime dönüştürülür.
 */
import type { EtsyVariationRow, MockupItem } from '@/types/pod';
import type {
  PodTemplate,
  PodTemplateAutomationSchedule,
  PodTemplateMockupConfig,
  PodTemplateVariationConfig,
} from '@/types/templates';

/** Etsy sınırları: ilan başına en fazla 20 görsel, 1 video. */
export const MAX_TEMPLATE_IMAGES = 20;
export const MAX_TEMPLATE_VIDEOS = 1;
const MAX_VARIATION_ROWS = 400;

/** Klasördeki mockup'lardan şablonun görsel seçimini üretir (baskı alanlılar önce). */
export function buildFolderMockupConfig(folderId: string, mockups: MockupItem[]): PodTemplateMockupConfig {
  const inFolder = mockups.filter((m) => m.folderId === folderId);
  const printArea = inFolder.filter((m) => !m.isVideo && m.hasPrintArea !== false).map((m) => m.id);
  const staticIds = inFolder.filter((m) => !m.isVideo && m.hasPrintArea === false).map((m) => m.id);
  const printAreaMockupIds = printArea.slice(0, MAX_TEMPLATE_IMAGES);
  return {
    folderId,
    printAreaMockupIds,
    staticMockupIds: staticIds.slice(0, MAX_TEMPLATE_IMAGES - printAreaMockupIds.length),
    videoMockupIds: inFolder.filter((m) => m.isVideo).map((m) => m.id).slice(0, MAX_TEMPLATE_VIDEOS),
    fabricType: 'all',
    multiPrintAreaSupport: false,
  };
}

/** Kayıtlı (Etsy SEO sekmesi) varyasyon satırlarından şablon varyasyon yapılandırması üretir. */
export function variationConfigFromRows(rows: EtsyVariationRow[]): PodTemplateVariationConfig {
  const limited = rows.slice(0, MAX_VARIATION_ROWS).map((row) => ({
    id: String(row.id),
    size: String(row.size ?? ''),
    color: String(row.color ?? ''),
    price: Number(row.price) || 0,
    quantity: Math.max(0, Math.trunc(Number(row.quantity) || 0)),
    sku: String(row.sku ?? '').slice(0, 64),
    enabled: row.enabled !== false,
  }));
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
  const prices = limited.map((r) => r.price).filter((p) => p > 0);
  return {
    rows: limited,
    sizes: unique(limited.map((r) => r.size)),
    colors: unique(limited.map((r) => r.color)),
    basePrice: prices.length > 0 ? Math.min(...prices) : undefined,
  };
}

/** Klasöre bağlı şablonu bulur (eski kayıtlarda şablon kimliği klasör kimliğine eşittir). */
export function findFolderTemplate<T extends Pick<PodTemplate, 'id' | 'mockupConfig'>>(templates: T[], folderId: string): T | null {
  return templates.find((t) => t.mockupConfig?.folderId === folderId)
    ?? templates.find((t) => t.id === folderId)
    ?? null;
}

type LegacyFolderConfig = {
  variationTemplateId?: string;
  taxonomyId?: number;
  automationSchedule?: PodTemplateAutomationSchedule;
};

/** Açıklama alanındaki eski klasör yapılandırmasını okur; eski kayıt değilse null. */
export function parseLegacyFolderConfig(description: string | null | undefined): LegacyFolderConfig | null {
  if (!description || !description.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(description) as Record<string, unknown>;
    if (parsed.__folderConfig !== true) return null;
    return {
      variationTemplateId: typeof parsed.variationTemplateId === 'string' ? parsed.variationTemplateId : undefined,
      taxonomyId: typeof parsed.taxonomyId === 'number' && parsed.taxonomyId > 0 ? parsed.taxonomyId : undefined,
      automationSchedule: parsed.automationSchedule && typeof parsed.automationSchedule === 'object'
        ? parsed.automationSchedule as PodTemplateAutomationSchedule
        : undefined,
    };
  } catch {
    return null;
  }
}

const DEFAULT_LEGACY_ETSY = {
  shippingProfileId: '',
  readinessStateId: '',
  taxonomyId: 482,
  price: 24.99,
  whoMade: 'i_did' as const,
  whenMade: 'made_to_order',
};

type LegacyRow = Pick<PodTemplate, 'id' | 'description' | 'mockupConfig' | 'variationConfig' | 'automationSchedule'>;

/**
 * Eski klasör şablon kaydını tam otomasyon şablonuna dönüştürür: klasörün mockup'ları seçilir,
 * seçilmiş varyasyon şablonunun satırları ve Etsy kategorisi aktarılır, açıklamadaki JSON temizlenir.
 */
export function convertLegacyFolderTemplate(
  row: LegacyRow,
  context: { mockups: MockupItem[]; variationTemplates: Array<{ id: string; variations?: EtsyVariationRow[] }> },
): Pick<PodTemplate, 'description' | 'mockupConfig' | 'variationConfig' | 'automationSchedule'> | null {
  const legacy = parseLegacyFolderConfig(row.description);
  if (!legacy) return null;

  const hasMockups = (row.mockupConfig?.printAreaMockupIds?.length ?? 0) + (row.mockupConfig?.staticMockupIds?.length ?? 0) > 0;
  const mockupConfig = hasMockups
    ? { ...row.mockupConfig, folderId: row.id }
    : buildFolderMockupConfig(row.id, context.mockups);

  const variationTemplate = legacy.variationTemplateId
    ? context.variationTemplates.find((t) => t.id === legacy.variationTemplateId)
    : undefined;
  const hasRows = (row.variationConfig?.rows?.length ?? 0) > 0;
  const variationConfig = !hasRows && variationTemplate?.variations?.length
    ? variationConfigFromRows(variationTemplate.variations)
    : row.variationConfig;

  const schedule = { ...(legacy.automationSchedule ?? {}), ...(row.automationSchedule ?? {}) } as PodTemplateAutomationSchedule;
  const automationSchedule: PodTemplateAutomationSchedule = legacy.taxonomyId
    ? { ...schedule, etsy: { ...(schedule.etsy ?? DEFAULT_LEGACY_ETSY), taxonomyId: legacy.taxonomyId } }
    : schedule;

  return { description: null, mockupConfig, variationConfig, automationSchedule };
}
