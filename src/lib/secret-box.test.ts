import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSealed, openSecret, openSecretOrNull, sealSecret } from './secret-box';

const KEY = 'k'.repeat(48);

describe('secret-box', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('round-trips values with a configured key', () => {
    vi.stubEnv('DATA_ENCRYPTION_KEY', KEY);
    const sealed = sealSecret('etsy-access-token');
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain('etsy-access-token');
    expect(openSecret(sealed)).toBe('etsy-access-token');
  });

  it('uses a random IV for every encryption', () => {
    vi.stubEnv('DATA_ENCRYPTION_KEY', KEY);
    expect(sealSecret('same')).not.toBe(sealSecret('same'));
  });

  it('does not double-encrypt sealed values', () => {
    vi.stubEnv('DATA_ENCRYPTION_KEY', KEY);
    const sealed = sealSecret('value');
    expect(sealSecret(sealed)).toBe(sealed);
  });

  it('returns legacy plaintext values unchanged', () => {
    vi.stubEnv('DATA_ENCRYPTION_KEY', KEY);
    expect(openSecret('legacy-plaintext')).toBe('legacy-plaintext');
  });

  it('falls back to plaintext when no key is configured', () => {
    vi.stubEnv('DATA_ENCRYPTION_KEY', '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(sealSecret('value')).toBe('value');
  });

  it('detects tampering and wrong keys', () => {
    vi.stubEnv('DATA_ENCRYPTION_KEY', KEY);
    const sealed = sealSecret('value');
    const tampered = `${sealed.slice(0, -2)}AA`;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(openSecretOrNull(tampered)).toBeNull();

    vi.stubEnv('DATA_ENCRYPTION_KEY', 'z'.repeat(48));
    expect(openSecretOrNull(sealed)).toBeNull();
  });

  it('rejects keys that are too short', () => {
    vi.stubEnv('DATA_ENCRYPTION_KEY', 'short');
    expect(() => sealSecret('value')).toThrow();
  });
});
