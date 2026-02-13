// src/services/contentDataSources.ts
// Data Source Integration Layer — fetches from 6 external APIs with Firestore cache.
// Consumed by the content generation engine. NOT a 'use server' module.

import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { CONTENT_COLLECTIONS, type DataSourceConfig } from '@/lib/content-schemas';

const log = loggers.contentData;

// ---------------------------------------------------------------------------
// Cache TTLs (milliseconds)
// ---------------------------------------------------------------------------

const CACHE_TTLS: Record<string, number> = {
  googlePlaces: 7 * 24 * 60 * 60 * 1000,    // 7 days
  weather: 30 * 24 * 60 * 60 * 1000,          // 30 days
  perplexity: 24 * 60 * 60 * 1000,            // 24 hours
  events8pm: 1 * 60 * 60 * 1000,              // 1 hour
  venues8pm: 24 * 60 * 60 * 1000,             // 24 hours
  trainSchedule: 30 * 24 * 60 * 60 * 1000,    // 30 days
};

// ---------------------------------------------------------------------------
// Cache Layer
// ---------------------------------------------------------------------------

function normalizeParams(params: Record<string, unknown>): string {
  return JSON.stringify(params, (_, value) => {
    if (Array.isArray(value)) return [...value].sort();
    return value;
  });
}

async function getCachedData(
  slug: string,
  sourceType: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  try {
    const db = await getAdminDb();
    const docRef = db.doc(`${CONTENT_COLLECTIONS.cache(slug)}/${sourceType}`);
    const snap = await docRef.get();
    if (!snap.exists) return null;

    const cached = snap.data();
    if (!cached) return null;

    const now = new Date().toISOString();
    if (cached.expiresAt && cached.expiresAt < now) {
      log.info('Cache expired', { slug, sourceType });
      return null;
    }

    const normalizedCurrent = normalizeParams(params);
    const normalizedCached = normalizeParams(cached.parameters || {});
    if (normalizedCurrent !== normalizedCached) {
      log.info('Cache params mismatch', { slug, sourceType });
      return null;
    }

    log.info('Cache hit', { slug, sourceType });
    return cached.data as Record<string, unknown>;
  } catch (err) {
    log.error('Cache read error', { slug, sourceType, error: String(err) });
    return null;
  }
}

async function setCachedData(
  slug: string,
  sourceType: string,
  data: Record<string, unknown>,
  params: Record<string, unknown>,
  ttlMs: number
): Promise<void> {
  try {
    const db = await getAdminDb();
    const docRef = db.doc(`${CONTENT_COLLECTIONS.cache(slug)}/${sourceType}`);
    const now = new Date();
    await docRef.set({
      sourceType,
      data,
      fetchedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      parameters: params,
    });
    log.info('Cache written', { slug, sourceType });
  } catch (err) {
    log.error('Cache write error', { slug, sourceType, error: String(err) });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  // Strip markdown code fences
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// 1. Google Places
// ---------------------------------------------------------------------------

interface Coordinates {
  lat: number;
  lng: number;
}

export async function fetchGooglePlacesData(
  slug: string,
  config: DataSourceConfig['googlePlaces'],
  coordinates: Coordinates
): Promise<Record<string, unknown> | null> {
  if (!config.enabled) return null;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    log.warn('GOOGLE_PLACES_API_KEY not configured');
    return null;
  }

  const params: Record<string, unknown> = {
    radius: config.searchRadius,
    includedTypes: config.includedTypes,
    excludedTypes: config.excludedTypes,
    lat: coordinates.lat,
    lng: coordinates.lng,
  };

  const cached = await getCachedData(slug, 'googlePlaces', params);
  if (cached) return cached;

  try {
    const fieldMask = [
      'places.id', 'places.displayName', 'places.formattedAddress',
      'places.location', 'places.types', 'places.primaryType',
      'places.rating', 'places.userRatingCount',
      'places.editorialSummary', 'places.googleMapsUri',
    ].join(',');

    const body = {
      includedTypes: config.includedTypes,
      excludedTypes: config.excludedTypes,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: coordinates.lat, longitude: coordinates.lng },
          radius: config.searchRadius,
        },
      },
    };

    // Fetch EN and RO in parallel for bilingual data
    const [enRes, roRes] = await Promise.all(
      ['en', 'ro'].map(lang =>
        fetchWithTimeout('https://places.googleapis.com/v1/places:searchNearby', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': fieldMask,
            'Accept-Language': lang,
          },
          body: JSON.stringify(body),
        })
      )
    );

    if (!enRes.ok || !roRes.ok) {
      log.error('Google Places API error', {
        enStatus: enRes.status,
        roStatus: roRes.status,
      });
      return null;
    }

    const enData = await enRes.json();
    const roData = await roRes.json();

    // Merge by place.id for bilingual names/addresses/summaries
    const enPlaces: Record<string, unknown>[] = enData.places || [];
    const roPlaces: Record<string, unknown>[] = roData.places || [];
    const roById = new Map<string, Record<string, unknown>>();
    for (const p of roPlaces) {
      roById.set(p.id as string, p);
    }

    const merged = enPlaces.map(enPlace => {
      const roPlace = roById.get(enPlace.id as string);
      return {
        id: enPlace.id,
        displayName: {
          en: (enPlace.displayName as Record<string, unknown>)?.text,
          ro: roPlace
            ? (roPlace.displayName as Record<string, unknown>)?.text
            : (enPlace.displayName as Record<string, unknown>)?.text,
        },
        formattedAddress: {
          en: enPlace.formattedAddress,
          ro: roPlace ? roPlace.formattedAddress : enPlace.formattedAddress,
        },
        editorialSummary: {
          en: (enPlace.editorialSummary as Record<string, unknown>)?.text || null,
          ro: roPlace
            ? (roPlace.editorialSummary as Record<string, unknown>)?.text || null
            : null,
        },
        location: enPlace.location,
        types: enPlace.types,
        primaryType: enPlace.primaryType,
        rating: enPlace.rating,
        userRatingCount: enPlace.userRatingCount,
        googleMapsUri: enPlace.googleMapsUri,
      };
    });

    const result = { places: merged, fetchedAt: new Date().toISOString() };
    await setCachedData(slug, 'googlePlaces', result, params, CACHE_TTLS.googlePlaces);
    log.info('Google Places fetched', { slug, count: merged.length });
    return result;
  } catch (err) {
    log.error('Google Places fetch error', { slug, error: String(err) });
    return null;
  }
}

// ---------------------------------------------------------------------------
// 2. Weather (Visual Crossing)
// ---------------------------------------------------------------------------

export async function fetchWeatherData(
  slug: string,
  config: DataSourceConfig['weather']
): Promise<Record<string, unknown> | null> {
  if (!config.enabled) return null;

  const apiKey = process.env.VISUAL_CROSSING_API_KEY;
  if (!apiKey) {
    log.warn('VISUAL_CROSSING_API_KEY not configured');
    return null;
  }

  const { lat, lng } = config.coordinates;
  const params: Record<string, unknown> = { lat, lng };

  const cached = await getCachedData(slug, 'weather', params);
  if (cached) return cached;

  try {
    const currentYear = new Date().getFullYear();
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lng}/${currentYear}-01-01/${currentYear}-12-31?unitGroup=metric&include=days&key=${apiKey}`;

    const res = await fetchWithTimeout(url, { method: 'GET' }, 60000);
    if (!res.ok) {
      log.error('Weather API error', { slug, status: res.status });
      return null;
    }

    const data = await res.json();
    const result = {
      resolvedAddress: data.resolvedAddress,
      timezone: data.timezone,
      days: data.days,
      fetchedAt: new Date().toISOString(),
    };

    await setCachedData(slug, 'weather', result, params, CACHE_TTLS.weather);
    log.info('Weather data fetched', { slug, dayCount: data.days?.length });
    return result;
  } catch (err) {
    log.error('Weather fetch error', { slug, error: String(err) });
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. Perplexity Research
// ---------------------------------------------------------------------------

export async function fetchPerplexityResearch(
  slug: string,
  config: DataSourceConfig['perplexityResearch'],
  query: string,
  systemPrompt: string
): Promise<Record<string, unknown> | null> {
  if (!config.enabled) return null;

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    log.warn('PERPLEXITY_API_KEY not configured');
    return null;
  }

  const params: Record<string, unknown> = {
    query,
    domainAllowlist: config.domainAllowlist,
    domainBlocklist: config.domainBlocklist,
    recencyFilter: config.recencyFilter,
  };

  const cached = await getCachedData(slug, 'perplexity', params);
  if (cached) return cached;

  try {
    const searchDomainFilter: string[] = [];
    for (const d of config.domainAllowlist) {
      searchDomainFilter.push(d);
    }
    for (const d of config.domainBlocklist) {
      searchDomainFilter.push(`-${d}`);
    }

    const body: Record<string, unknown> = {
      model: 'sonar',
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
    };

    if (searchDomainFilter.length > 0) {
      body.search_domain_filter = searchDomainFilter;
    }
    if (config.recencyFilter !== 'none') {
      body.search_recency_filter = config.recencyFilter;
    }

    const res = await fetchWithTimeout('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }, 60000);

    if (!res.ok) {
      log.error('Perplexity API error', { slug, status: res.status });
      return null;
    }

    const responseData = await res.json();
    const rawText = responseData.choices?.[0]?.message?.content || '';
    const citations = responseData.citations || [];

    let parsed: Record<string, unknown>;
    try {
      const cleaned = cleanJsonResponse(rawText);
      parsed = JSON.parse(cleaned);
    } catch {
      log.warn('Perplexity JSON parse failed, storing raw text', { slug });
      parsed = { rawText, parseError: true };
    }

    const result = {
      ...parsed,
      citations,
      query,
      fetchedAt: new Date().toISOString(),
    };

    await setCachedData(slug, 'perplexity', result, params, CACHE_TTLS.perplexity);
    log.info('Perplexity research fetched', { slug, citationCount: citations.length });
    return result;
  } catch (err) {
    log.error('Perplexity fetch error', { slug, error: String(err) });
    return null;
  }
}

// ---------------------------------------------------------------------------
// 4. Events (8pm API)
// ---------------------------------------------------------------------------

export async function fetchEvents8pmData(
  slug: string,
  config: DataSourceConfig['events8pm']
): Promise<Record<string, unknown> | null> {
  if (!config.enabled) return null;

  const apiUrl = process.env.EVENTS_8PM_API_URL;
  const apiKey = process.env.EVENTS_8PM_API_KEY;
  if (!apiUrl || !apiKey) {
    log.warn('EVENTS_8PM_API_URL or EVENTS_8PM_API_KEY not configured');
    return null;
  }

  const now = new Date();
  const startDate = now.toISOString().split('T')[0];
  const endDate = new Date(now.getTime() + config.lookAheadDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const params: Record<string, unknown> = {
    city: config.city,
    categories: config.categories,
    lookAheadDays: config.lookAheadDays,
  };

  const cached = await getCachedData(slug, 'events8pm', params);
  if (cached) return cached;

  try {
    const searchParams = new URLSearchParams({
      city: config.city,
      startDate,
      endDate,
      limit: '30',
    });
    for (const cat of config.categories) {
      searchParams.append('categories', cat);
    }

    const res = await fetchWithTimeout(
      `${apiUrl}/eventsNearby?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: { 'X-API-Key': apiKey },
      }
    );

    if (!res.ok) {
      log.error('Events 8pm API error', { slug, status: res.status });
      return null;
    }

    const data = await res.json();
    const result = {
      events: data.events || data,
      city: config.city,
      dateRange: { startDate, endDate },
      fetchedAt: new Date().toISOString(),
    };

    await setCachedData(slug, 'events8pm', result, params, CACHE_TTLS.events8pm);
    log.info('Events 8pm fetched', {
      slug,
      count: Array.isArray(result.events) ? result.events.length : 0,
    });
    return result;
  } catch (err) {
    log.error('Events 8pm fetch error', { slug, error: String(err) });
    return null;
  }
}

// ---------------------------------------------------------------------------
// 5. Venues (8pm API)
// ---------------------------------------------------------------------------

export async function fetchVenues8pmData(
  slug: string,
  config: DataSourceConfig['venues8pm']
): Promise<Record<string, unknown> | null> {
  if (!config.enabled) return null;

  const apiUrl = process.env.EVENTS_8PM_API_URL;
  const apiKey = process.env.EVENTS_8PM_API_KEY;
  if (!apiUrl || !apiKey) {
    log.warn('EVENTS_8PM_API_URL or EVENTS_8PM_API_KEY not configured');
    return null;
  }

  const params: Record<string, unknown> = {
    city: config.city,
    categories: config.categories,
    limit: config.limit,
  };

  const cached = await getCachedData(slug, 'venues8pm', params);
  if (cached) return cached;

  try {
    const searchParams = new URLSearchParams({
      city: config.city,
      limit: String(config.limit),
    });
    for (const cat of config.categories) {
      searchParams.append('categories', cat);
    }

    const res = await fetchWithTimeout(
      `${apiUrl}/venuesNearby?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: { 'X-API-Key': apiKey },
      }
    );

    if (!res.ok) {
      log.error('Venues 8pm API error', { slug, status: res.status });
      return null;
    }

    const data = await res.json();
    const result = {
      venues: data.venues || data,
      city: config.city,
      fetchedAt: new Date().toISOString(),
    };

    await setCachedData(slug, 'venues8pm', result, params, CACHE_TTLS.venues8pm);
    log.info('Venues 8pm fetched', {
      slug,
      count: Array.isArray(result.venues) ? result.venues.length : 0,
    });
    return result;
  } catch (err) {
    log.error('Venues 8pm fetch error', { slug, error: String(err) });
    return null;
  }
}

// ---------------------------------------------------------------------------
// 6. Train Schedule (8pm API)
// ---------------------------------------------------------------------------

export async function fetchTrainScheduleData(
  slug: string,
  config: DataSourceConfig['trainSchedule']
): Promise<Record<string, unknown> | null> {
  if (!config.enabled) return null;

  const apiUrl = process.env.EVENTS_8PM_API_URL;
  const apiKey = process.env.EVENTS_8PM_API_KEY;
  if (!apiUrl || !apiKey) {
    log.warn('EVENTS_8PM_API_URL or EVENTS_8PM_API_KEY not configured');
    return null;
  }

  const params: Record<string, unknown> = {
    nearestStation: config.nearestStation,
    originCities: config.originCities,
  };

  const cached = await getCachedData(slug, 'trainSchedule', params);
  if (cached) return cached;

  try {
    const routes: Record<string, unknown> = {};

    // Fetch routes for each origin city sequentially to be gentle on the API
    for (const originCity of config.originCities) {
      try {
        const searchParams = new URLSearchParams({
          from: originCity,
          to: config.nearestStation,
          day: 'weekend',
        });

        const res = await fetchWithTimeout(
          `${apiUrl}/transportRoutes?${searchParams.toString()}`,
          {
            method: 'GET',
            headers: { 'X-API-Key': apiKey },
          }
        );

        if (res.status === 404) {
          // No routes found — not an error
          routes[originCity] = { routes: [], noRoutesFound: true };
          continue;
        }

        if (!res.ok) {
          log.warn('Train schedule API error for origin', {
            slug,
            originCity,
            status: res.status,
          });
          routes[originCity] = { routes: [], error: true };
          continue;
        }

        const data = await res.json();
        routes[originCity] = data;
      } catch (err) {
        log.warn('Train schedule fetch error for origin', {
          slug,
          originCity,
          error: String(err),
        });
        routes[originCity] = { routes: [], error: true };
      }
    }

    const result = {
      routes,
      nearestStation: config.nearestStation,
      fetchedAt: new Date().toISOString(),
    };

    await setCachedData(slug, 'trainSchedule', result, params, CACHE_TTLS.trainSchedule);
    log.info('Train schedule fetched', {
      slug,
      originCount: config.originCities.length,
    });
    return result;
  } catch (err) {
    log.error('Train schedule fetch error', { slug, error: String(err) });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

interface PerplexityArgs {
  query: string;
  systemPrompt: string;
}

export async function fetchAllDataSources(
  slug: string,
  config: DataSourceConfig,
  coordinates: Coordinates,
  perplexityArgs?: PerplexityArgs
): Promise<Record<string, Record<string, unknown> | null>> {
  log.info('Fetching all data sources', { slug });

  const results = await Promise.allSettled([
    fetchGooglePlacesData(slug, config.googlePlaces, coordinates),
    fetchWeatherData(slug, config.weather),
    perplexityArgs
      ? fetchPerplexityResearch(slug, config.perplexityResearch, perplexityArgs.query, perplexityArgs.systemPrompt)
      : Promise.resolve(null),
    fetchEvents8pmData(slug, config.events8pm),
    fetchVenues8pmData(slug, config.venues8pm),
    fetchTrainScheduleData(slug, config.trainSchedule),
  ]);

  const sourceNames = [
    'googlePlaces', 'weather', 'perplexity',
    'events8pm', 'venues8pm', 'trainSchedule',
  ] as const;

  const output: Record<string, Record<string, unknown> | null> = {};
  for (let i = 0; i < sourceNames.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      output[sourceNames[i]] = result.value;
    } else {
      log.error('Data source rejected', {
        slug,
        source: sourceNames[i],
        error: String(result.reason),
      });
      output[sourceNames[i]] = null;
    }
  }

  const fetched = Object.entries(output).filter(([, v]) => v !== null).map(([k]) => k);
  log.info('All data sources complete', { slug, fetched });
  return output;
}
