import { describe, expect, it } from 'vitest';
import { parseByteRange } from './media-range';

describe('parseByteRange', () => {
  it('returns null without a usable header', () => {
    expect(parseByteRange(null, 100)).toBeNull();
    expect(parseByteRange('bytes=0-1,5-6', 100)).toBeNull();
    expect(parseByteRange('items=0-1', 100)).toBeNull();
  });

  it('parses closed, open and suffix ranges', () => {
    expect(parseByteRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(parseByteRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange('bytes=50-500', 100)).toEqual({ start: 50, end: 99 });
  });

  it('rejects ranges outside the file', () => {
    expect(parseByteRange('bytes=100-', 100)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=9-2', 100)).toBe('unsatisfiable');
  });
});
