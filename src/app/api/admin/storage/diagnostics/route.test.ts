import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdminMock, sqlMock, isR2ConfiguredMock, listR2ObjectsMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  sqlMock: vi.fn(),
  isR2ConfiguredMock: vi.fn(),
  listR2ObjectsMock: vi.fn(),
}));

vi.mock('@/lib/auth-server', () => ({ requireAdmin: requireAdminMock }));
vi.mock('@/lib/db', () => ({ default: sqlMock }));
vi.mock('@/lib/r2', () => ({
  isR2Configured: isR2ConfiguredMock,
  listR2Objects: listR2ObjectsMock,
  extractKeyFromUrlOrKey: (value: string) => {
    const marker = '/api/r2/';
    const index = value.indexOf(marker);
    return index >= 0 ? value.slice(index + marker.length) : value;
  },
}));

import { GET } from './route';

describe('GET /api/admin/storage/diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ id: 'admin-test', role: 'admin' });
    sqlMock.mockResolvedValue([]);
    isR2ConfiguredMock.mockReturnValue(false);
  });

  it('rejects non-admin requests before reading workspace or R2', async () => {
    requireAdminMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, error: 'Unauthorized' });
    expect(sqlMock).not.toHaveBeenCalled();
    expect(listR2ObjectsMock).not.toHaveBeenCalled();
  });

  it('returns anonymous record and temporary URL counts without R2 access when disabled', async () => {
    sqlMock.mockResolvedValue([{
      mockups: [{ src: '/api/r2/user-key-1.webp' }, { src: 'data:image/png;base64,abc' }],
      designs: [{ src: '/api/r2/user-key-2.webp' }],
      etsy_generated_mockups: [{ previewUrl: 'blob:generated' }],
    }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.records).toMatchObject({
      mockups: 2,
      designs: 1,
      generatedMockups: 1,
      durable: 2,
      temporary: 2,
    });
    expect(body.referencedR2Objects).toBe(2);
    expect(body.r2).toMatchObject({ configured: false, objectCount: 0 });
    expect(listR2ObjectsMock).not.toHaveBeenCalled();
  });

  it('separates missing references from unreferenced R2 objects', async () => {
    isR2ConfiguredMock.mockReturnValue(true);
    sqlMock.mockResolvedValue([{
      mockups: [{ src: '/api/r2/user-key-1.webp' }, { src: '/api/r2/user-key-2.webp' }],
      designs: [{ src: '/api/r2/user-key-3.webp' }],
      etsy_generated_mockups: [],
    }]);
    listR2ObjectsMock.mockResolvedValue({
      objects: [
        { key: 'user-key-1.webp', size: 10, url: '/api/r2/user-key-1.webp' },
        { key: 'orphan.webp', size: 20, url: '/api/r2/orphan.webp' },
      ],
      hasMore: false,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.referencedR2Objects).toBe(3);
    expect(body.r2).toMatchObject({
      configured: true,
      objectCount: 2,
      totalBytes: 30,
      missingReferencedObjectCount: 2,
      orphanObjectCount: 1,
    });
  });
});
