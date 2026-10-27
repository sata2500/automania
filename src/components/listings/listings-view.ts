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
