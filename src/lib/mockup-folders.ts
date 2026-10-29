/**
 * Mockup klasör kuralları (saf modül). "Tüm Mockup'lar" görünümü yoktur: her mockup bir klasöre aittir ve
 * Mockup'lar ile Üretim sekmelerinde her zaman bir klasör seçilidir. Bir klasör bir Etsy ilanına karşılık
 * gelir: en fazla 20 görsel ve 1 video (Etsy API'si ilan başına tek video yükletir).
 */
import type { MockupFolder, MockupItem } from '@/types/pod';

/** Klasörü olmayan eski mockup'ların toplandığı klasör. */
export const UNSORTED_MOCKUP_FOLDER: MockupFolder = { id: 'folder-unsorted', name: "Klasörsüz mockup'lar", isCustom: true, type: 'mockup' };

export const MAX_FOLDER_PHOTOS = 20;
export const MAX_FOLDER_VIDEOS = 1;

export const isMockupFolder = (folder: MockupFolder) => folder.type !== 'design';

/**
 * Klasörü olmayan (veya klasörü silinmiş) mockup'ları "Klasörsüz mockup'lar" klasörüne alır. Değişiklik
 * yoksa aynı dizileri döndürür (`changed: false`).
 */
export function assignUnsortedMockups(mockups: MockupItem[], folders: MockupFolder[]): { mockups: MockupItem[]; folders: MockupFolder[]; changed: boolean } {
  const ids = new Set(folders.filter(isMockupFolder).map((f) => f.id));
  if (!mockups.some((m) => !m.folderId || !ids.has(m.folderId))) return { mockups, folders, changed: false };
  return {
    mockups: mockups.map((m) => (m.folderId && ids.has(m.folderId) ? m : { ...m, folderId: UNSORTED_MOCKUP_FOLDER.id })),
    folders: ids.has(UNSORTED_MOCKUP_FOLDER.id) ? folders : [...folders, UNSORTED_MOCKUP_FOLDER],
    changed: true,
  };
}

/** Seçili klasör yoksa veya silindiyse ilk mockup klasörü; hiç klasör yoksa null. */
export function resolveActiveMockupFolder(activeFolderId: string | null, folders: MockupFolder[]): string | null {
  const mockupFolders = folders.filter(isMockupFolder);
  if (activeFolderId && mockupFolders.some((f) => f.id === activeFolderId)) return activeFolderId;
  return mockupFolders[0]?.id ?? null;
}
