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
