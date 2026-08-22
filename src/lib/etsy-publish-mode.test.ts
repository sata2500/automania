import { describe, expect, it } from 'vitest';
import {
  hasExplicitLivePublishConfirmation,
  isLivePublishEnabled,
  LIVE_PUBLISH_CONFIRMATION,
  resolveEtsyPublishMode,
} from './etsy-publish-mode';

describe('Etsy publish mode safety helpers', () => {
  it('defaults to draft and rejects invalid or conflicting modes', () => {
    expect(resolveEtsyPublishMode({})).toBe('draft');
    expect(resolveEtsyPublishMode({ state: 'draft' })).toBe('draft');
    expect(resolveEtsyPublishMode({ publishMode: 'active', state: 'active' })).toBe('active');
    expect(resolveEtsyPublishMode({ state: 'published' })).toBeNull();
    expect(resolveEtsyPublishMode({ publishMode: 'active', state: 'draft' })).toBeNull();
  });

  it('enables live publishing only for an explicit true flag', () => {
    expect(isLivePublishEnabled('true')).toBe(true);
    expect(isLivePublishEnabled(' TRUE ')).toBe(true);
    expect(isLivePublishEnabled(undefined)).toBe(false);
    expect(isLivePublishEnabled('false')).toBe(false);
    expect(isLivePublishEnabled('1')).toBe(false);
  });

  it('requires the exact confirmation phrase and boolean confirmation', () => {
    expect(LIVE_PUBLISH_CONFIRMATION).toBe('YAYINLA');
    expect(hasExplicitLivePublishConfirmation({ confirmLivePublish: true, confirmationPhrase: 'YAYINLA' })).toBe(true);
    expect(hasExplicitLivePublishConfirmation({ confirmLivePublish: true, confirmationPhrase: 'yayınla' })).toBe(false);
    expect(hasExplicitLivePublishConfirmation({ confirmLivePublish: false, confirmationPhrase: 'YAYINLA' })).toBe(false);
  });
});
