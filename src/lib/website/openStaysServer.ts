/**
 * Server half of the free periods widget: asks the booking engine what is free and what it costs.
 *
 * Two sources, both already used elsewhere and both asking the engine rather than knowing:
 *   - `findOpenWeekends`: every Friday-Sunday in the window, quoted. A booked weekend, or one
 *     inside a block with a longer minimum stay, refuses itself.
 *   - `buildExampleStays`: occasion stays (1 Decembrie, Christmas, school breaks) that fit the
 *     calendar and the per-date minimum stay.
 * So a row can never offer a stay the booking page would refuse, and every price is the total the
 * booking page shows first (base occupancy, cleaning included).
 *
 * Cached per instance for 10 minutes. One quote per Friday is a few Firestore reads each, and the
 * homepage takes every ad click. The page never waits long for it: an old answer is served while a
 * new one is built, and a first build that takes longer than `WAIT_MS` renders the page without the
 * widget (the build carries on and fills the cache for the next visitor).
 */
import { findOpenWeekends } from '@/lib/landing/openWeekends';
import { buildExampleStays } from '@/lib/landing/exampleStays';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { getRecentSearches } from '@/lib/website/staySearches';
import {
  mergeStays, pickBadges, lastFreeWeekendByMonth,
  type CandidateStay, type OpenStayRow, type OpenStaysConfig, type StaySearch,
} from '@/lib/website/openStays';

const logger = loggers.booking;
const TTL = 10 * 60 * 1000;
const WAIT_MS = 2500;

export interface OpenStaysResult {
  rows: OpenStayRow[];
  currency: string;
}

/** What the engine said, before any page's settings are applied. Shared by every page of a property. */
interface Base {
  weekends: CandidateStay[];
  occasions: CandidateStay[];
  searches: StaySearch[];
  lastFree: Map<string, string>;
  currency: string;
}

const cache = new Map<string, { at: number; value: Base | null }>();
const building = new Map<string, Promise<Base | null>>();

export async function getOpenStays(propertyId: string, config: OpenStaysConfig = {}): Promise<OpenStaysResult | null> {
  const base = await getBase(propertyId, config.horizonDays ?? 75);
  if (!base) return null;
  const rows = pickBadges(mergeStays(base.weekends, base.occasions, config.maxRows ?? 4), base, config);
  return rows.length ? { rows, currency: base.currency } : null;
}

async function getBase(propertyId: string, horizon: number): Promise<Base | null> {
  const key = `${propertyId}|${horizon}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  let pending = building.get(key);
  if (!pending) {
    pending = build(propertyId, horizon)
      .catch((err) => {
        logger.warn('Open stays: build failed', { propertyId, error: (err as Error)?.message });
        return null;
      })
      .then((value) => {
        cache.set(key, { at: Date.now(), value });
        building.delete(key);
        return value;
      });
    building.set(key, pending);
  }
  if (hit) return hit.value; // stale but recent enough: serve it, the new one is on its way
  return Promise.race([pending, new Promise<null>((r) => setTimeout(() => r(null), WAIT_MS))]);
}

async function build(propertyId: string, horizon: number): Promise<Base | null> {
  const now = new Date();
  const to = new Date(+now + horizon * 86400000);

  let guests = 3;
  let currency = 'RON';
  try {
    const db = await getAdminDb();
    const p = (await db.collection('properties').doc(propertyId).get()).data();
    guests = Number(p?.baseOccupancy) || guests;
    currency = p?.baseCurrency || currency;
  } catch (err) {
    logger.warn('Open stays: could not read property', { propertyId, error: (err as Error)?.message });
    return null;
  }

  const [weekends, occasions, searches] = await Promise.all([
    findOpenWeekends({ propertyId, from: now, to, nights: 2, guests, limit: 20 }).catch((err) => {
      logger.warn('Open stays: weekends failed', { propertyId, error: (err as Error)?.message });
      return [];
    }),
    buildExampleStays(propertyId, { kind: 'season' }, { maxStays: 4, minNights: 2, seasonHorizonDays: horizon }).catch((err) => {
      logger.warn('Open stays: occasions failed', { propertyId, error: (err as Error)?.message });
      return [];
    }),
    getRecentSearches(propertyId, 14),
  ]);

  const weekendRows: CandidateStay[] = weekends.map((w) => ({
    start: w.start, end: w.end, nights: w.nights, price: w.total, label: null, kind: 'weekend',
  }));
  // Only stays anchored on a real occasion. The reasoner's generic "Weekend la munte" duplicates
  // what the weekend quotes already cover, with less precise prices.
  const occasionRows: CandidateStay[] = occasions
    .filter((o) => o.occasion)
    .map((o) => ({
      start: o.start, end: o.end, nights: o.nights,
      price: o.priceHint ?? null, label: o.label, kind: 'occasion',
    }));

  const lastFree = lastFreeWeekendByMonth([...weekendRows, ...occasionRows], {
    from: now.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  });
  return { weekends: weekendRows, occasions: occasionRows, searches, lastFree, currency };
}
