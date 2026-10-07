import { describe, expect, it } from 'vitest';
import { clampListingsPerRun, hourInTimeZone, isDueThisHour, parseScheduledHours } from './automation-schedule';

describe('parseScheduledHours', () => {
  it('parses hour lists produced by the schedule UI', () => {
    expect(parseScheduledHours('0 9 * * *')).toEqual([9]);
    expect(parseScheduledHours('0 18,0,6,12 * * *')).toEqual([0, 6, 12, 18]);
    expect(parseScheduledHours('0 */6 * * *')).toEqual([0, 6, 12, 18]);
  });

  it('rejects unsupported or invalid expressions', () => {
    expect(parseScheduledHours('30 9 * * *')).toEqual([]);
    expect(parseScheduledHours('0 9 * * 1')).toEqual([]);
    expect(parseScheduledHours('0 25 * * *')).toEqual([]);
    expect(parseScheduledHours('garbage')).toEqual([]);
  });
});

describe('isDueThisHour', () => {
  const now = new Date('2026-10-07T13:20:00Z'); // 09:20 in New York (EDT)

  it('respects the template time zone', () => {
    expect(hourInTimeZone(now, 'America/New_York')).toBe(9);
    expect(isDueThisHour({ enabled: true, cronExpression: '0 9 * * *', timezone: 'America/New_York' }, now)).toBe(true);
    expect(isDueThisHour({ enabled: true, cronExpression: '0 9 * * *', timezone: 'Europe/Istanbul' }, now)).toBe(false);
  });

  it('never runs disabled schedules or invalid time zones', () => {
    expect(isDueThisHour({ enabled: false, cronExpression: '0 9 * * *', timezone: 'America/New_York' }, now)).toBe(false);
    expect(isDueThisHour({ enabled: true, cronExpression: '0 9 * * *', timezone: 'Mars/Base' }, now)).toBe(false);
  });
});

describe('clampListingsPerRun', () => {
  it('keeps the value between 1 and 5', () => {
    expect(clampListingsPerRun(0)).toBe(1);
    expect(clampListingsPerRun(3)).toBe(3);
    expect(clampListingsPerRun(50)).toBe(5);
    expect(clampListingsPerRun('x')).toBe(1);
  });
});
