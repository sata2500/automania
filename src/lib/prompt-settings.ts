/**
 * Sunucu tarafında talimat (prompt) okuma: admin panelinde kayıtlı metin, boşsa kayıttaki varsayılan.
 * Bkz. `prompt-registry`.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { etsyTaxonomyCache } from '@/db/schema';
import { loadSettings } from '@/lib/app-settings';
import { resolvePrompt, type PromptKey } from '@/lib/prompt-registry';

export async function loadPrompts<K extends PromptKey>(keys: readonly K[]): Promise<Record<K, string>> {
  let stored: Record<string, string> = {};
  try {
    stored = await loadSettings(keys);
  } catch (error) {
    console.error('[Prompts] Failed to load prompt settings; using defaults.', error instanceof Error ? error.message : error);
  }
  return Object.fromEntries(keys.map((key) => [key, resolvePrompt(key, stored[key])])) as Record<K, string>;
}

export async function loadPrompt(key: PromptKey): Promise<string> {
  return (await loadPrompts([key]))[key];
}

/** "Görsel analizi" talimatındaki {{taxonomyHint}}: admin panelinde etkin Etsy kategorileri. */
export async function loadTaxonomyHint(): Promise<string> {
  try {
    const activeCategories = await db.select().from(etsyTaxonomyCache).where(eq(etsyTaxonomyCache.isActive, true));
    if (activeCategories.length > 0) return activeCategories.map((c) => `- ID: ${c.id} (${c.name}, ${c.path})`).join('\n');
  } catch (error) {
    console.error('[Prompts] Failed to load active Etsy categories.', error instanceof Error ? error.message : error);
  }
  return '- ID: 482 (T-shirts)\n- ID: 2202 (Sweatshirts)';
}
