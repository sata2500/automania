import { describe, expect, it } from 'vitest';
import { PROMPT_DEFINITIONS, fillPrompt, resolvePrompt } from './prompt-registry';
import { DEFAULT_ANALYZE_DESIGN_PROMPT, DEFAULT_GENERATE_DESIGN_PROMPT } from './default-prompts';
import { LEGACY_ANALYZE_LISTING_IMAGE, LEGACY_GENERATE_DESIGN_V1, LEGACY_GENERATE_DESIGN_V2 } from './legacy-prompts';

describe('prompt registry', () => {
  it('has unique keys and documents every variable used in the default texts', () => {
    const keys = PROMPT_DEFINITIONS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const definition of PROMPT_DEFINITIONS) {
      expect(definition.defaultValue.trim().length).toBeGreaterThan(0);
      const documented = definition.variables.map((v) => v.tag);
      for (const tag of definition.defaultValue.match(/\{\{\w+\}\}/g) ?? []) {
        expect(documented, `${definition.key} ${tag}`).toContain(tag);
      }
    }
  });

  it('uses the stored prompt, the default when empty, and upgrades an untouched legacy default', () => {
    expect(resolvePrompt('ai_prompt_generate_video', '  custom video  ')).toBe('custom video');
    expect(resolvePrompt('ai_prompt_generate_design', '')).toBe(DEFAULT_GENERATE_DESIGN_PROMPT);
    expect(resolvePrompt('ai_prompt_generate_design', null)).toBe(DEFAULT_GENERATE_DESIGN_PROMPT);
    expect(resolvePrompt('ai_prompt_generate_design', LEGACY_GENERATE_DESIGN_V1.replace(/\n/g, '\r\n'))).toBe(DEFAULT_GENERATE_DESIGN_PROMPT);
    expect(resolvePrompt('ai_prompt_generate_design', LEGACY_GENERATE_DESIGN_V2)).toBe(DEFAULT_GENERATE_DESIGN_PROMPT);
    expect(resolvePrompt('ai_prompt_analyze_design', LEGACY_ANALYZE_LISTING_IMAGE)).toBe(DEFAULT_ANALYZE_DESIGN_PROMPT);
  });

  it('fills known variables and leaves unknown ones untouched', () => {
    expect(fillPrompt('{{a}} and {{a}} but {{b}}', { a: 'x' })).toBe('x and x but {{b}}');
  });
});
