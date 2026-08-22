export type EtsyPublishMode = 'draft' | 'active';

export const LIVE_PUBLISH_CONFIRMATION = 'YAYINLA';

export function resolveEtsyPublishMode(input: {
  publishMode?: unknown;
  state?: unknown;
}): EtsyPublishMode | null {
  const values = [input.publishMode, input.state].filter((value) => value !== undefined);
  if (values.some((value) => value !== 'draft' && value !== 'active')) return null;
  if (values.length > 1 && values[0] !== values[1]) return null;
  return (values[0] as EtsyPublishMode | undefined) ?? 'draft';
}

export function isLivePublishEnabled(flag: string | undefined | null): boolean {
  return flag?.trim().toLowerCase() === 'true';
}

export function hasExplicitLivePublishConfirmation(input: {
  confirmLivePublish?: unknown;
  confirmationPhrase?: unknown;
}): boolean {
  return input.confirmLivePublish === true && input.confirmationPhrase === LIVE_PUBLISH_CONFIRMATION;
}
