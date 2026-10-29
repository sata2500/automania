import { describe, expect, it } from 'vitest';
import { AUTOMATION_DESIGN_FOLDER_ID, designCreatedAt, designSection, needsAutoAnalysis, needsOptimization, sortNewestFirst } from './design-library';

describe('design-library', () => {
  it('splits designs into my designs and automation designs', () => {
    expect(designSection({ folderId: AUTOMATION_DESIGN_FOLDER_ID })).toBe('automation');
    expect(designSection({ folderId: 'dfol-123' })).toBe('mine');
    expect(designSection({})).toBe('mine');
  });

  it('sorts newest first, falling back to the timestamp in the id', () => {
    const sorted = sortNewestFirst([
      { id: 'design-1700000000000-ab' },
      { id: 'x', createdAt: 1800000000000 },
      { id: 'no-time' },
      { id: 'design-auto-1750000000000-cd' },
    ]);
    expect(sorted.map((d) => d.id)).toEqual(['x', 'design-auto-1750000000000-cd', 'design-1700000000000-ab', 'no-time']);
    expect(designCreatedAt({ id: 'design-1700000000000-ab' })).toBe(1700000000000);
  });

  it('optimizes stored designs once', () => {
    expect(needsOptimization({ src: 'https://cdn/x.png' })).toBe(true);
    expect(needsOptimization({ src: 'https://cdn/x.png', optimizedAt: 1 })).toBe(false);
    expect(needsOptimization({ src: 'data:image/png;base64,AA' })).toBe(false);
  });

  it('auto-analyzes automation and AI designs only, replacing automation-derived analyses', () => {
    const base = { description: '', keywords: [], analyzedAt: 1 };
    expect(needsAutoAnalysis({})).toBe(false);
    expect(needsAutoAnalysis({ generatedByAI: true })).toBe(true);
    expect(needsAutoAnalysis({ folderId: AUTOMATION_DESIGN_FOLDER_ID, analysis: { ...base, source: 'automation' } })).toBe(true);
    expect(needsAutoAnalysis({ folderId: AUTOMATION_DESIGN_FOLDER_ID, analysis: base })).toBe(true);
    expect(needsAutoAnalysis({ folderId: AUTOMATION_DESIGN_FOLDER_ID, analysis: { ...base, evaluatedKeywords: [] } })).toBe(false);
    expect(needsAutoAnalysis({ generatedByAI: true, analysis: { ...base, source: 'vision' } })).toBe(false);
  });
});
