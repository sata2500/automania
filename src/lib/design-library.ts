/**
 * Tasarımlar sekmesinin bölümleri ve arka plan bakım kuralları (saf modül; istemci ve sunucuda kullanılır).
 * Klasör yoktur: "Tasarımlarım" (yüklenen + yapay zekâ ile üretilen) ve "Otomasyon" (otomasyonların
 * ürettiği) bölümleri vardır; ikisi de en yeniden eskiye sıralanır.
 */
import type { DesignItem } from '@/types/pod';

/** Otomasyon tasarımlarının işareti (eski sürümlerde "Otomasyon Tasarımları" klasörünün kimliğiydi). */
export const AUTOMATION_DESIGN_FOLDER_ID = 'design-folder-automation';

export type DesignSection = 'mine' | 'automation';

export function isAutomationDesign(design: Pick<DesignItem, 'folderId'>): boolean {
  return design.folderId === AUTOMATION_DESIGN_FOLDER_ID;
}

export function designSection(design: Pick<DesignItem, 'folderId'>): DesignSection {
  return isAutomationDesign(design) ? 'automation' : 'mine';
}

/** Oluşturulma zamanı; eski kayıtlarda kimlikteki zaman damgasından (design-1730000000000-…) okunur. */
export function designCreatedAt(design: Pick<DesignItem, 'id' | 'createdAt'>): number {
  if (typeof design.createdAt === 'number' && Number.isFinite(design.createdAt)) return design.createdAt;
  const match = /(\d{12,14})/.exec(design.id);
  return match ? Number(match[1]) : 0;
}

/** En yeni tasarım önce; zamanı bilinmeyenler sona, kendi aralarında mevcut sırasıyla. */
export function sortNewestFirst<T extends Pick<DesignItem, 'id' | 'createdAt'>>(designs: T[]): T[] {
  return designs
    .map((design, index) => ({ design, index, at: designCreatedAt(design) }))
    .sort((a, b) => b.at - a.at || a.index - b.index)
    .map(({ design }) => design);
}

/** Sunucuda kalıcı adresi olan ve henüz kırpma + kayıpsız sıkıştırmadan geçmemiş tasarım. */
export function needsOptimization(design: Pick<DesignItem, 'src' | 'optimizedAt'>): boolean {
  return !design.optimizedAt && Boolean(design.src) && !design.src.startsWith('data:') && !design.src.startsWith('blob:');
}
