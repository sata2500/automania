import { describe, expect, it } from 'vitest';
import type { MockupFolder, MockupItem } from '@/types/pod';
import { assignUnsortedMockups, resolveActiveMockupFolder, UNSORTED_MOCKUP_FOLDER } from './mockup-folders';

const folder = (id: string, type: MockupFolder['type'] = 'mockup'): MockupFolder => ({ id, name: id, type });
const mockup = (id: string, folderId?: string) => ({ id, folderId } as MockupItem);

describe('mockup folders', () => {
  it('moves mockups without a (valid) folder into the unsorted folder once', () => {
    const folders = [folder('a'), folder('d', 'design')];
    const result = assignUnsortedMockups([mockup('1', 'a'), mockup('2'), mockup('3', 'gone'), mockup('4', 'd')], folders);
    expect(result.changed).toBe(true);
    expect(result.mockups.map((m) => m.folderId)).toEqual(['a', UNSORTED_MOCKUP_FOLDER.id, UNSORTED_MOCKUP_FOLDER.id, UNSORTED_MOCKUP_FOLDER.id]);
    expect(result.folders.map((f) => f.id)).toEqual(['a', 'd', UNSORTED_MOCKUP_FOLDER.id]);
    const again = assignUnsortedMockups(result.mockups, result.folders);
    expect(again.changed).toBe(false);
    expect(again.mockups).toBe(result.mockups);
  });

  it('always resolves to an existing mockup folder', () => {
    const folders = [folder('d', 'design'), folder('a'), folder('b')];
    expect(resolveActiveMockupFolder('b', folders)).toBe('b');
    expect(resolveActiveMockupFolder(null, folders)).toBe('a');
    expect(resolveActiveMockupFolder('deleted', folders)).toBe('a');
    expect(resolveActiveMockupFolder('d', folders)).toBe('a');
    expect(resolveActiveMockupFolder(null, [folder('d', 'design')])).toBeNull();
  });
});
