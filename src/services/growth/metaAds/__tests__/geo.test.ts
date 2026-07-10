/** @jest-environment node */

// Mock adContext (token resolution) only — use the REAL client.ts (metaGraph)
// against a mocked global.fetch, so the exact verified query-string shape
// (§9f) is exercised end-to-end, not assumed.
jest.mock('../adContext', () => ({ resolveAdContext: jest.fn() }));

import { searchCities } from '../geo';
import { resolveAdContext } from '../adContext';
import { GRAPH_API_VERSION } from '../client';

const mockResolveAdContext = resolveAdContext as jest.Mock;
const mockFetch = global.fetch as jest.Mock;

const PROPERTY = 'prahova-mountain-chalet';

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  mockResolveAdContext.mockResolvedValue({ adAccountId: 'act_543311232953437', token: 'SECRET-TOKEN' });
});

describe('searchCities — token/context resolution', () => {
  it('returns {ok:false,error:"no-ad-context"} without calling fetch when the property has no ad context', async () => {
    mockResolveAdContext.mockResolvedValue(null);
    const res = await searchCities(PROPERTY, 'Ploiesti');
    expect(res).toEqual({ ok: false, error: 'no-ad-context' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('short-circuits to an empty match list, WITHOUT calling fetch, for an empty/whitespace query', async () => {
    const res = await searchCities(PROPERTY, '   ');
    expect(res).toEqual({ ok: true, data: [] });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockResolveAdContext).not.toHaveBeenCalled();
  });
});

describe('searchCities — verified query contract (§9f)', () => {
  it('GETs /search with type=adgeolocation, location_types=["city"], q, country_code, limit — token in the header, never the URL', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    await searchCities(PROPERTY, 'Ploiesti');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe(`/${GRAPH_API_VERSION}/search`);
    expect(parsed.searchParams.get('type')).toBe('adgeolocation');
    expect(parsed.searchParams.get('location_types')).toBe('["city"]');
    expect(parsed.searchParams.get('q')).toBe('Ploiesti');
    expect(parsed.searchParams.get('country_code')).toBe('RO'); // default
    expect(parsed.searchParams.get('limit')).toBe('8'); // default
    expect(String(url)).not.toContain('SECRET-TOKEN');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer SECRET-TOKEN');
  });

  it('trims the query before sending it', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    await searchCities(PROPERTY, '  Constanta  ');
    const [url] = mockFetch.mock.calls[0];
    expect(new URL(String(url)).searchParams.get('q')).toBe('Constanta');
  });

  it('honors an explicit countryCode/limit override', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    await searchCities(PROPERTY, 'Berlin', { countryCode: 'DE', limit: 3 });
    const [url] = mockFetch.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.searchParams.get('country_code')).toBe('DE');
    expect(parsed.searchParams.get('limit')).toBe('3');
  });
});

describe('searchCities — response parsing', () => {
  it('parses the verified match shape (§9f: București/Ploiești/Constanța keys)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { key: '1910415', name: 'Bucharest', region: 'Bucuresti', region_id: '111', country_code: 'RO', type: 'city' },
          { key: '1925836', name: 'Ploiesti', region: 'Prahova', country_code: 'RO', type: 'city' },
        ],
      }),
    });

    const res = await searchCities(PROPERTY, 'plo');
    expect(res).toEqual({
      ok: true,
      data: [
        { key: '1910415', name: 'Bucharest', region: 'Bucuresti', countryCode: 'RO' },
        { key: '1925836', name: 'Ploiesti', region: 'Prahova', countryCode: 'RO' },
      ],
    });
  });

  it('filters out malformed entries missing key/name, never throws', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ name: 'No key' }, { key: '123' }, { key: '456', name: 'Valid City' }] }),
    });

    const res = await searchCities(PROPERTY, 'x');
    expect(res).toEqual({ ok: true, data: [{ key: '456', name: 'Valid City', region: undefined, countryCode: undefined }] });
  });

  it('handles a missing data[] field as zero matches', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    const res = await searchCities(PROPERTY, 'x');
    expect(res).toEqual({ ok: true, data: [] });
  });
});

describe('searchCities — never throws (GraphResult discipline)', () => {
  it('returns a typed {ok:false,error} on a non-OK response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' });
    const res = await searchCities(PROPERTY, 'x');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('bad request');
  });

  it('returns a typed {ok:false,error} on a network error', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    const res = await searchCities(PROPERTY, 'x');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('network down');
  });
});
