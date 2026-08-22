const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

/**
 * Returns the origin used by both the OAuth start and callback endpoints.
 * Local development always canonicalizes loopback aliases to localhost so
 * Google receives exactly the same redirect URI that the callback uses.
 */
export function getCanonicalAppOrigin(
  requestUrl: URL | string,
  configuredOrigin?: string | null,
): string {
  const url = typeof requestUrl === 'string' ? new URL(requestUrl) : requestUrl;
  const configured = configuredOrigin?.trim().replace(/\/$/, '');

  if (LOCAL_HOSTNAMES.has(url.hostname)) {
    return `${url.protocol}//localhost${url.port ? `:${url.port}` : ''}`;
  }

  return configured || url.origin;
}
