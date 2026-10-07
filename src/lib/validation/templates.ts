import { z } from 'zod';

const id = z.string().trim().min(1).max(255);
const shortText = (max: number) => z.string().max(max);

export const mockupConfigSchema = z.object({
  printAreaMockupIds: z.array(id).max(20).default([]),
  staticMockupIds: z.array(id).max(20).default([]),
  videoMockupIds: z.array(id).max(2, 'Etsy limiti: maksimum 2 video yüklenebilir.').default([]),
  fabricType: z.enum(['light', 'dark', 'all']).default('all'),
  multiPrintAreaSupport: z.boolean().default(false),
}).refine(
  (config) => config.printAreaMockupIds.length + config.staticMockupIds.length <= 20,
  { message: 'Etsy limiti: maksimum 20 görsel yüklenebilir.' },
);

export const variationRowSchema = z.object({
  id: id,
  size: shortText(100),
  color: shortText(100),
  price: z.number().min(0).max(100_000),
  quantity: z.number().int().min(0).max(999_999),
  sku: shortText(64).default(''),
  enabled: z.boolean().default(true),
});

export const variationConfigSchema = z.object({
  rows: z.array(variationRowSchema).max(400).default([]),
  sizes: z.array(shortText(100)).max(100).default([]),
  colors: z.array(shortText(100)).max(100).default([]),
  basePrice: z.number().min(0).max(100_000).optional(),
});

export const seoHintsSchema = z.object({
  productType: shortText(200).default(''),
  targetAudience: shortText(500).default(''),
  customNotes: shortText(4000).default(''),
  primaryNiche: shortText(200).default(''),
});

export const automationScheduleSchema = z.object({
  enabled: z.boolean().default(false),
  cronExpression: shortText(100).default('0 9 * * *'),
  timezone: shortText(64).default('America/New_York').refine((tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Geçersiz saat dilimi.'),
  nextRunAt: z.string().max(64).nullable().default(null),
  listingsPerRun: z.number().int().min(1).max(5).default(1),
  publishMode: z.enum(['draft', 'active']).default('draft'),
});

export const templateInputSchema = z.object({
  name: z.string().trim().min(1, 'Şablon adı zorunludur.').max(255),
  description: z.string().max(2000).nullable().optional(),
  mockupConfig: mockupConfigSchema.optional(),
  variationConfig: variationConfigSchema.optional(),
  seoHints: seoHintsSchema.optional(),
  automationSchedule: automationScheduleSchema.optional(),
  isActive: z.boolean().optional(),
});

export const templateUpdateSchema = templateInputSchema.partial();

/** Zod hatasını kullanıcıya gösterilebilir tek bir mesaja çevirir. */
export function formatValidationError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Geçersiz istek.';
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}
