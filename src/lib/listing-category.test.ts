import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ default: vi.fn(async () => []) }));
vi.mock('@/lib/ai-text', () => ({ generateVisionJson: vi.fn() }));
vi.mock('@/lib/media-source', () => ({ loadImageForUser: vi.fn() }));

const { buildCategoryPrompt, parseCategoryAnswer, spreadPick } = await import('./listing-category');

const categories = [
  { id: 482, name: 'T-shirts', path: 'Clothing > Unisex Adult Clothing > Tops & Tees > T-shirts' },
  { id: 2202, name: 'Hoodies & Sweatshirts', path: 'Clothing > Unisex Adult Clothing > Hoodies & Sweatshirts' },
];

describe('listing category', () => {
  it('accepts only categories from the active list', () => {
    expect(parseCategoryAnswer({ taxonomyId: 2202, productType: 'Sweatshirt & Hoodie' }, categories))
      .toEqual({ taxonomyId: 2202, name: 'Hoodies & Sweatshirts', productType: 'Sweatshirt & Hoodie' });
    expect(parseCategoryAnswer({ taxonomyId: '482' }, categories)?.productType).toBe('T-shirts');
    expect(parseCategoryAnswer({ taxonomyId: 999 }, categories)).toBeNull();
    expect(parseCategoryAnswer(null, categories)).toBeNull();
  });

  it('lists the active categories and asks about the garments, not the artwork', () => {
    const prompt = buildCategoryPrompt(categories);
    expect(prompt).toContain('ID: 2202 (Hoodies & Sweatshirts');
    expect(prompt).toMatch(/ignore the printed artwork/);
  });

  it('spreads the photo pick across the listing', () => {
    expect(spreadPick([1, 2, 3], 4)).toEqual([1, 2, 3]);
    expect(spreadPick([1, 2, 3, 4, 5, 6, 7, 8], 4)).toEqual([1, 3, 5, 7]);
  });
});
