import { describe, expect, it } from 'vitest';
import { ModelNotConfiguredError, requireModel } from './ai-models';

describe('requireModel', () => {
  it('returns the admin-selected model and refuses to guess one', () => {
    expect(requireModel(' gemini-x ', 'reasoning')).toBe('gemini-x');
    expect(() => requireModel('', 'generation')).toThrow(ModelNotConfiguredError);
    expect(() => requireModel(null, 'video')).toThrow(/Video üretim modeli seçilmemiş/);
  });
});
