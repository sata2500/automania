import { describe, expect, it } from 'vitest';
import { formatValidationError, templateInputSchema, templateUpdateSchema } from './templates';

describe('template validation', () => {
  it('accepts a minimal template and fills defaults', () => {
    const parsed = templateInputSchema.parse({ name: '  Kedi tişörtleri ', automationSchedule: {} });
    expect(parsed.name).toBe('Kedi tişörtleri');
    expect(parsed.automationSchedule).toMatchObject({ enabled: false, listingsPerRun: 1, publishMode: 'draft' });
  });

  it('enforces Etsy media limits', () => {
    const result = templateInputSchema.safeParse({
      name: 'x',
      mockupConfig: { printAreaMockupIds: Array.from({ length: 15 }, (_, i) => `p${i}`), staticMockupIds: Array.from({ length: 6 }, (_, i) => `s${i}`) },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(formatValidationError(result.error)).toContain('20 görsel');
  });

  it('rejects invalid time zones, oversized runs and empty names', () => {
    expect(templateInputSchema.safeParse({ name: 'x', automationSchedule: { timezone: 'Mars/Base' } }).success).toBe(false);
    expect(templateInputSchema.safeParse({ name: 'x', automationSchedule: { listingsPerRun: 50 } }).success).toBe(false);
    expect(templateInputSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('allows partial updates', () => {
    expect(templateUpdateSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });
});
