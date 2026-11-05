/**
 * Varyasyon şablonunun Excel (.xlsx) / CSV olarak dışa ve içe aktarımı (saf modül; jszip ile, ek paket yok).
 * Sütunlar: Beden, Renk, Fiyat, Satışta (Evet/Hayır). İçe aktarmada başlık satırı Türkçe veya İngilizce adlarla
 * tanınır (Beden/Size, Renk/Color, Fiyat/Price, Satışta/Enabled); başlık yoksa sütun sırası bu kabul edilir.
 */
import type { EtsyVariationRow } from '@/types/pod';
import { parsePrice } from '@/lib/sheet-fill';

const HEADERS = ['Beden', 'Renk', 'Fiyat', 'Satışta'] as const;

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const xmlUnescape = (s: string) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

const columnName = (index: number): string => {
  let n = index + 1;
  let name = '';
  while (n > 0) { const m = (n - 1) % 26; name = String.fromCharCode(65 + m) + name; n = Math.floor((n - 1) / 26); }
  return name;
};
const columnIndex = (ref: string): number => {
  const letters = ref.replace(/[^A-Z]/gi, '').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** Satırları tek sayfalık bir .xlsx dosyasına yazar (Excel, Google E-Tablolar ve Numbers açar). */
export async function variationRowsToXlsx(rows: EtsyVariationRow[], sheetName = 'Varyasyonlar'): Promise<Uint8Array> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const cell = (col: number, row: number, value: string | number) => {
    const ref = `${columnName(col)}${row}`;
    return typeof value === 'number'
      ? `<c r="${ref}"><v>${value}</v></c>`
      : `<c r="${ref}" t="inlineStr"${row === 1 ? ' s="1"' : ''}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  };
  const lines = [
    `<row r="1">${HEADERS.map((h, i) => cell(i, 1, h)).join('')}</row>`,
    ...rows.map((r, i) => `<row r="${i + 2}">${[r.size, r.color, r.price, r.enabled ? 'Evet' : 'Hayır'].map((v, c) => cell(c, i + 2, v)).join('')}</row>`),
  ];
  const name = xmlEscape(sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Varyasyonlar');
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  // Başlık satırı kalın (s="1"); fiyat sütunu sayı olarak yazılır.
  zip.file('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>');
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="2" width="22" customWidth="1"/><col min="3" max="4" width="11" customWidth="1"/></cols><sheetData>${lines.join('')}</sheetData></worksheet>`);
  return zip.generateAsync({ type: 'uint8array' });
}

/** .xlsx dosyasının ilk sayfasındaki hücreler (metin olarak, satır/sütun konumlarıyla). */
async function readXlsxGrid(data: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(data);
  const shared: string[] = [];
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  if (sharedXml) {
    for (const si of sharedXml.match(/<si\b[\s\S]*?<\/si>/g) ?? []) {
      // Zengin metinde birden çok <t> parçası birleşir.
      shared.push(xmlUnescape((si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join('')));
    }
  }
  const sheetPath = Object.keys(zip.files).filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))[0];
  if (!sheetPath) throw new Error('Dosyada sayfa bulunamadı.');
  const sheet = await zip.file(sheetPath)!.async('string');
  const grid: string[][] = [];
  for (const rowXml of sheet.match(/<row\b[\s\S]*?<\/row>/g) ?? []) {
    const rowNumber = Number(rowXml.match(/<row\b[^>]*\br="(\d+)"/)?.[1] ?? grid.length + 1) - 1;
    const cells: string[] = [];
    for (const cellXml of rowXml.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
      const ref = cellXml.match(/\br="([A-Z]+)\d*"/i)?.[1];
      const type = cellXml.match(/\bt="(\w+)"/)?.[1];
      const v = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let text = '';
      if (type === 's' && v !== undefined) text = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') text = xmlUnescape((cellXml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join(''));
      else if (type === 'b') text = v === '1' ? 'Evet' : 'Hayır';
      else if (v !== undefined) text = xmlUnescape(v);
      cells[ref ? columnIndex(ref) : cells.length] = text.trim();
    }
    grid[rowNumber] = Array.from(cells, (c) => c ?? '');
  }
  return Array.from(grid, (r) => r ?? []);
}

/** CSV (virgül, noktalı virgül veya sekme ayrılmış; tırnaklı alanlar desteklenir). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = ['\t', ';', ','].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++; } else if (ch === '"') quoted = false; else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(field.trim()); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field.trim()); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length > 0) { row.push(field.trim()); rows.push(row); }
  return rows;
}

const norm = (s: string) => s.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü]/g, '');
const HEADER_ALIASES: Record<'size' | 'color' | 'price' | 'enabled', string[]> = {
  size: ['beden', 'size', 'boyut', 'ölçü', 'olcu'],
  color: ['renk', 'color', 'colour'],
  price: ['fiyat', 'price', 'tutar', 'ücret', 'ucret'],
  enabled: ['satışta', 'satista', 'satış', 'satis', 'enabled', 'active', 'aktif', 'durum'],
};
const YES = new Set(['evet', 'yes', 'true', '1', 'x', 'açık', 'acik', 'aktif', 'satışta', 'satista', 'on']);

/** Hücre tablosundan varyasyon satırları (başlık tanınırsa ona göre, yoksa Beden, Renk, Fiyat, Satışta sırası). */
export function variationRowsFromGrid(grid: string[][]): EtsyVariationRow[] {
  const nonEmpty = grid.filter((r) => r.some((c) => c && c.trim()));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0]!.map(norm);
  const find = (key: keyof typeof HEADER_ALIASES) => header.findIndex((h) => HEADER_ALIASES[key].some((a) => h === norm(a)));
  const hasHeader = find('size') >= 0 || find('color') >= 0 || find('price') >= 0;
  const cols = hasHeader
    ? { size: find('size'), color: find('color'), price: find('price'), enabled: find('enabled') }
    : { size: 0, color: 1, price: 2, enabled: 3 };
  const body = hasHeader ? nonEmpty.slice(1) : nonEmpty;
  const cell = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  let fallbackPrice = 24.99;
  return body.map((r, index) => {
    const price = parsePrice(cell(r, cols.price)) ?? fallbackPrice;
    fallbackPrice = price;
    const enabledText = norm(cell(r, cols.enabled));
    const size = cell(r, cols.size).slice(0, 60);
    const color = cell(r, cols.color).slice(0, 60);
    return {
      id: `${size}-${color}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `row-${index}`,
      size,
      color,
      price,
      quantity: 999,
      sku: '',
      enabled: cols.enabled < 0 || !enabledText ? true : YES.has(enabledText),
    };
  }).filter((r) => r.size || r.color);
}

/** Seçilen dosyadan (.xlsx veya .csv/.tsv/.txt) varyasyon satırları. */
export async function parseVariationFile(name: string, data: ArrayBuffer): Promise<EtsyVariationRow[]> {
  if (/\.xlsx$/i.test(name)) return variationRowsFromGrid(await readXlsxGrid(data));
  if (/\.xls$/i.test(name)) throw new Error('Eski .xls biçimi desteklenmiyor; dosyayı Excel\'de .xlsx olarak kaydedin.');
  return variationRowsFromGrid(parseCsv(new TextDecoder().decode(data)));
}
