import { describe, expect, it } from 'vitest';
import { sanitizeTrademarkText } from './trademark-shield';

describe('sanitizeTrademarkText', () => {
  it('keeps the seller\'s own garment model names but still cleans other brands', () => {
    const text = 'Printed on Comfort Colors 1717 and Bella+Canvas 3001. Gildan option.';
    const kept = sanitizeTrademarkText(text, { allowedNames: ['Comfort Colors 1717', 'Bella+Canvas 3001'] });
    expect(kept.cleanText).toMatch(/Comfort Colors 1717/);
    expect(kept.cleanText).toMatch(/Bella\+Canvas 3001/);
    expect(kept.cleanText).not.toMatch(/Gildan/);
    expect(sanitizeTrademarkText(text).cleanText).not.toMatch(/Comfort Colors/);
  });
});
