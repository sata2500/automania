import { describe, expect, it } from 'vitest';
import { schedulePresets } from './format';

describe('schedulePresets', () => {
  it('offers tonight only before 19:00 and always lands on full hours', () => {
    const morning = schedulePresets(new Date(2026, 9, 27, 10, 15)); // Salı
    expect(morning.map((p) => p.key)).toEqual(['tonight', 'tomorrow-morning', 'tomorrow-evening', 'weekend']);
    expect(morning[0]!.at.getHours()).toBe(20);
    expect(morning.every((p) => p.at.getMinutes() === 0)).toBe(true);
    expect(schedulePresets(new Date(2026, 9, 27, 21, 0)).some((p) => p.key === 'tonight')).toBe(false);
  });

  it('picks the coming Saturday (next week when today is Saturday) and adds daily for bulk', () => {
    const tuesday = schedulePresets(new Date(2026, 9, 27, 10), true);
    expect(tuesday.find((p) => p.key === 'weekend')!.at.getDate()).toBe(31);
    expect(tuesday.find((p) => p.key === 'daily')).toMatchObject({ intervalMinutes: 1440 });
    const saturday = schedulePresets(new Date(2026, 9, 31, 10));
    expect(saturday.find((p) => p.key === 'weekend')!.at.getDate()).toBe(7);
  });
});
