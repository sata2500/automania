import { describe, expect, it } from 'vitest';
import { keyColorPromptValues, pickKeyBackground } from './key-background';
import { fillPrompt } from './prompt-registry';
import { DEFAULT_DESIGN_CANVAS_PROMPT } from './default-prompts';

describe('pickKeyBackground', () => {
  it('uses magenta for green-heavy themes and green otherwise', () => {
    expect(pickKeyBackground('Giant sequoia forest hiking shirt')).toBe('magenta');
    expect(pickKeyBackground('Lineman Christmas lights')).toBe('magenta');
    expect(pickKeyBackground("St. Patrick's Day shamrock")).toBe('magenta');
    expect(pickKeyBackground('Funny nurse coffee quote')).toBe('green');
    expect(pickKeyBackground('Street racing car')).toBe('green'); // "tree" kelime içinde geçmez
    expect(pickKeyBackground(undefined)).toBe('green');
  });
});

describe('design canvas prompt', () => {
  it('fills the chosen screen color into the admin canvas prompt', () => {
    const green = fillPrompt(DEFAULT_DESIGN_CANVAS_PROMPT, keyColorPromptValues('green'));
    expect(green).toMatch(/centered horizontally and vertically/);
    expect(green).toMatch(/pure chroma-key green \(#00FF00\)/);
    const magenta = fillPrompt(DEFAULT_DESIGN_CANVAS_PROMPT, keyColorPromptValues('magenta'));
    expect(magenta).toMatch(/do not use pure magenta/);
    expect(magenta).not.toMatch(/\{\{/);
  });
});
