import { afterEach, describe, expect, it, vi } from 'vitest';
import { etsyFetch, listingsToMarkRemoved, readEtsyError, retryDelayMs } from './etsy-api';

afterEach(() => vi.unstubAllGlobals());

const response = (status: number, body = '{}', headers: Record<string, string> = {}) =>
  new Response(body, { status, headers });

describe('etsyFetch', () => {
  it('retries rate-limited requests and honours Retry-After', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(429, '{}', { 'retry-after': '2' }))
      .mockResolvedValueOnce(response(200, '{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);
    const sleep = vi.fn(async () => {});

    const res = await etsyFetch('https://openapi.etsy.com/x', {}, { sleep });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('returns the last response after running out of retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(503));
    vi.stubGlobal('fetch', fetchMock);
    const res = await etsyFetch('https://openapi.etsy.com/x', {}, { retries: 2, sleep: async () => {} });
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry client errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(400));
    vi.stubGlobal('fetch', fetchMock);
    await etsyFetch('https://openapi.etsy.com/x', {}, { sleep: async () => {} });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('retryDelayMs', () => {
  it('caps long waits', () => {
    expect(retryDelayMs(response(429, '{}', { 'retry-after': '120' }), 0, 8000)).toBe(8000);
  });
});

describe('readEtsyError', () => {
  it('surfaces Etsy’s own error text', async () => {
    const message = await readEtsyError(response(400, JSON.stringify({ error: 'Invalid tag: a&b' })), 'Taslak oluşturulamadı');
    expect(message).toBe('Taslak oluşturulamadı (HTTP 400): Invalid tag: a&b');
  });

  it('explains rate limits in plain language', async () => {
    expect(await readEtsyError(response(429), 'Görsel 3 yüklenemedi')).toContain('istek sınırına ulaşıldı');
  });
});

describe('listingsToMarkRemoved', () => {
  const existing: Array<[string, { state: string }]> = [
    ['1', { state: 'active' }],
    ['2', { state: 'active' }],
    ['3', { state: 'removed' }],
  ];

  it('marks nothing when any listing state could not be fetched completely', () => {
    expect(listingsToMarkRemoved(existing, new Set(['1']), false)).toEqual([]);
  });

  it('marks only listings missing from a complete sync', () => {
    expect(listingsToMarkRemoved(existing, new Set(['1']), true)).toEqual(['2']);
  });
});
