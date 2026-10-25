import { describe, expect, it } from 'vitest';
import type { MockupItem } from '@/types/pod';
import type { PodTemplate } from '@/types/templates';
import {
  buildFolderMockupConfig,
  convertLegacyFolderTemplate,
  findFolderTemplate,
  parseLegacyFolderConfig,
  variationConfigFromRows,
} from './folder-template';

const mockup = (id: string, folderId: string, extra: Partial<MockupItem> = {}): MockupItem => ({
  id, name: id, src: `/m/${id}.png`, folderId, apparelType: 'light', printAreas: [], opacity: 1, width: 1000, height: 1000, ...extra,
});

const mockups: MockupItem[] = [
  mockup('a', 'f1'),
  mockup('chart', 'f1', { hasPrintArea: false }),
  mockup('vid', 'f1', { isVideo: true }),
  mockup('other', 'f2'),
];

describe('buildFolderMockupConfig', () => {
  it('selects only the folder mockups, grouped by kind', () => {
    expect(buildFolderMockupConfig('f1', mockups)).toEqual({
      folderId: 'f1', printAreaMockupIds: ['a'], staticMockupIds: ['chart'], videoMockupIds: ['vid'], fabricType: 'all', multiPrintAreaSupport: false,
    });
  });

  it('respects the 20 image limit with print-area mockups first', () => {
    const many = [
      ...Array.from({ length: 19 }, (_, i) => mockup(`p${i}`, 'f')),
      ...Array.from({ length: 5 }, (_, i) => mockup(`s${i}`, 'f', { hasPrintArea: false })),
    ];
    const config = buildFolderMockupConfig('f', many);
    expect(config.printAreaMockupIds).toHaveLength(19);
    expect(config.staticMockupIds).toEqual(['s0']);
  });
});

describe('variationConfigFromRows', () => {
  it('copies rows and derives sizes, colors and the lowest price', () => {
    const config = variationConfigFromRows([
      { id: '1', size: 'S', color: 'Black', price: 22, quantity: 999, sku: 'B-S', enabled: true },
      { id: '2', size: 'M', color: 'Black', price: 24, quantity: 999, sku: 'B-M', enabled: false },
    ]);
    expect(config.sizes).toEqual(['S', 'M']);
    expect(config.colors).toEqual(['Black']);
    expect(config.basePrice).toBe(22);
    expect(config.rows[1].enabled).toBe(false);
  });
});

describe('legacy folder config', () => {
  const legacyRow = {
    id: 'f1',
    description: JSON.stringify({ __folderConfig: true, variationTemplateId: 'v1', taxonomyId: 559 }),
    mockupConfig: { printAreaMockupIds: [], staticMockupIds: [], videoMockupIds: [], fabricType: 'all' as const, multiPrintAreaSupport: false },
    variationConfig: { rows: [], sizes: [], colors: [] },
    automationSchedule: { enabled: false, cronExpression: '0 9 * * *', timezone: 'Europe/Istanbul', nextRunAt: null, listingsPerRun: 1, publishMode: 'draft' as const },
  };

  it('is detected only for folder config JSON', () => {
    expect(parseLegacyFolderConfig(legacyRow.description)).toMatchObject({ variationTemplateId: 'v1', taxonomyId: 559 });
    expect(parseLegacyFolderConfig('Yaz koleksiyonu')).toBeNull();
    expect(parseLegacyFolderConfig('{"other":true}')).toBeNull();
  });

  it('converts to a full template: folder mockups, saved variations, category, clean description', () => {
    const patch = convertLegacyFolderTemplate(legacyRow, {
      mockups,
      variationTemplates: [{ id: 'v1', variations: [{ id: 'r', size: 'L', color: 'White', price: 25, quantity: 10, sku: '', enabled: true }] }],
    });
    expect(patch?.description).toBeNull();
    expect(patch?.mockupConfig).toMatchObject({ folderId: 'f1', printAreaMockupIds: ['a'], staticMockupIds: ['chart'] });
    expect(patch?.variationConfig.rows).toHaveLength(1);
    expect(patch?.automationSchedule.etsy?.taxonomyId).toBe(559);
    expect(patch?.automationSchedule.timezone).toBe('Europe/Istanbul');
  });

  it('leaves regular templates alone', () => {
    expect(convertLegacyFolderTemplate({ ...legacyRow, description: null }, { mockups, variationTemplates: [] })).toBeNull();
  });
});

describe('findFolderTemplate', () => {
  it('prefers the explicit folder link and falls back to legacy id match', () => {
    const linked = { id: 'tmpl_1', mockupConfig: { folderId: 'f1' } } as Pick<PodTemplate, 'id' | 'mockupConfig'>;
    const legacy = { id: 'f2', mockupConfig: {} } as Pick<PodTemplate, 'id' | 'mockupConfig'>;
    expect(findFolderTemplate([legacy, linked], 'f1')).toBe(linked);
    expect(findFolderTemplate([legacy, linked], 'f2')).toBe(legacy);
    expect(findFolderTemplate([linked], 'f3')).toBeNull();
  });
});
