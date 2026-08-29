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
import { normalizeChannel } from '@/lib/channels';

const logger = loggers.parity;
const COLLECTION = 'channelPriceObservations';

/**
 * How a price was read. `programApplied` is separate from `program` on purpose: the owner switches
 * Genius OFF on Christmas and New Year deliberately, so a Booking capture on those dates has a Genius
 * account that is simply not being applied. That is a business fact, not a failed capture.
 *
 * The Genius LEVEL is deliberately not recorded — this property participates at Level 1 only, so an
 * L1 and an L3 account see the same price and storing the level would imply a distinction that does
 * not exist here.
 */
export interface CaptureSession {
  loggedIn: boolean;
  program: 'genius' | 'host' | null;
  programApplied: boolean;
  currency: string;
}

export type RatePlan = 'flexible' | 'non-refundable' | 'unknown';

export type ObservationSubject =
  | { kind: 'self' }
  | { kind: 'competitor'; listingId: string };

export interface ObservationRecord extends Observation {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  channel: string;
  /** Login state / currency the capture was made in — a Genius or host session skews the number. */
  sessionState?: string;
  /**
   * The same fact, structured, because the prose form proved unfilterable: the first 199 observations
   * carry 29 distinct `sessionState` strings, so nothing downstream can mechanically exclude the
   * logged-out ones. Any fit that mixes them is comparing different guests.
   */
  session?: CaptureSession;
  /**
   * Which offer was read. Booking sells the peak windows non-refundable, and its apparent "discount"
   * on those dates is really the gap between the flexible and non-refundable plans. Comparing a
   * non-refundable OTA price to a flexible direct price is comparing two products.
   */
  ratePlan?: RatePlan;
  /**
   * Whose price this is. Defaults to the owner's own listing; competitor tracking reuses this
   * collection unchanged rather than needing a migration over a store that will hold thousands of rows.
   */
  subject?: ObservationSubject;
  /**
   * The page text the figures were read from, trimmed. Parsers rot when a site re-renders, and without
   * the source a bad parse is undetectable and unfixable — the numbers look plausible and nothing can
   * re-derive them. Kept short; the full text goes to `channelPriceImports`.
   */
  rawExcerpt?: string;
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
  /** Structured session — see ObservationRecord.session. */
  session?: CaptureSession;
  /** Which rate plan the captured price belongs to. */
  ratePlan?: RatePlan;
  /** Whose listing. Defaults to `{ kind: 'self' }`. */
  subject?: ObservationSubject;
  /** A trimmed slice of the page text the numbers came from. */
  rawExcerpt?: string;
  /**
   * The same window's direct quote, when known. Used only as a magnitude sanity check (see below);
   * never stored. Omit to skip the check.
   */
  referenceTotal?: number;
  /**
   * Validate exactly as a real write would, then write nothing. A capture carries a `capturedAt`, so
   * a test write does not merely add a row — it marks a stale cell FRESH and removes it from the
   * work-list. Pre-flighting a batch must therefore be possible without touching the store, and it
   * must run the same rules or it proves nothing.
   */
  dryRun?: boolean;
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
  // The channel is embedded raw in the cellId, so a misspelling does not fail — it writes cleanly and
  // creates a cell that nothing will ever match again. `verifyPushesFromObservations` normalizes on
  // READ, so the asymmetry meant a typo could silently orphan an observation forever. Refuse it here,
  // at the only door into the store.
  if (!normalizeChannel(input.channel)) {
    throw new Error(
      `cell ${input.cellId}: unknown channel "${input.channel}". ` +
      `Use a canonical id or a known alias — an unrecognised channel orphans the cell.`,
    );
  }

  const needsFx = rawCurrency !== 'RON';
  if (needsFx && !input.fxRateToRon) {
    throw new Error(`cell ${input.cellId}: ${rawCurrency} capture requires --fx (rate to RON)`);
  }
  if (needsFx && !input.fxRateSource) {
    throw new Error(`cell ${input.cellId}: a converted price requires --fx-source (who says so, and when)`);
  }
  // Round to the leu-cent, not the leu. `Math.round` here was irrecoverable: a USD VRBO capture
  // converted at 4.54 loses up to half a leu per observation, and the drift the system exists to
  // measure is of that order on short windows. Two decimals keeps the figure exact enough to
  // re-derive while avoiding float noise in stored data.
  const toRon = (v: number) => Math.round(v * (needsFx ? input.fxRateToRon! : 1) * 100) / 100;
  const guestTotalRon = input.status === 'captured' ? toRon(input.guestTotal as number) : null;

  // A units error passes every rule above: a number and a currency label are each plausible on their
  // own. It has already happened here — four VRBO cells recorded USD figures labelled RON, so 3,300
  // was stored as 728 and read as the cheapest channel on the market. Provenance cannot catch that;
  // only magnitude can. The caller supplies the same window's direct quote when it has one.
  if (input.status === 'captured' && typeof input.referenceTotal === 'number' && input.referenceTotal > 0) {
    const ratio = (input.guestTotal as number) / input.referenceTotal;
    if (ratio < 0.5 || ratio > 2) {
      throw new Error(
        `cell ${input.cellId}: ${Math.round(input.guestTotal as number)} is ${ratio.toFixed(2)}x the ` +
        `direct quote of ${Math.round(input.referenceTotal)} — outside the plausible 0.5x-2x band. ` +
        `Almost always a currency or per-night/total mix-up. Re-read the page; if the price really is ` +
        `this far out, record it with --force-magnitude and say why.`,
      );
    }
  }

  if (input.dryRun) return 'dry-run';

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
    listTotal: input.listTotal != null ? toRon(input.listTotal) : null,
    rawTotal: input.guestTotal ?? null,
    rawCurrency,
    ...(needsFx ? { fxRateToRon: input.fxRateToRon, fxRateSource: input.fxRateSource } : {}),
    promoActive: input.promoActive ?? false,
    subject: input.subject ?? { kind: 'self' },
    ...(input.session ? { session: input.session } : {}),
    ...(input.ratePlan ? { ratePlan: input.ratePlan } : {}),
    ...(input.rawExcerpt ? { rawExcerpt: input.rawExcerpt.slice(0, 2000) } : {}),
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
