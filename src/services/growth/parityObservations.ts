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
    guestTotal: input.guestTotal ?? null,
    listTotal: input.listTotal ?? null,
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
    cellId: input.cellId, channel: input.channel, status: input.status, total: input.guestTotal ?? null,
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
