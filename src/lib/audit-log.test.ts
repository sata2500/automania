import { describe, expect, it } from 'vitest';
import { sanitizeAuditMetadata } from './audit-log-security';

describe('audit metadata security', () => {
  it('redacts sensitive keys recursively without exposing values', () => {
    expect(sanitizeAuditMetadata({
      action: 'settings.updated',
      apiKey: 'sk-secret',
      nested: { access_token: 'oauth-secret', visible: 'ok' },
    })).toEqual({
      action: 'settings.updated',
      apiKey: '[redacted]',
      nested: { access_token: '[redacted]', visible: 'ok' },
    });
  });
});
