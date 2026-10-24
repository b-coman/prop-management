/**
 * Server half of the free periods widget: asks the booking engine what is free and what it costs.
 *
 * Two sources, both already used elsewhere and both asking the engine rather than knowing:
 *   - `findOpenWeekends`: every Friday-Sunday in the window, quoted. A booked weekend, or one
 *     inside a block with a longer minimum stay, refuses itself.
 *   - `buildExampleStays`: occasion stays (1 Decembrie, Christmas, school breaks) that fit the
 *     calendar and the per-date minimum stay.
 * So when it's built, a row can never offer a stay the booking page would refuse, and every price is
 * the total the booking page shows first (base occupancy, cleaning included).
 *
 * Built once an hour by the calendar sync cron (`refreshOpenStays`) and stored in Firestore, one
 * doc per property and horizon. A page reads that one doc, so it never waits for the engine.
 *
 * Until 24 Oct 2026 each server built it on its own, with a 10-minute cache. The site runs no server
 * while it is quiet, so a fresh one starts about 18 times a day, and its first page had nothing
 * cached: it waited up to 2.5 s for the build and, when that ran out, showed the page without the
 * widget. 37 of 56 fresh servers took 2.4 s or more on that first page (20-24 Oct). The build then
 * carried on after the response with the CPU throttled, which Sentry showed as one-minute reads.
 *
 * If the stored copy is missing or older than `MAX_AGE_MS` (the cron stopped), the page builds it
 * itself the old way and stores the result.
 */
import { findOpenWeekends } from '@/lib/landing/openWeekends';
import { buildExampleStays } from '@/lib/landing/exampleStays';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { getRecentSearches } from '@/lib/website/staySearches';
import {
  mergeStays, pickBadges, lastFreeWeekendByMonth, openStaysSettings,
  type CandidateStay, type OpenStayRow, type OpenStaysConfig, type StaySearch,
} from '@/lib/website/openStays';

const logger = loggers.booking;
const COLLECTION = 'openStays';
const DEFAULT_HORIZON = 75;
/** How long a server keeps the stored doc before reading it again. */
const MEMO_MS = 5 * 60 * 1000;
/** Older than this, the hourly refresh has stopped for some reason. */
const MAX_AGE_MS = 3 * 60 * 60 * 1000;
/** With no stored copy at all, how long a page waits for a build before rendering without it. */
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
  builtAt: number;
}

const memo = new Map<string, { at: number; value: Base }>();
const building = new Map<string, Promise<Base | null>>();

const docId = (propertyId: string, horizon: number) => `${propertyId}_${horizon}`;
const today = () => new Date().toISOString().slice(0, 10);

export async function getOpenStays(propertyId: string, config: OpenStaysConfig = {}): Promise<OpenStaysResult | null> {
  const base = await getBase(propertyId, Number(config.horizonDays) || DEFAULT_HORIZON);
  if (!base) return null;
  // The stored copy can be an hour old: drop a stay that has started since.
  const notStarted = (s: CandidateStay) => s.start >= today();
  const rows = pickBadges(mergeStays(base.weekends.filter(notStarted), base.occasions.filter(notStarted), config.maxRows ?? 4), base, config);
  return rows.length ? { rows, currency: base.currency } : null;
}

async function getBase(propertyId: string, horizon: number): Promise<Base | null> {
  const key = docId(propertyId, horizon);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.value;

  const stored = await readStored(key);
  if (stored && Date.now() - stored.builtAt < MAX_AGE_MS) {
    memo.set(key, { at: Date.now(), value: stored });
    return stored;
  }

  logger.warn('Open stays: no recent stored copy, building in the page', { propertyId, horizon, builtAt: stored?.builtAt ?? null });
  const pending = buildAndStore(propertyId, horizon);
  if (stored) return stored; // old, but better than nothing while the new one is built
  return Promise.race([pending, new Promise<null>((r) => setTimeout(() => r(null), WAIT_MS))]);
}

async function readStored(key: string): Promise<Base | null> {
  try {
    const db = await getAdminDb();
    const d = (await db.collection(COLLECTION).doc(key).get()).data();
    if (!d) return null;
    return {
      weekends: d.weekends ?? [], occasions: d.occasions ?? [], searches: d.searches ?? [],
      lastFree: new Map(Object.entries(d.lastFree ?? {})), currency: d.currency, builtAt: Number(d.builtAt) || 0,
    };
  } catch (err) {
    logger.warn('Open stays: could not read stored copy', { key, error: (err as Error)?.message });
    return null;
  }
}

/** Build from the engine and store it. One build per key at a time. Never throws. */
function buildAndStore(propertyId: string, horizon: number): Promise<Base | null> {
  const key = docId(propertyId, horizon);
  let pending = building.get(key);
  if (pending) return pending;
  pending = (async () => {
    try {
      const base = await build(propertyId, horizon);
      if (!base) return null;
      const db = await getAdminDb();
      // JSON round trip drops undefined fields, which Firestore refuses.
      await db.collection(COLLECTION).doc(key).set(JSON.parse(JSON.stringify({
        propertyId, horizonDays: horizon, builtAt: base.builtAt, currency: base.currency,
        weekends: base.weekends, occasions: base.occasions, searches: base.searches,
        lastFree: Object.fromEntries(base.lastFree),
      })));
      memo.set(key, { at: Date.now(), value: base });
      return base;
    } catch (err) {
      logger.warn('Open stays: build failed', { propertyId, horizon, error: (err as Error)?.message });
      return null;
    } finally {
      building.delete(key);
    }
  })();
  building.set(key, pending);
  return pending;
}

/**
 * Rebuild and store the widget for every property page that shows it. Called by the hourly
 * calendar sync, right after new OTA bookings come in. Never throws.
 */
export async function refreshOpenStays(): Promise<void> {
  const done: { propertyId: string; horizon: number; ok: boolean }[] = [];
  try {
    const db = await getAdminDb();
    const templates = new Map<string, any>();
    for (const p of (await db.collection('properties').get()).docs) {
      const templateId = p.data().templateId;
      if (!templateId) continue;
      if (!templates.has(templateId)) templates.set(templateId, (await db.collection('websiteTemplates').doc(templateId).get()).data());
      const template = templates.get(templateId);
      const overrides = (await db.collection('propertyOverrides').doc(p.id).get()).data();
      const horizons = new Set<number>();
      for (const pageName of Object.keys(template?.pages ?? {})) {
        const settings = openStaysSettings(template, overrides, pageName);
        if (settings) horizons.add(Number(settings.horizonDays) || DEFAULT_HORIZON);
      }
      for (const horizon of horizons) {
        done.push({ propertyId: p.id, horizon, ok: !!(await buildAndStore(p.id, horizon)) });
      }
    }
    logger.info('Open stays refreshed', { done });
  } catch (err) {
    logger.warn('Open stays: refresh failed', { done, error: (err as Error)?.message });
  }
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
  return { weekends: weekendRows, occasions: occasionRows, searches, lastFree, currency, builtAt: Date.now() };
}
