import type { ListingReviewStatus } from '@/types/templates';

export const STATUS_BADGES: Record<ListingReviewStatus, { label: string; className: string }> = {
  awaiting: { label: 'İnceleme bekliyor', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  scheduled: { label: 'Zamanlandı', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  publishing: { label: 'Yayınlanıyor', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  published: { label: 'Yayında', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  rejected: { label: 'Reddedildi', className: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  failed: { label: 'Yayınlanamadı', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

/** `datetime-local` alanı için yerel saatle "YYYY-MM-DDTHH:mm". */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

export type SchedulePreset = { key: string; label: string; at: Date; intervalMinutes?: number };

const at = (base: Date, dayOffset: number, hour: number) => {
  const date = new Date(base);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date;
};

/**
 * Tek tıkla zamanlama seçenekleri (yerel saat). Zamanlayıcı saat başlarında çalıştığı için hepsi tam saattir.
 * `withDaily` toplu zamanlamada "her gün bir ilan" seçeneğini ekler.
 */
export function schedulePresets(now: Date, withDaily = false): SchedulePreset[] {
  const presets: SchedulePreset[] = [];
  if (now.getHours() < 19) presets.push({ key: 'tonight', label: 'Bu akşam 20:00', at: at(now, 0, 20) });
  presets.push({ key: 'tomorrow-morning', label: 'Yarın 09:00', at: at(now, 1, 9) });
  presets.push({ key: 'tomorrow-evening', label: 'Yarın 20:00', at: at(now, 1, 20) });
  const daysToSaturday = (6 - now.getDay() + 7) % 7 || 7;
  presets.push({ key: 'weekend', label: 'Cumartesi 10:00', at: at(now, daysToSaturday, 10) });
  if (withDaily) presets.push({ key: 'daily', label: 'Yarından itibaren her gün 09:00', at: at(now, 1, 9), intervalMinutes: 1440 });
  return presets;
}
