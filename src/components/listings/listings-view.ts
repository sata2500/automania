/** İlanlar sekmesinin alt görünümü: sayfa ve diğer bileşenler buradan geçiş ister (hub tembel yüklenir). */
import { STORAGE_KEYS } from '@/config/constants';

export type ListingsView = 'review' | 'studio' | 'etsy';

export const LISTINGS_OPEN_EVENT = 'automania:open-listings';

export const isListingsView = (value: unknown): value is ListingsView => value === 'review' || value === 'studio' || value === 'etsy';

/** İlanlar sekmesinin hangi alt görünümle açılacağını ayarlar (sekme açıksa hemen geçer). */
export function openListingsView(view: ListingsView) {
  try { localStorage.setItem(STORAGE_KEYS.LISTINGS_VIEW, view); } catch {}
  window.dispatchEvent(new CustomEvent(LISTINGS_OPEN_EVENT, { detail: view }));
}

export function readSavedListingsView(): ListingsView {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.LISTINGS_VIEW);
    if (isListingsView(saved)) return saved;
  } catch {}
  return 'review';
}

const AUTO_DRAFT_KEY = 'automania_studio_auto_draft';

/** Üretimden "otomatik ilan hazırla": stüdyo açılınca bu klasör için metni üretip ilanı Hazır İlanlar'a ekler. */
export function requestStudioAutoDraft(folderId: string) {
  try { sessionStorage.setItem(AUTO_DRAFT_KEY, folderId); } catch {}
}

/** Bekleyen otomatik ilan isteği (silinmez; işleme başlanınca clearStudioAutoDraft çağrılır). */
export function peekStudioAutoDraft(): string | null {
  try { return sessionStorage.getItem(AUTO_DRAFT_KEY); } catch { return null; }
}

export function clearStudioAutoDraft() {
  try { sessionStorage.removeItem(AUTO_DRAFT_KEY); } catch {}
}
