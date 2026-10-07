import { z } from 'zod';

const itemWithId = z.looseObject({ id: z.string().min(1).max(255) });
const nullableId = z.string().max(255).nullable();
const modelId = z.string().max(255).nullable();

/** POST /api/storage gövdesi: tüm alanlar isteğe bağlıdır (kısmi kayıt). */
export const workspaceSaveSchema = z.object({
  mockups: z.array(itemWithId).max(5000).optional(),
  designs: z.array(itemWithId).max(5000).optional(),
  folders: z.array(itemWithId).max(1000).optional(),
  etsyGeneratedMockups: z.array(itemWithId).max(5000).optional(),
  activeFolderId: nullableId.optional(),
  selectedMockupId: nullableId.optional(),
  etsyProductTypes: z.string().max(1000).nullable().optional(),
  etsyUserNotes: z.string().max(10_000).nullable().optional(),
  etsyVariationTemplates: z.array(itemWithId).max(500).optional(),
  etsyDefaultTemplates: z.record(z.string().max(32), z.string().max(255)).optional(),
  etsyCustomSizes: z.array(z.string().max(100)).max(500).optional(),
  etsyCustomColors: z.array(z.string().max(100)).max(500).optional(),
  modelVision: modelId.optional(),
  modelReasoning: modelId.optional(),
  modelGeneration: modelId.optional(),
  lastKnownServerTimestamp: z.number().finite().nullable().optional(),
});

export type WorkspaceSaveInput = z.infer<typeof workspaceSaveSchema>;
