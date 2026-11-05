/**
 * Tablo doldurma (Excel'deki doldurma tutamacı gibi; saf modül). Seçili hücreler aşağı/yukarı çekilince değerleri
 * örüntü olarak tekrar eder: tek hücre kopyalanır, birden fazla hücre (ör. Sarı, Kırmızı, Mavi) sırayla tekrarlanır.
 */

/**
 * Kaynak bloğun (satır `top`–`bottom`) değerleriyle `to` satırına kadar doldurulacak satırların değerleri.
 * Aşağı çekişte `bottom+1..to`, yukarı çekişte `to..top-1` satırları döner; her satır kaynak örüntüdeki yerine
 * göre değer alır (yukarı çekişte örüntü geriye doğru devam eder).
 */
export function fillTargets<T>(values: T[], top: number, bottom: number, to: number): Array<{ row: number; value: T }> {
  const n = values.length;
  if (n === 0 || (to >= top && to <= bottom)) return [];
  const rows = to > bottom
    ? Array.from({ length: to - bottom }, (_, i) => bottom + 1 + i)
    : Array.from({ length: top - to }, (_, i) => to + i);
  return rows.map((row) => ({ row, value: values[(((row - top) % n) + n) % n]! }));
}

/** Panodaki sekme/satır ayrılmış metin (Excel'den kopyalama) → hücre tablosu. */
export function parseClipboardGrid(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  return lines.map((line) => line.split('\t').map((cell) => cell.trim()));
}

/** Fiyat metnini sayıya çevirir ("$24,99" → 24.99); geçersizse null. */
export function parsePrice(text: string): number | null {
  const clean = text.replace(/[^\d.,-]/g, '');
  if (!clean) return null;
  // "1.234,56" ve "1,234.56" biçimleri: son ayırıcı ondalık sayılır.
  const lastSep = Math.max(clean.lastIndexOf('.'), clean.lastIndexOf(','));
  const normalized = lastSep >= 0
    ? `${clean.slice(0, lastSep).replace(/[.,]/g, '')}.${clean.slice(lastSep + 1)}`
    : clean;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
}
