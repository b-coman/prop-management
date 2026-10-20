/**
 * Booking-page searches with dates, counted per day. Server-only (Admin SDK).
 *
 * The free periods widget marks the stay people have been looking at most as "high demand". Until
 * now those searches only existed in Cloud Logging ("Booking check page requested"), which the app
 * cannot read at render time and which keeps 30 days.
 *
 * One doc per property per day, `staySearches/{propertyId}_{YYYY-MM-DD}`, with a counter per date
 * range. Counts are page loads, not people: someone checking the same weekend three times counts
 * three. Good enough to rank stays against each other, which is all it is used for.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { StaySearch } from '@/lib/website/openStays';

const logger = loggers.booking;
const COLLECTION = 'staySearches';
const DAY = 86400000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Count one search. Never throws and never blocks the page: the caller does not await it.
 * Ignores anything that is not a plausible future stay (bad dates, past check-in, over 30 nights).
 */
export async function recordStaySearch(propertyId: string, checkIn: string, checkOut: string): Promise<void> {
  try {
    if (!propertyId || !YMD.test(checkIn) || !YMD.test(checkOut)) return;
    const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / DAY;
    if (!(nights >= 1 && nights <= 30) || checkIn < today()) return;
    const day = today();
    const db = await getAdminDb();
    await db.collection(COLLECTION).doc(`${propertyId}_${day}`).set(
      { propertyId, day, counts: { [`${checkIn}_${checkOut}`]: FieldValue.increment(1) }, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    logger.warn('Could not record stay search', { propertyId, checkIn, checkOut, error: (err as Error)?.message });
  }
}

/** Searches over the last `days` days, summed per date range. Empty on any error. */
export async function getRecentSearches(propertyId: string, days = 14): Promise<StaySearch[]> {
  try {
    const db = await getAdminDb();
    const refs = Array.from({ length: days }, (_, i) =>
      db.collection(COLLECTION).doc(`${propertyId}_${new Date(Date.now() - i * DAY).toISOString().slice(0, 10)}`),
    );
    const snaps = await db.getAll(...refs);
    const sum = new Map<string, number>();
    for (const s of snaps) {
      const counts = (s.data()?.counts ?? {}) as Record<string, number>;
      for (const [k, n] of Object.entries(counts)) sum.set(k, (sum.get(k) ?? 0) + (Number(n) || 0));
    }
    return [...sum].map(([k, count]) => { const [start, end] = k.split('_'); return { start, end, count }; });
  } catch (err) {
    logger.warn('Could not read stay searches', { propertyId, error: (err as Error)?.message });
    return [];
  }
}
