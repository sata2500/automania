export const SECRET_SETTING_KEYS = new Set([
  'openrouter_api_key',
  'gemini_api_key',
  'etsy_keystring',
  'etsy_shared_secret',
  'scraping_api_key',
]);

export function maskSettingValue(key: string, value: unknown): string {
  const normalized = typeof value === 'string' ? value : '';
  return SECRET_SETTING_KEYS.has(key) && normalized ? '***' : normalized;
}

export function shouldPreserveSecretValue(key: string, value: string): boolean {
  return SECRET_SETTING_KEYS.has(key) && (value === '***' || value.trim() === '');
}
