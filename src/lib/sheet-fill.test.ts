import { describe, expect, it } from 'vitest';
import { fillTargets, parseClipboardGrid, parsePrice } from './sheet-fill';

describe('sheet fill', () => {
  it('copies a single cell', () => {
    expect(fillTargets(['Black'], 2, 2, 5)).toEqual([
      { row: 3, value: 'Black' }, { row: 4, value: 'Black' }, { row: 5, value: 'Black' },
    ]);
  });

  it('repeats a multi-cell pattern downward and upward', () => {
    const colors = ['Sarı', 'Kırmızı', 'Mavi'];
    expect(fillTargets(colors, 0, 2, 7).map((t) => t.value)).toEqual(['Sarı', 'Kırmızı', 'Mavi', 'Sarı', 'Kırmızı']);
    // Yukarı: satır 3-5 kaynak, 1-2'ye çekilir → örüntü geriye devam eder (…, Kırmızı, Mavi | Sarı, Kırmızı, Mavi)
    expect(fillTargets(colors, 3, 5, 1)).toEqual([{ row: 1, value: 'Kırmızı' }, { row: 2, value: 'Mavi' }]);
    expect(fillTargets(colors, 0, 2, 1)).toEqual([]);
  });

  it('parses pasted Excel cells and prices', () => {
    expect(parseClipboardGrid('S\tBlack\t24.99\r\nM\tWhite\t25\r\n')).toEqual([['S', 'Black', '24.99'], ['M', 'White', '25']]);
    expect(parsePrice('$24,99')).toBe(24.99);
    expect(parsePrice('1.234,5')).toBe(1234.5);
    expect(parsePrice('abc')).toBeNull();
  });
});
