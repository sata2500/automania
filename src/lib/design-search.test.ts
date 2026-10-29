import { describe, expect, it } from 'vitest';
import type { DesignItem } from '@/types/pod';
import { matchesDesignQuery } from './design-search';

const design = (patch: Partial<DesignItem>): DesignItem => ({ id: 'd', name: 'x', src: '/a.png', width: 1, height: 1, ...patch });

describe('matchesDesignQuery', () => {
  it('finds a design by the SKU from an order, with or without dashes', () => {
    const d = design({ name: 'Lady Electrician', skus: ['TSH-261029-K7QD'] });
    expect(matchesDesignQuery(d, 'tsh-261029-k7qd')).toBe(true);
    expect(matchesDesignQuery(d, 'TSH261029K7QD')).toBe(true);
    expect(matchesDesignQuery(d, 'K7QD')).toBe(true);
    expect(matchesDesignQuery(d, 'MUG-261029')).toBe(false);
  });

  it('matches every word in the name ignoring case and Turkish characters', () => {
    const d = design({ name: 'Çiçekli Kedi Anneler Günü' });
    expect(matchesDesignQuery(d, 'cicekli günü')).toBe(true);
    expect(matchesDesignQuery(d, 'KEDİ')).toBe(true);
    expect(matchesDesignQuery(d, 'kedi köpek')).toBe(false);
    expect(matchesDesignQuery(d, '   ')).toBe(true);
  });
});
