/** Sayfanın ana sekmesine başka bir bileşenden geçiş (ör. Hazır İlanlar › "Ayarlar'da varyasyon oluştur"). */
export const OPEN_TAB_EVENT = 'automania:open-tab';

export function openAppTab(tab: 'mockups' | 'designs' | 'generator' | 'listings' | 'settings') {
  window.dispatchEvent(new CustomEvent(OPEN_TAB_EVENT, { detail: tab }));
}
