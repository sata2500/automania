import { describe, expect, it } from 'vitest';
import { filterUnreferencedUrls, mergeGuestIntoAccount, threeWayMergeById } from './workspace-merge';
import type { DesignItem, MockupFolder, MockupItem, RenderedMatch } from '@/types/pod';

const mockup = (id: string, src: string, folderId?: string) =>
  ({ id, name: id, src, folderId, apparelType: 'light', printAreas: [], opacity: 1, width: 10, height: 10 }) as MockupItem;
const design = (id: string, src: string, folderId?: string) => ({ id, name: id, src, folderId, width: 10, height: 10 }) as DesignItem;
const generated = (id: string, previewUrl: string) => ({ id, previewUrl, folderId: 'batch-1' }) as RenderedMatch;

describe('mergeGuestIntoAccount', () => {
  it('keeps every account item, including saved Etsy generation results', () => {
    const account = {
      mockups: [mockup('m1', '/api/r2/a')],
      designs: [design('d1', '/api/r2/b')],
      folders: [],
      etsyGeneratedMockups: [generated('g1', '/api/r2/g1'), generated('g2', '/api/r2/g2')],
    };
    const guest = { mockups: [mockup('m2', 'data:image/webp;base64,AA')], etsyGeneratedMockups: [] };

    const merged = mergeGuestIntoAccount(account, guest);

    expect(merged.etsyGeneratedMockups.map((g) => g.id)).toEqual(['g1', 'g2']);
    expect(merged.mockups.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(merged.designs.map((d) => d.id)).toEqual(['d1']);
  });

  it('skips guest items that already exist by id or file', () => {
    const merged = mergeGuestIntoAccount(
      { mockups: [mockup('m1', '/api/r2/a')], designs: [design('d1', '/api/r2/b')] },
      { mockups: [mockup('m1', '/x'), mockup('m9', '/api/r2/a')], designs: [design('d9', '/api/r2/b')] },
    );
    expect(merged.mockups).toHaveLength(1);
    expect(merged.designs).toHaveLength(1);
  });

  it('moves guest items into the account folder that has the same name and type', () => {
    const accountFolder: MockupFolder = { id: 'acc-tees', name: 'Tees', type: 'mockup' };
    const guestFolder: MockupFolder = { id: 'guest-tees', name: 'Tees', type: 'mockup' };
    const guestDesignFolder: MockupFolder = { id: 'guest-d', name: 'Tees', type: 'design' };

    const merged = mergeGuestIntoAccount(
      { folders: [accountFolder] },
      {
        folders: [guestFolder, guestDesignFolder],
        mockups: [mockup('m2', '/api/r2/m2', 'guest-tees')],
        designs: [design('d2', '/api/r2/d2', 'guest-d')],
      },
    );

    expect(merged.folders.map((f) => f.id)).toEqual(['acc-tees', 'guest-d']);
    expect(merged.mockups[0].folderId).toBe('acc-tees');
    expect(merged.designs[0].folderId).toBe('guest-d');
  });
});

describe('filterUnreferencedUrls', () => {
  it('keeps files that another item still uses (duplicated folders share files)', () => {
    const remaining = { mockups: [mockup('copy', '/api/r2/shared')] };
    expect(filterUnreferencedUrls(['/api/r2/shared', '/api/r2/only-mine'], remaining)).toEqual(['/api/r2/only-mine']);
  });

  it('checks references across mockups, designs and generated results', () => {
    const remaining = {
      designs: [design('d', '/api/r2/design')],
      etsyGeneratedMockups: [generated('g', '/api/r2/video')],
    };
    expect(filterUnreferencedUrls(['/api/r2/design', '/api/r2/video', '/api/r2/free'], remaining)).toEqual(['/api/r2/free']);
  });

  it('deduplicates and drops empty values', () => {
    expect(filterUnreferencedUrls(['/a', '/a', ''], {})).toEqual(['/a']);
  });
});

describe('threeWayMergeById', () => {
  const a = { id: 'a', v: 1 };
  const b = { id: 'b', v: 1 };
  it('keeps local edits and adds items created on the server (automation designs)', () => {
    const merged = threeWayMergeById([a, b], [{ id: 'a', v: 2 }, b], [a, b, { id: 'auto', v: 1 }]);
    expect(merged).toEqual([{ id: 'a', v: 2 }, b, { id: 'auto', v: 1 }]);
  });
  it('takes server edits for items untouched here and respects deletions on both sides', () => {
    const merged = threeWayMergeById([a, b], [a], [{ id: 'a', v: 3 }, b]);
    expect(merged).toEqual([{ id: 'a', v: 3 }]); // b burada silindi
    expect(threeWayMergeById([a, b], [a, b], [a])).toEqual([a]); // b sunucuda silindi
  });
  it('lets the local edit win when both sides changed the same item and keeps local order', () => {
    const merged = threeWayMergeById([a, b], [b, { id: 'a', v: 5 }], [{ id: 'a', v: 9 }, b]);
    expect(merged).toEqual([b, { id: 'a', v: 5 }]);
  });
});
