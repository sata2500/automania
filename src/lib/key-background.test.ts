import { describe, expect, it } from 'vitest';
import { keyBackgroundInstructions, pickKeyBackground, stripBackgroundRules } from './key-background';

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

describe('keyBackgroundInstructions', () => {
  it('asks for a centered square composition on a flat screen color the design avoids', () => {
    const green = keyBackgroundInstructions('green');
    expect(green).toMatch(/centered horizontally and vertically/);
    expect(green).toMatch(/#00FF00/);
    expect(green).toMatch(/forest green/);
    const magenta = keyBackgroundInstructions('magenta');
    expect(magenta).toMatch(/#FF00FF/);
    expect(magenta).toMatch(/Do not use magenta/);
  });
});

describe('stripBackgroundRules', () => {
  it('drops old background-color lines so they cannot contradict the chosen screen', () => {
    const prompt = 'Concept: forest\n1. BACKGROUND: The background MUST be a solid, pure bright green (chroma key green, #00FF00).\n2. SUBJECT: centered';
    expect(stripBackgroundRules(prompt)).toBe('Concept: forest\n2. SUBJECT: centered');
  });
});
