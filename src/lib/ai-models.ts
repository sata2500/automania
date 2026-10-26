/**
 * Yapay zekâ modelleri yalnızca admin panelinde seçilenlerdir (AI Ayarları › Modeller). Kodda yedek veya
 * varsayılan model yoktur: seçim yapılmamışsa işlem açık bir mesajla durur.
 */

export type ModelRole = 'vision' | 'reasoning' | 'generation' | 'video';

const ROLE_LABELS: Record<ModelRole, string> = {
  vision: 'Görsel analiz modeli',
  reasoning: 'SEO metin modeli',
  generation: 'Görsel üretim modeli',
  video: 'Video üretim modeli',
};

export class ModelNotConfiguredError extends Error {
  constructor(role: ModelRole) {
    super(`${ROLE_LABELS[role]} seçilmemiş. Admin › AI Ayarları › Modeller bölümünden bir model seçip kaydedin.`);
    this.name = 'ModelNotConfiguredError';
  }
}

/** Admin panelinde seçilen modeli döner; seçim yoksa `ModelNotConfiguredError` fırlatır. */
export function requireModel(value: string | null | undefined, role: ModelRole): string {
  const model = value?.trim();
  if (!model) throw new ModelNotConfiguredError(role);
  return model;
}
