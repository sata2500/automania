/**
 * Çalışma alanı koleksiyonları üzerinde saf (yan etkisiz) yardımcılar:
 * misafir verisinin hesapla birleştirilmesi ve medya dosyası referans kontrolü.
 */
import type { DesignItem, MockupFolder, MockupItem, RenderedMatch } from '@/types/pod';

export interface WorkspaceCollections {
  mockups: MockupItem[];
  designs: DesignItem[];
  folders: MockupFolder[];
  etsyGeneratedMockups: RenderedMatch[];
}

const folderType = (folder: MockupFolder) => folder.type ?? 'mockup';

/**
 * Misafir öğelerini hesabın verisine ekler. Hesaptaki hiçbir öğe silinmez veya değiştirilmez.
 * Aynı ad ve türdeki misafir klasörü hesaptaki klasörle birleştirilir ve misafir öğeleri o klasöre taşınır.
 */
export function mergeGuestIntoAccount(
  account: Partial<WorkspaceCollections>,
  guest: Partial<WorkspaceCollections>,
): WorkspaceCollections {
  const folders = [...(account.folders || [])];
  const folderIdMap = new Map<string, string>();

  for (const guestFolder of guest.folders || []) {
    const sameId = folders.find((f) => f.id === guestFolder.id);
    if (sameId) continue;
    const sameName = folders.find((f) => f.name === guestFolder.name && folderType(f) === folderType(guestFolder));
    if (sameName) {
      folderIdMap.set(guestFolder.id, sameName.id);
      continue;
    }
    folders.push(guestFolder);
  }

  const remapFolder = <T extends { folderId?: string }>(item: T): T => {
    const mapped = item.folderId ? folderIdMap.get(item.folderId) : undefined;
    return mapped ? { ...item, folderId: mapped } : item;
  };

  const mockups = [...(account.mockups || [])];
  for (const guestMockup of guest.mockups || []) {
    if (!mockups.some((m) => m.id === guestMockup.id || (m.src && m.src === guestMockup.src))) {
      mockups.push(remapFolder(guestMockup));
    }
  }

  const designs = [...(account.designs || [])];
  for (const guestDesign of guest.designs || []) {
    if (!designs.some((d) => d.id === guestDesign.id || (d.src && d.src === guestDesign.src))) {
      designs.push(remapFolder(guestDesign));
    }
  }

  const etsyGeneratedMockups = [...(account.etsyGeneratedMockups || [])];
  for (const guestGenerated of guest.etsyGeneratedMockups || []) {
    if (!etsyGeneratedMockups.some((g) => g.id === guestGenerated.id)) {
      etsyGeneratedMockups.push(guestGenerated);
    }
  }

  return { mockups, designs, folders, etsyGeneratedMockups };
}

/** Çalışma alanında hâlâ kullanılan tüm medya URL'leri. */
export function collectReferencedMediaUrls(collections: Partial<WorkspaceCollections>): Set<string> {
  const urls = new Set<string>();
  for (const mockup of collections.mockups || []) if (mockup.src) urls.add(mockup.src);
  for (const design of collections.designs || []) if (design.src) urls.add(design.src);
  for (const generated of collections.etsyGeneratedMockups || []) if (generated.previewUrl) urls.add(generated.previewUrl);
  return urls;
}

/**
 * Silinmek istenen URL'lerden, işlem sonrası çalışma alanında başka bir öğe tarafından
 * kullanılmaya devam edenleri çıkarır (ör. çoğaltılmış klasördeki mockup'lar aynı dosyayı paylaşır).
 */
export function filterUnreferencedUrls(urls: Iterable<string>, remaining: Partial<WorkspaceCollections>): string[] {
  const stillReferenced = collectReferencedMediaUrls(remaining);
  const result = new Set<string>();
  for (const url of urls) {
    if (url && !stillReferenced.has(url)) result.add(url);
  }
  return [...result];
}

const sameItem = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Üç yönlü birleştirme (ortak taban, bu cihaz, sunucu) — öğeler kimliğe göre eşleştirilir.
 * - Yalnızca bir tarafta değişen öğe o taraftan alınır; iki tarafta da değiştiyse bu cihazdaki düzenleme kazanır.
 * - Bu cihazda silinen öğe silinmiş kalır; sunucuda silinen öğe, burada düzenlenmediyse silinir.
 * - Sunucuya eklenen öğeler (ör. otomasyonun ürettiği tasarım) eklenir; sıra bu cihazdaki sıradır.
 */
export function threeWayMergeById<T extends { id: string }>(base: T[], local: T[], server: T[]): T[] {
  const baseById = new Map(base.map((item) => [item.id, item]));
  const serverById = new Map(server.map((item) => [item.id, item]));
  const localIds = new Set(local.map((item) => item.id));
  const result: T[] = [];

  for (const item of local) {
    const before = baseById.get(item.id);
    const remote = serverById.get(item.id);
    if (!remote) {
      // Sunucuda yok: sunucuda silindiyse ve burada değişmediyse düşer; yeni eklendiyse kalır.
      if (before && sameItem(before, item)) continue;
      result.push(item);
      continue;
    }
    const changedHere = !before || !sameItem(before, item);
    result.push(changedHere ? item : remote);
  }
  for (const item of server) {
    if (localIds.has(item.id)) continue;
    if (baseById.has(item.id)) continue; // bu cihazda silindi
    result.push(item);
  }
  return result;
}

/** Çalışma alanı koleksiyonlarını üç yönlü birleştirir. */
export function mergeWorkspaceChanges(
  base: Pick<WorkspaceCollections, 'mockups' | 'designs' | 'folders'>,
  local: Pick<WorkspaceCollections, 'mockups' | 'designs' | 'folders'>,
  server: Pick<WorkspaceCollections, 'mockups' | 'designs' | 'folders'>,
): Pick<WorkspaceCollections, 'mockups' | 'designs' | 'folders'> {
  return {
    mockups: threeWayMergeById(base.mockups, local.mockups, server.mockups),
    designs: threeWayMergeById(base.designs, local.designs, server.designs),
    folders: threeWayMergeById(base.folders, local.folders, server.folders),
  };
}
