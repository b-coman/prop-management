/**
 * Persistence for parity observations — the piece that turns a manual browser session into a system.
 *
 * Without this, every run is hand-assembled: numbers go from a page, through someone's short-term
 * memory, into a throwaway script. Gaps are invisible, staleness is invisible, and two runs cannot be
 * compared. With it, a run is "work the outstanding list until coverage is complete", and a re-run six
 * weeks later reuses the same cell ids so drift is measurable.
 *
 * Admin-SDK only. Nothing here judges prices — that is `parityMath`.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { Observation, ObservationStatus } from '@/lib/growth/parityWorklist';

const logger = loggers.campaign;
const COLLECTION = 'channelPriceObservations';

export interface ObservationRecord extends Observation {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  channel: string;
  /** Login state / currency the capture was made in — a Genius or host session skews the number. */
  sessionState?: string;
  capturedBy?: string;
  /**
   * Currency conversion, kept explicit. `guestTotal` is ALWAYS in the comparison currency (RON) so the
   * maths never mixes units, but a converted figure must stay re-derivable: some channels cannot quote
   * in RON at all (VRBO has no Romanian region — currency is bound to region), so their number is
   * necessarily converted. Storing only the result would leave a figure nobody could audit or correct
   * when the rate moves.
   */
  rawTotal?: number | null;
  rawCurrency?: string;
  fxRateToRon?: number;
  fxRateSource?: string;
}

export interface RecordObservationInput {
  propertyId: string;
  cellId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  channel: string;
  status: ObservationStatus;
  guestTotal?: number | null;
  listTotal?: number | null;
  promoActive?: boolean;
  reason?: string;
  source: 'api' | 'browser';
  url?: string;
  sessionState?: string;
  capturedBy?: string;
  /** Injected so a batch of captures can share one timestamp; defaults to now. */
  capturedAt?: string;
  /** The figure exactly as the page displayed it, before any conversion. */
  rawTotal?: number | null;
  /** Currency of `rawTotal`. Defaults to RON (no conversion). */
  rawCurrency?: string;
  /** Multiplier from `rawCurrency` to RON. Required whenever rawCurrency is not RON. */
  fxRateToRon?: number;
  /** Where the rate came from — a converted price with an unattributed rate is not evidence. */
  fxRateSource?: string;
}

/**
 * Append an observation. Append-only by design: a new capture never overwrites the old one, so the
 * history of a cell is the price history of that window. Readers take the newest.
 */
export async function recordObservation(input: RecordObservationInput): Promise<string> {
  if (input.status === 'captured' && typeof input.guestTotal !== 'number') {
    throw new Error(`cell ${input.cellId}: status 'captured' requires a guestTotal`);
  }
  if (input.status !== 'captured' && !input.reason) {
    throw new Error(`cell ${input.cellId}: status '${input.status}' requires a reason — a blank is not an outcome`);
  }
  // A price is meaningless without knowing whose price it is. Booking.com shows most people a Genius
  // rate and the listing is priced expecting it, so a logged-out capture reads a number almost no real
  // guest pays. This was optional once, and 32 of the first 77 observations ended up with no session
  // recorded at all — unusable, because there is no way to tell afterwards what they represent.
  if (input.status === 'captured' && !input.sessionState?.trim()) {
    throw new Error(
      `cell ${input.cellId}: a captured price requires --session describing how it was read ` +
      `(e.g. "logged in, Genius" / "logged out, RON"). Without it the number cannot be compared later.`,
    );
  }

  // Conversion must be explicit and attributed. A foreign-currency capture with no rate would either
  // be silently treated as RON (wrong by a factor of ~4.5) or silently dropped.
  const rawCurrency = (input.rawCurrency ?? 'RON').toUpperCase();
  const needsFx = rawCurrency !== 'RON';
  if (needsFx && !input.fxRateToRon) {
    throw new Error(`cell ${input.cellId}: ${rawCurrency} capture requires --fx (rate to RON)`);
  }
  if (needsFx && !input.fxRateSource) {
    throw new Error(`cell ${input.cellId}: a converted price requires --fx-source (who says so, and when)`);
  }
  const guestTotalRon = input.status === 'captured'
    ? Math.round((input.guestTotal as number) * (needsFx ? input.fxRateToRon! : 1))
    : null;

  const db = await getAdminDb();
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const doc: ObservationRecord & { createdAt: unknown } = {
    cellId: input.cellId,
    propertyId: input.propertyId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights: input.nights,
    guests: input.guests,
    channel: input.channel,
    status: input.status,
    // Always the comparison currency, so downstream maths never mixes units.
    guestTotal: guestTotalRon,
    listTotal: input.listTotal != null ? Math.round(input.listTotal * (needsFx ? input.fxRateToRon! : 1)) : null,
    rawTotal: input.guestTotal ?? null,
    rawCurrency,
    ...(needsFx ? { fxRateToRon: input.fxRateToRon, fxRateSource: input.fxRateSource } : {}),
    promoActive: input.promoActive ?? false,
    ...(input.reason ? { reason: input.reason } : {}),
    source: input.source,
    ...(input.url ? { url: input.url } : {}),
    ...(input.sessionState ? { sessionState: input.sessionState } : {}),
    ...(input.capturedBy ? { capturedBy: input.capturedBy } : {}),
    capturedAt,
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection(COLLECTION).add(doc);
  logger.info('parity observation recorded', {
    cellId: input.cellId, channel: input.channel, status: input.status,
    totalRon: guestTotalRon, raw: input.guestTotal ?? null, currency: rawCurrency,
  });
  return ref.id;
}

/** Every observation for a property, newest first. The report reads this and nothing else. */
export async function loadObservations(propertyId: string, sinceIso?: string): Promise<ObservationRecord[]> {
  const db = await getAdminDb();
  let q = db.collection(COLLECTION).where('propertyId', '==', propertyId);
  if (sinceIso) q = q.where('capturedAt', '>=', sinceIso);
  const snap = await q.get();
  return snap.docs
    .map((d) => d.data() as ObservationRecord)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

/** Newest observation per cell — what coverage and the report table are built from. */
export async function latestByCell(propertyId: string, sinceIso?: string): Promise<Map<string, ObservationRecord>> {
  const all = await loadObservations(propertyId, sinceIso);
  const map = new Map<string, ObservationRecord>();
  for (const o of all) if (!map.has(o.cellId)) map.set(o.cellId, o); // already newest-first
  return map;
}
