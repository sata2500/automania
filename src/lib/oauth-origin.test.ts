import { describe, expect, it } from 'vitest';
import { getCanonicalAppOrigin } from './oauth-origin';

describe('getCanonicalAppOrigin', () => {
  it('canonicalizes local loopback aliases to localhost and preserves the port', () => {
    expect(getCanonicalAppOrigin('http://0.0.0.0:3000')).toBe('http://localhost:3000');
    expect(getCanonicalAppOrigin('http://127.0.0.1:4173/')).toBe('http://localhost:4173');
    expect(getCanonicalAppOrigin('https://localhost')).toBe('https://localhost');
  });

  it('prefers the configured origin for non-local requests', () => {
    expect(
      getCanonicalAppOrigin('https://preview.example.vercel.app/path', 'https://automania.example.com/'),
    ).toBe('https://automania.example.com');
  });

  it('falls back to the request origin when production configuration is absent', () => {
    expect(getCanonicalAppOrigin('https://automania.example.com/path', '  ')).toBe(
      'https://automania.example.com',
    );
  });
});
