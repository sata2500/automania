import { describe, expect, it, vi } from 'vitest';

// Bölgeye göre farklı model listesi döndüren sahte istemci.
const catalog = vi.hoisted(() => ({
  lists: {} as Record<string, string[]>,
  gettable: new Set<string>(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    location: string;
    constructor(opts: { location?: string }) { this.location = opts.location ?? 'api'; }
    models = {
      list: async () => {
        const names = catalog.lists[this.location] ?? [];
        return (async function* () { for (const name of names) yield { name: `publishers/google/models/${name}` }; })();
      },
      get: async ({ model }: { model: string }) => {
        if (this.location !== 'us-central1' || !catalog.gettable.has(model)) throw new Error('404 NOT_FOUND');
        return { name: `publishers/google/models/${model}`, displayName: model };
      },
    };
  },
}));
vi.mock('@/lib/app-settings', () => ({ loadSettings: vi.fn(async () => ({})) }));

import { listGoogleModels, resolveVertexLocation, type GoogleConnection } from './google-genai-client';

const vertex = (location: string): GoogleConnection => ({
  mode: 'vertex', projectId: 'p-12345', location, clientEmail: 'a@p.iam.gserviceaccount.com',
  credentials: { type: 'service_account', project_id: 'p-12345', client_email: 'a@p.iam.gserviceaccount.com', private_key: 'k' },
});

describe('resolveVertexLocation', () => {
  it('always uses us-central1 for Veo and for Imagen on global', () => {
    expect(resolveVertexLocation('europe-west4', 'veo-3.1-generate-001')).toBe('us-central1');
    expect(resolveVertexLocation('global', 'imagen-4.0-generate-001')).toBe('us-central1');
    expect(resolveVertexLocation('europe-west4', 'imagen-4.0-generate-001')).toBe('europe-west4');
    expect(resolveVertexLocation('global', 'gemini-3.5-flash')).toBe('global');
  });
});

describe('listGoogleModels', () => {
  it('adds regional video/image models when the global list lacks them', async () => {
    catalog.lists = { global: ['gemini-3.5-flash'], 'us-central1': ['gemini-2.5-flash', 'imagen-4.0-generate-001', 'veo-3.1-generate-001'] };
    catalog.gettable = new Set(['veo-3.1-generate-001', 'veo-3.1-fast-generate-001']);
    const models = await listGoogleModels(vertex('global'));
    const ids = models.map((m) => m.id);
    expect(ids).toContain('gemini-3.5-flash');
    expect(ids).not.toContain('gemini-2.5-flash'); // bölgesel listeden yalnızca medya modelleri alınır
    expect(ids).toContain('imagen-4.0-generate-001');
    expect(models.filter((m) => m.category === 'video').map((m) => m.id).sort()).toEqual(['veo-3.1-fast-generate-001', 'veo-3.1-generate-001']);
  });

  it('probes known Veo models when no list returns them', async () => {
    catalog.lists = { global: ['gemini-3.5-flash'], 'us-central1': [] };
    catalog.gettable = new Set(['veo-3.1-lite-generate-001']);
    const models = await listGoogleModels(vertex('global'));
    expect(models.filter((m) => m.category === 'video').map((m) => m.id)).toEqual(['veo-3.1-lite-generate-001']);
  });
});
