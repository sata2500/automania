/**
 * Şablon zamanlamalarını değerlendiren saf yardımcılar.
 * Arayüz zamanlamayı "0 H1,H2,... * * *" (veya "0 *\/N * * *") biçiminde ve bir
 * IANA saat diliminde kaydeder; zamanlayıcı saatte bir çağrılır.
 */

/** Cron ifadesinin saat alanından çalışılacak saatleri (0-23) çözer. */
export function parseScheduledHours(cronExpression: string): number[] {
  const parts = (cronExpression || '').trim().split(/\s+/);
  if (parts.length < 5) return [];
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  // Yalnızca arayüzün ürettiği günlük saat listeleri desteklenir.
  if (minute !== '0' || dayOfMonth !== '*' || month !== '*' || dayOfWeek !== '*') return [];

  if (hour === '*') return Array.from({ length: 24 }, (_, h) => h);
  const step = /^\*\/(\d+)$/.exec(hour);
  if (step) {
    const interval = Number(step[1]);
    if (!Number.isInteger(interval) || interval < 1 || interval > 24) return [];
    return Array.from({ length: Math.ceil(24 / interval) }, (_, i) => i * interval);
  }

  const hours = hour.split(',').map((h) => Number(h));
  if (hours.some((h) => !Number.isInteger(h) || h < 0 || h > 23)) return [];
  return [...new Set(hours)].sort((a, b) => a - b);
}

/** Verilen anın, saat diliminde kaçıncı saat olduğunu döner (0-23). */
export function hourInTimeZone(now: Date, timeZone: string): number | null {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now);
    const hour = Number(formatted);
    return Number.isInteger(hour) ? hour : null;
  } catch {
    return null; // Geçersiz saat dilimi
  }
}

/** Şablonun bu saatte çalışması gerekiyor mu? */
export function isDueThisHour(schedule: { enabled?: boolean; cronExpression?: string; timezone?: string } | null | undefined, now: Date): boolean {
  if (!schedule?.enabled) return false;
  const hour = hourInTimeZone(now, schedule.timezone || 'UTC');
  if (hour === null) return false;
  return parseScheduledHours(schedule.cronExpression || '').includes(hour);
}

/** Her çalışmada üretilecek listing sayısı (1-5 arasında sınırlanır). */
export function clampListingsPerRun(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 1;
}

const HOUR_MS = 60 * 60 * 1000;
const floorToHour = (date: Date) => new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS);

type ScheduleLike = { enabled?: boolean; cronExpression?: string; timezone?: string } | null | undefined;

/**
 * Son `lookbackHours` saat içinde zamanı gelmiş en yakın çalışma saatinin başlangıcı (yoksa null).
 * Zamanlayıcı bir saati kaçırırsa (GitHub Actions gecikmesi/atlaması) sonraki tetiklemede telafi edilir;
 * çağıran, bu andan sonra zaten bir çalıştırma oluşturulmuşsa tekrar oluşturmamalıdır.
 */
export function latestDueSlot(schedule: ScheduleLike, now: Date, lookbackHours = 3): Date | null {
  if (!schedule?.enabled) return null;
  const hours = parseScheduledHours(schedule.cronExpression || '');
  if (hours.length === 0) return null;
  const timeZone = schedule.timezone || 'UTC';
  for (let back = 0; back <= lookbackHours; back++) {
    const slot = floorToHour(new Date(now.getTime() - back * HOUR_MS));
    const hour = hourInTimeZone(slot, timeZone);
    if (hour !== null && hours.includes(hour)) return slot;
  }
  return null;
}

/** Bir sonraki planlı çalışma saati (en fazla 48 saat ileriye bakılır). */
export function computeNextRunAt(schedule: ScheduleLike, now: Date): Date | null {
  if (!schedule?.enabled) return null;
  const hours = parseScheduledHours(schedule.cronExpression || '');
  if (hours.length === 0) return null;
  const timeZone = schedule.timezone || 'UTC';
  const start = floorToHour(now).getTime() + HOUR_MS;
  for (let ahead = 0; ahead < 48; ahead++) {
    const slot = new Date(start + ahead * HOUR_MS);
    const hour = hourInTimeZone(slot, timeZone);
    if (hour !== null && hours.includes(hour)) return slot;
  }
  return null;
}
