import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrapeEtsyKeywordData } from './etsy-scraper';

describe('scrapeEtsyKeywordData provider error classification', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('classifies Etsy API 429 as retryable instead of a valid zero-opportunity result', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/suggestions?')) {
        return new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('rate limited', {
        status: 429,
        headers: { 'Retry-After': '17' },
      });
    });

    const result = await scrapeEtsyKeywordData('cat shirt', {
      etsyAccessToken: 'test-access-token',
      etsyApiKey: 'test-api-key',
    });

    expect(result.opportunityScore).toBe(0);
    expect(result.scrapeError).toContain('rate limit');
    expect(result.rawMetrics.errorType).toBe('provider_rate_limited');
    expect(result.rawMetrics.retryable).toBe(true);
    expect(result.rawMetrics.retryAfterSeconds).toBe(17);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
