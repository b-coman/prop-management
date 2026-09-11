/**
 * otaBlockObservations — when an OTA reservation first appeared, and when it went away.
 *
 * WHY THIS EXISTS. The owner counts an OTA booking as a success: he does not treat Booking.com as a
 * competitor to his own site. But nothing in this system can currently say whether an ad flight
 * produced one. The iCal sync writes `availability.externalBlocks[day] = feedId` and a single
 * doc-level `updatedAt` for the whole month, so "a reservation appeared on the 24th" is unrecoverable
 * the moment a second date in that month changes. At ~3.2 bookings a month, booking VOLUME can never
 * answer "did the flight work" — the noise is larger than any effect. Only attribution can, and
 * attribution needs a timestamp. `adOutcomes.ts` already carries the caveat naming this exact hole:
 * "utmAttributed is a first-party FLOOR — it misses cross-device, cookie-loss, and phone/walk-in
 * bookings."
 *
 * WHY A SIBLING COLLECTION AND NOT A FIELD ON THE AVAILABILITY DOC. `updateAvailabilityAdmin(...,
 * { clearExternalBlocks: true })` in `lib/availability-admin.ts` deletes `externalBlocks.{day}` the
 * moment the owner records that OTA reservation as a real booking — which is to say, exactly when the
 * evidence becomes interesting. A parallel map on the same document would be wiped by the same call,
 * or would survive it only by accident. Kept outside, the record is nobody else's to delete.
 *
 * APPEND-ONLY, like `channelPriceObservations` (services/growth/parityObservations.ts), whose shape
 * this deliberately mirrors: one write door, Admin SDK only, both an injectable ISO `capturedAt` (so
 * every row in one sync run shares a timestamp) and a server `createdAt` as the tamper-proof backstop.
 * Readers take the newest per key.
 *
 * WHAT IT CANNOT TELL YOU. `capturedAt` is when the SYNC SAW the block, not when the guest pressed
 * book. The cron runs every 15 minutes, so it is an upper bound accurate to a quarter of an hour —
 * fine for "was this inside the flight window", useless for anything finer. And it starts empty:
 * every reservation taken before this shipped is unrecoverable, because the information was never
 * written down.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import type { IcalEventKind } from '@/lib/ical/classifyEvent';
import { loggers } from '@/lib/logger';

const logger = loggers.icalSync;
const COLLECTION = 'otaBlockObservations';

export type OtaBlockEvent = 'appeared' | 'released';

export interface OtaBlockObservation {
  /** `propertyId|YYYY-MM-DD|feedId` — stable across runs, so the same night is comparable over time. */
  cellId: string;
  propertyId: string;
  /** The blocked night, `YYYY-MM-DD`. */
  date: string;
  feedId: string;
  /** Feed name at capture time (e.g. "Booking.com"). Denormalised: feeds get renamed and deleted. */
  feedName: string;
  event: OtaBlockEvent;
  /**
   * The reservation's iCal UID, when the feed gives us one. This is what lets consecutive nights be
   * folded back into ONE booking instead of counting as four. Optional because a release is detected
   * from our own stored state, by which point the event that created it is long gone.
   */
  uid?: string;
  /** Feed-provided summary, trimmed. Booking.com uses "CLOSED - Not available"; Airbnb names the guest. */
  summary?: string;
  /**
   * Whether this was a guest stay or an OTA closing inventory. Attribution counts 'reservation' only.
   * Without it the store filled with phantom bookings on its first day live: Booking.com publishes a
   * rolling 551-night "CLOSED - Not available" horizon block, and every time that horizon moved it
   * looked like a reservation appearing and another being cancelled.
   */
  kind: IcalEventKind;
  /** Nights in the SOURCE event, not this row. 551 is a horizon, not somebody's holiday. */
  eventNights?: number;
  capturedAt: string;
  createdAt: unknown;
}

/** `propertyId|YYYY-MM-DD|feedId`. Built here so no caller ever assembles one by hand. */
export function otaCellId(propertyId: string, date: string, feedId: string): string {
  return `${propertyId}|${date}|${feedId}`;
}

export interface RecordOtaBlockInput {
  propertyId: string;
  date: string;
  feedId: string;
  feedName: string;
  event: OtaBlockEvent;
  uid?: string;
  summary?: string;
  kind?: IcalEventKind;
  eventNights?: number;
  /** Shared across one sync run so a multi-night reservation gets one timestamp, not four. */
  capturedAt?: string;
}

/**
 * The only door into the store. Validates rather than trusting the caller, because a malformed date
 * here is not a crash — it is a row that silently never matches a flight window again.
 *
 * Never throws to the caller's detriment: the iCal sync's job is to keep the calendar correct, and a
 * failure to write an observation must not fail a sync or leave the calendar half-updated. Errors are
 * logged and swallowed. A missing observation costs us attribution; a failed sync costs a double
 * booking.
 */
export async function recordOtaBlockObservations(
  inputs: RecordOtaBlockInput[],
  capturedAt: string = new Date().toISOString(),
): Promise<number> {
  if (!inputs.length) return 0;

  const valid: RecordOtaBlockInput[] = [];
  for (const input of inputs) {
    if (!input.propertyId || !input.feedId) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      logger.warn('otaBlockObservations: refusing a malformed date', { date: input.date, feedId: input.feedId });
      continue;
    }
    valid.push(input);
  }
  if (!valid.length) return 0;

  try {
    const db = await getAdminDb();
    // Chunked at 400 rather than the 500 hard limit, and a FRESH batch per chunk: a committed
    // WriteBatch cannot be reused, which is a live bug in ical-import.ts's own batching.
    let written = 0;
    for (let i = 0; i < valid.length; i += 400) {
      const batch = db.batch();
      for (const input of valid.slice(i, i + 400)) {
        const doc: OtaBlockObservation = {
          cellId: otaCellId(input.propertyId, input.date, input.feedId),
          propertyId: input.propertyId,
          date: input.date,
          feedId: input.feedId,
          feedName: input.feedName,
          event: input.event,
          ...(input.uid ? { uid: input.uid } : {}),
          ...(input.summary ? { summary: input.summary.slice(0, 200) } : {}),
          kind: input.kind ?? 'unknown',
          ...(typeof input.eventNights === 'number' ? { eventNights: input.eventNights } : {}),
          capturedAt: input.capturedAt ?? capturedAt,
          createdAt: FieldValue.serverTimestamp(),
        };
        batch.set(db.collection(COLLECTION).doc(), doc);
        written++;
      }
      await batch.commit();
    }
    logger.info('OTA block observations recorded', { count: written, capturedAt });
    return written;
  } catch (error) {
    logger.error('otaBlockObservations: write failed, sync continues', error as Error, { count: valid.length });
    return 0;
  }
}

/**
 * Observations for a property in a window, newest first.
 *
 * Filters `capturedAt` (when we SAW it), not `date` (the night itself) — the question this store
 * exists to answer is "did a booking happen while the ads were running", which is about the moment of
 * observation, not the moment of stay.
 */
export async function loadOtaBlockObservations(
  propertyId: string,
  sinceIso: string,
  untilIso?: string,
): Promise<OtaBlockObservation[]> {
  const db = await getAdminDb();
  const snap = await db.collection(COLLECTION)
    .where('propertyId', '==', propertyId)
    .where('capturedAt', '>=', sinceIso)
    .get();
  return snap.docs
    .map(d => d.data() as OtaBlockObservation)
    .filter(o => !untilIso || o.capturedAt <= untilIso)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

/**
 * Fold night-level observations into reservations.
 *
 * A four-night booking arrives as four rows. Counting rows would report four bookings, which is the
 * kind of number that reads as a working funnel and is not one.
 *
 * ONLY 'reservation' ROWS COUNT. On its first day live this store recorded Booking.com's rolling
 * 551-night "CLOSED - Not available" horizon as reservations appearing and, an hour later, as
 * cancellations — pure noise in the one number the store exists to produce. `classifyIcalEvent` tells
 * the two apart; `includeKinds` is there so a reader can deliberately look at the rest.
 *
 * GROUPED BY UID, OR BY CONSECUTIVE NIGHTS. The first version fell back to grouping by capture
 * instant when a feed gave no uid, which folded 2027-09-05 and 2028-03-10 into one "2-night stay"
 * purely because the same sync saw both. Nights are now only joined when they actually touch.
 */
export function groupIntoReservations(
  observations: OtaBlockObservation[],
  includeKinds: IcalEventKind[] = ['reservation'],
): Array<{ feedId: string; feedName: string; uid?: string; nights: string[]; capturedAt: string; kind: IcalEventKind }> {
  const nextDay = (d: string) => {
    const t = new Date(`${d}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + 1);
    return t.toISOString().slice(0, 10);
  };

  const appeared = observations
    .filter((o) => o.event === 'appeared')
    .filter((o) => includeKinds.includes(o.kind ?? 'unknown'))
    .sort((a, b) => a.date.localeCompare(b.date));

  const groups: Array<{ feedId: string; feedName: string; uid?: string; nights: string[]; capturedAt: string; kind: IcalEventKind }> = [];

  for (const o of appeared) {
    const existing = groups.find(
      (g) =>
        g.feedId === o.feedId &&
        (o.uid
          ? g.uid === o.uid
          : // No uid: join only a night that literally continues this run.
            !g.uid && nextDay(g.nights[g.nights.length - 1]) === o.date),
    );
    if (existing) {
      existing.nights.push(o.date);
      if (o.capturedAt < existing.capturedAt) existing.capturedAt = o.capturedAt;
    } else {
      groups.push({
        feedId: o.feedId,
        feedName: o.feedName,
        uid: o.uid,
        nights: [o.date],
        capturedAt: o.capturedAt,
        kind: o.kind ?? 'unknown',
      });
    }
  }

  return groups
    .map((g) => ({ ...g, nights: [...g.nights].sort() }))
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}
