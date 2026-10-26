import { describe, expect, it } from 'vitest';
import { formatAllPrompts } from './AdminPromptEditor';
import { PROMPT_DEFINITIONS, type PromptKey } from '@/lib/prompt-registry';

describe('formatAllPrompts', () => {
  it('lists every prompt with title, key and edited/default status', () => {
    const values = Object.fromEntries(PROMPT_DEFINITIONS.map((d) => [d.key, d.defaultValue])) as Record<PromptKey, string>;
    values.ai_prompt_generate_video = 'Custom video';
    const text = formatAllPrompts(values);
    expect(text.match(/^=== /gm)).toHaveLength(PROMPT_DEFINITIONS.length);
    expect(text).toMatch(/=== 1\. Tasarım görsel analizi \(ai_prompt_analyze_design\) — Varsayılan ===/);
    expect(text).toMatch(/\(ai_prompt_generate_video\) — Düzenlendi ===\nCustom video/);
  });
});
