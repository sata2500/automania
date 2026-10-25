/**
 * Sunucu tarafında talimat (prompt) okuma: admin panelinde kayıtlı metin, boşsa kayıttaki varsayılan.
 * Bkz. `prompt-registry`.
 */
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
