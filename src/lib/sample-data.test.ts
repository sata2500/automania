import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FOLDERS,
  SAMPLE_DESIGNS,
  SAMPLE_MOCKUPS,
  isProtectedUrl,
} from './sample-data';
import { generateMatchingPairs } from './canvas-renderer';

describe('bundled sample data', () => {
  it('contains a usable mockup/design workspace', () => {
    expect(DEFAULT_FOLDERS.length).toBeGreaterThanOrEqual(3);
    expect(SAMPLE_MOCKUPS.length).toBeGreaterThan(0);
    expect(SAMPLE_DESIGNS.length).toBeGreaterThan(0);
    expect(SAMPLE_DESIGNS.every((design) => design.isSelected === true)).toBe(true);
    expect(generateMatchingPairs(SAMPLE_MOCKUPS, SAMPLE_DESIGNS, 'demo-folder-light')).toHaveLength(2);
    expect(SAMPLE_MOCKUPS.every((mockup) => mockup.src.startsWith('/demo/'))).toBe(true);
    expect(SAMPLE_DESIGNS.every((design) => design.src.startsWith('/demo/'))).toBe(true);
  });

  it('keeps every bundled asset protected from blob cleanup', () => {
    for (const item of [...SAMPLE_MOCKUPS, ...SAMPLE_DESIGNS]) {
      expect(isProtectedUrl(item.src)).toBe(true);
      expect(isProtectedUrl(`https://automania.test${item.src}`)).toBe(true);
    }
  });

  it('does not protect arbitrary user-owned assets', () => {
    expect(isProtectedUrl('/api/uploads/user-123-design.png')).toBe(false);
    expect(isProtectedUrl('https://example.com/other-design.png')).toBe(false);
  });
});
