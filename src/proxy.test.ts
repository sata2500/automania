import { describe, expect, it } from 'vitest';
import { isRateLimitExemptMediaRead } from './proxy';

describe('isRateLimitExemptMediaRead', () => {
  it('exempts only media reads', () => {
    expect(isRateLimitExemptMediaRead('GET', '/api/r2/user-1-abc.png')).toBe(true);
    expect(isRateLimitExemptMediaRead('HEAD', '/api/uploads/user-1-abc.mp4')).toBe(true);
    expect(isRateLimitExemptMediaRead('POST', '/api/r2/user-1-abc.png')).toBe(false);
    expect(isRateLimitExemptMediaRead('GET', '/api/storage')).toBe(false);
    expect(isRateLimitExemptMediaRead('GET', '/api/r2')).toBe(false);
  });
});
