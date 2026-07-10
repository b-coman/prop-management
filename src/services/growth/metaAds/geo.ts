/**
 * City geo-targeting search — Phase 2b (docs/meta-ads-infrastructure-2026.md
 * §9f). Resolves a free-text city name to Meta's `adgeolocation` `key` —
 * cities MUST be targeted by `key`, never by name (§9f: "keys verified —
 * București=1910415, Ploiești=1925836, Constanța=1913456"). This is a
 * read-only GET through the shared `metaGraph` client — no `createResource`
 * needed (that helper's PAUSED enforcement only matters for writes).
 *
 * Takes a `propertyId` purely to resolve a Bearer token via
 * `resolveAdContext` — Meta's `/search?type=adgeolocation` node is NOT
 * ad-account-scoped (it isn't called as `act_<id>/search`), but every Graph
 * call in this codebase goes through a resolved ad context so there's exactly
 * one token-resolution path, mirroring every other `metaAds/*` module.
 *
 * Never throws (`GraphResult` discipline, same as the rest of `metaAds/*`) —
 * an unconfigured property, a network error, or a malformed response all
 * resolve to a typed `{ok:false}`; a caller-facing city-picker autocomplete
 * must degrade to "no results," never crash the form.
 *
 * Plain server module (NOT `'use server'`) — exports types + async functions.
 */
import { loggers } from '@/lib/logger';
import { resolveAdContext } from './adContext';
import { metaGraph, type GraphResult } from './client';

const logger = loggers.ads;

/** A single Meta `adgeolocation` city match. `key` is the ONLY valid targeting identifier — `name`/`region` are display-only. */
export interface CityMatch {
  key: string;
  name: string;
  region?: string;
  countryCode?: string;
}

export interface SearchCitiesOptions {
  /** ISO 3166-1 alpha-2. Defaults to `'RO'` — this system's only market so far (multi-property note: pass explicitly once a non-RO property onboards). */
  countryCode?: string;
  /** Max matches to return. Defaults to 8 — enough for a form's autocomplete dropdown without over-fetching. */
  limit?: number;
}

/** Raw shape of Meta's `/search?type=adgeolocation` response — only the fields we read. */
interface AdGeoLocationSearchResponse {
  data?: Array<{
    key?: string;
    name?: string;
    region?: string;
    region_id?: string | number;
    country_code?: string;
    type?: string;
  }>;
}

/**
 * Resolve city name(s) matching `query` to Meta's `adgeolocation` keys.
 * Verified contract (§9f): `GET /search?type=adgeolocation&location_types=["city"]&q=<name>&country_code=<cc>&limit=<n>`
 * → `data[].{key,name,region,region_id,country_code}`. `location_types` is
 * sent as a JSON-encoded array (`metaGraph`'s standard handling of
 * object/array param values) — this reproduces the exact verified query
 * string shape, not an approximation of it.
 *
 * An empty/whitespace-only `query` short-circuits to `{ok:true,data:[]}`
 * WITHOUT calling Meta — an autocomplete field firing on every keystroke
 * shouldn't burn a Graph call on an empty string.
 */
export async function searchCities(
  propertyId: string,
  query: string,
  opts: SearchCitiesOptions = {}
): Promise<GraphResult<CityMatch[]>> {
  const trimmed = query.trim();
  if (!trimmed) return { ok: true, data: [] };

  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    logger.warn('searchCities: no ad context for property — refusing to search', { propertyId });
    return { ok: false, error: 'no-ad-context' };
  }

  const countryCode = opts.countryCode ?? 'RO';
  const limit = opts.limit ?? 8;

  const result = await metaGraph<AdGeoLocationSearchResponse>('search', {
    method: 'GET',
    params: {
      type: 'adgeolocation',
      location_types: ['city'],
      q: trimmed,
      country_code: countryCode,
      limit,
    },
    token: ctx.token,
    propertyId,
  });

  if (!result.ok) return result;

  const matches: CityMatch[] = (result.data.data ?? [])
    .filter((entry): entry is { key: string; name: string; region?: string; country_code?: string } =>
      Boolean(entry.key && entry.name)
    )
    .map((entry) => ({
      key: entry.key,
      name: entry.name,
      region: entry.region,
      countryCode: entry.country_code,
    }));

  return { ok: true, data: matches };
}
