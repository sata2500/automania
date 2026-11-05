import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { parseCsv, parseVariationFile, variationRowsFromGrid, variationRowsToXlsx } from './variation-xlsx';
import type { EtsyVariationRow } from '@/types/pod';

const row = (size: string, color: string, price: number, enabled = true): EtsyVariationRow => ({ id: `${size}-${color}`, size, color, price, quantity: 999, sku: '', enabled });

describe('variation excel', () => {
  it('round-trips rows through an .xlsx file', async () => {
    const rows = [row('S', 'Black & White', 24.99), row('2XL', 'Sarı <yeni>', 27.5, false)];
    const file = await variationRowsToXlsx(rows, 'Unisex: tişört');
    const parsed = await parseVariationFile('sablon.xlsx', file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
    expect(parsed.map((r) => [r.size, r.color, r.price, r.enabled])).toEqual([['S', 'Black & White', 24.99, true], ['2XL', 'Sarı <yeni>', 27.5, false]]);
    const zip = await JSZip.loadAsync(file);
    expect(await zip.file('xl/workbook.xml')!.async('string')).toContain('name="Unisex  tişört"');
  });

  it('reads an Excel-made sheet with shared strings and English headers', async () => {
    const zip = new JSZip();
    zip.file('xl/sharedStrings.xml', '<sst><si><t>Size</t></si><si><t>Color</t></si><si><t>Price</t></si><si><r><t>Forest </t></r><r><t>Green</t></r></si><si><t>M</t></si></sst>');
    zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3" t="s"><v>3</v></c><c r="C3"><v>25.5</v></c></row></sheetData></worksheet>');
    const data = await zip.generateAsync({ type: 'arraybuffer' });
    expect((await parseVariationFile('x.xlsx', data)).map((r) => [r.size, r.color, r.price])).toEqual([['M', 'Forest Green', 25.5]]);
  });

  it('parses CSV with ; and quotes, and grids without a header', () => {
    expect(parseCsv('Beden;Renk;Fiyat\n"XL";"Navy; Blue";"26,99"\n')).toEqual([['Beden', 'Renk', 'Fiyat'], ['XL', 'Navy; Blue', '26,99']]);
    expect(variationRowsFromGrid(parseCsv('Beden;Renk;Fiyat\nXL;Navy;26,99')).map((r) => r.price)).toEqual([26.99]);
    expect(variationRowsFromGrid([['S', 'Black', '20', 'Hayır']])[0]).toMatchObject({ size: 'S', color: 'Black', price: 20, enabled: false });
  });
});

describe('safeFileName', async () => {
  const { safeFileName } = await import('./download');
  it('simplifies Turkish letters and removes forbidden characters', () => {
    expect(safeFileName('Unisex Tişört: Çocuk/Ğ')).toBe('Unisex Tisort Cocuk G');
    expect(safeFileName('???', 'varyasyonlar')).toBe('varyasyonlar');
  });
});
