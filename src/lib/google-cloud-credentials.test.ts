import { describe, expect, it } from 'vitest';
import { categorizeGoogleModels, isValidVertexLocation, parseServiceAccountJson, ServiceAccountError } from './google-cloud-credentials';

const valid = {
  type: 'service_account',
  project_id: 'automania-pod-123',
  private_key_id: 'abc',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n',
  client_email: 'automania@automania-pod-123.iam.gserviceaccount.com',
  client_id: '1',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
};

describe('parseServiceAccountJson', () => {
  it('accepts a service account key and keeps only auth fields', () => {
    const parsed = parseServiceAccountJson(JSON.stringify(valid));
    expect(parsed.project_id).toBe('automania-pod-123');
    expect(parsed.client_email).toBe(valid.client_email);
    expect(parsed).not.toHaveProperty('auth_uri');
  });

  it('rejects other credential files with a helpful message', () => {
    expect(() => parseServiceAccountJson('not json')).toThrow(ServiceAccountError);
    expect(() => parseServiceAccountJson(JSON.stringify({ installed: { client_id: 'x' } }))).toThrow(/hizmet hesabı/);
    expect(() => parseServiceAccountJson(JSON.stringify({ ...valid, private_key: '' }))).toThrow(/private_key/);
    expect(() => parseServiceAccountJson(JSON.stringify({ ...valid, client_email: 'a@gmail.com' }))).toThrow(/client_email/);
  });

  it('validates locations', () => {
    expect(isValidVertexLocation('global')).toBe(true);
    expect(isValidVertexLocation('mars-1')).toBe(false);
  });
});

describe('categorizeGoogleModels', () => {
  it('groups usable models and drops embeddings and audio models', () => {
    const models = categorizeGoogleModels([
      { name: 'publishers/google/models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
      { name: 'publishers/google/models/gemini-2.5-flash-image' },
      { name: 'publishers/google/models/imagen-4.0-generate-001' },
      { name: 'publishers/google/models/veo-3.0-generate-001' },
      { name: 'publishers/google/models/text-embedding-005' },
      { name: 'publishers/google/models/gemini-2.5-flash-preview-tts' },
      { name: 'models/gemini-2.5-flash' },
    ]);
    expect(models.map((m) => [m.id, m.category])).toEqual([
      ['veo-3.0-generate-001', 'video'],
      ['imagen-4.0-generate-001', 'image'],
      ['gemini-2.5-flash-image', 'image'],
      ['gemini-2.5-flash', 'text'],
    ]);
  });
});
