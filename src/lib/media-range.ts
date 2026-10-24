/**
 * Tek aralıklı HTTP Range başlığını ("bytes=start-end", "bytes=start-", "bytes=-suffix") çözer.
 * Başlık yoksa veya desteklenmeyen biçimdeyse null döner (tam dosya gönderilir);
 * dosya sınırları dışındaysa 'unsatisfiable' döner (416).
 */
export function parseByteRange(header: string | null | undefined, size: number): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;

  let start: number;
  let end: number;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (suffix === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}
