import { describe, expect, it } from 'vitest';
import { maskSettingValue, shouldPreserveSecretValue } from './setting-security';

describe('setting security', () => {
  it('never returns configured secret values', () => {
    expect(maskSettingValue('gemini_api_key', 'AIza-secret')).toBe('***');
    expect(maskSettingValue('openrouter_api_key', 'sk-secret')).toBe('***');
    expect(maskSettingValue('ai_prompt_analyze_design', 'prompt text')).toBe('prompt text');
  });

  it('preserves secrets when the UI submits a mask or blank value', () => {
    expect(shouldPreserveSecretValue('gemini_api_key', '***')).toBe(true);
    expect(shouldPreserveSecretValue('gemini_api_key', '   ')).toBe(true);
    expect(shouldPreserveSecretValue('ai_prompt_analyze_design', '')).toBe(false);
  });
});
