/**
 * growth/signals — the two ROUTING signals the promotion analyst reads before choosing an instrument,
 * lifted out of `scripts/situation-pack.ts` so they are importable by any arm (not trapped in a CLI).
 * See `docs/promotion-system-architecture.md` §0.5 / §7 (Move 1) and the analyst doctrine in
 * `.claude/skills/situation-analyst/SKILL.md` ("Choosing the instrument — a prior is not a verdict").
 *
 *   1. recentCancellations — forward (still-future) cancelled stays: re-opened inventory AND a
 *      demand-softness signal for that window.
 *   2. outreachLedger      — past WhatsApp runs with their ATTRIBUTABLE conversion (bookedWithin120d):
 *      a recent run that converted ≈0 means the warm channel is spent for what it was aimed at.
 *
 * Two layers:
 *   - `compute*` — PURE functions over already-shaped data. `situation-pack.ts` calls these with the
 *     data it already fetched, so its output is byte-identical to the old inline code.
 *   - `get*`     — convenience fetchers (`propertyId` → result) that read Firestore + shape + compute,
 *     for in-app arms (Move 4). Server-only (Admin SDK).
 *
 * Facts only — these NEVER decide routing; the analyst/router does. Names are never included.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { normalizeChannel } from '@/lib/channels';

// ── local helpers (kept identical to scripts/situation-pack.ts to guarantee zero behaviour change) ──
const toDate = (v: unknown): Date | null => {
  const x = v as { _seconds?: number; toDate?: () => Date } | string | Date | null | undefined;
  return (x as { _seconds?: number })?._seconds
    ? new Date((x as { _seconds: number })._seconds * 1000)
    : (x as { toDate?: () => Date })?.toDate
      ? (x as { toDate: () => Date }).toDate()
      : typeof x === 'string'
        ? new Date(x)
        : x instanceof Date
          ? x
          : null;
};
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const nights = (a: Date, b: Date) => Math.round((+b - +a) / 86400000);
const round = (n: number, d = 0) => Number(n.toFixed(d));
const priceOf = (b: SignalBooking) => b.pricing?.total ?? b.pricing?.totalPrice ?? 0;

// ── input shapes (what the compute functions need — a subset of a Firestore booking / thread / guest) ──
export interface SignalBooking {
  id?: string;
  status?: string;
  /** check-in / check-out / created, already parsed to Date (null if absent). */
  ci?: Date | null;
  co?: Date | null;
  created?: Date | null;
  cancelledAt?: unknown;
  source?: string | null;
  imported?: boolean;
  pricing?: { total?: number; totalPrice?: number } | null;
}
export interface SignalThread { messages?: Array<{ direction?: string; ts?: string }> }
export interface SignalGuest { id: string; bookingIds?: string[] }

// ── output shapes ──
export interface CancellationItem {
  window: string;
  month: string;
  nights: number;
  valueLost: number;
  channel: string | null;
  cancelledDaysAgo: number | null;
}
export interface RecentCancellations {
  note: string;
  forwardCount: number;
  nightsReopened: number;
  items: CancellationItem[];
}
export interface OutreachRun {
  date: string;
  daysAgo: number;
  recipients: number;
  repliedWithin14d: number;
  replyRatePct: number;
  bookedWithin120d: number;
}

const RECENT_CANCELLATIONS_NOTE =
  'Cancelled bookings whose stay is still in the FUTURE as of the pack date. Each one both re-opened ' +
  'that window to inventory (it now sits inside a freeRun) AND is a signal demand there was soft — a ' +
  'guest who had committed backed out. `cancelledDaysAgo` shows how fresh the signal is (null if the ' +
  'cancellation timestamp was not recorded). valueLost is net-to-owner (dataQuality.amountsNote).';

/**
 * Forward (still-future) cancellations, newest-window-first. `allBookings` must already be shaped with
 * `ci`/`co` as Date (and filtered to those present, as the pack does) — the fetcher below does this.
 */
export function computeRecentCancellations(allBookings: SignalBooking[], asOf: Date): RecentCancellations {
  const forwardCancellations = allBookings
    .filter(b => b.status === 'cancelled' && b.ci && b.ci >= asOf)
    .map(b => {
      const cancelledAt = toDate(b.cancelledAt);
      return {
        window: `${ymd(b.ci!)}→${ymd(b.co!)}`,
        month: `${b.ci!.getUTCFullYear()}-${String(b.ci!.getUTCMonth() + 1).padStart(2, '0')}`,
        nights: nights(b.ci!, b.co!),
        valueLost: round(priceOf(b)),
        channel: normalizeChannel(b.source) ?? b.source ?? null,
        cancelledDaysAgo: cancelledAt ? nights(cancelledAt, asOf) : null,
      };
    })
    .sort((a, b) => (a.window < b.window ? -1 : 1));
  return {
    note: RECENT_CANCELLATIONS_NOTE,
    forwardCount: forwardCancellations.length,
    nightsReopened: forwardCancellations.reduce((s, c) => s + c.nights, 0),
    items: forwardCancellations.slice(0, 12),
  };
}

/**
 * Past manual WhatsApp runs (outbound-day clusters of ≥8 recipients), oldest→newest, each with its
 * reply rate and ATTRIBUTABLE conversion: `bookedWithin120d` counts recipients who MADE a booking
 * (createdAt) after the run within 120d — NOT a pre-existing reservation whose stay merely falls after
 * it (gated to `imported === false`, which carries a real booking date). Evidence, not proof of cause.
 */
export function computeOutreachLedger(
  threads: Map<string, SignalThread>,
  guests: SignalGuest[],
  bookingById: Map<string, SignalBooking>,
  asOf: Date,
): OutreachRun[] {
  const outboundDays = new Map<string, Set<string>>();
  threads.forEach((t, id) => {
    (t.messages || []).forEach((m) => {
      // NB: intentionally the same loose comparison as the original inline code (an outbound message
      // always carries a ts in real data) so the pack output stays byte-identical.
      if (m.direction !== 'out' || (m.ts as unknown as string) >= ymd(asOf)) return;
      const day = String(m.ts).slice(0, 10);
      if (!outboundDays.has(day)) outboundDays.set(day, new Set());
      outboundDays.get(day)!.add(id);
    });
  });
  return [...outboundDays.entries()].filter(([, s]) => s.size >= 8).sort()
    .map(([day, gset]) => {
      const dayD = new Date(`${day}T00:00:00Z`);
      let replied = 0;
      let booked = 0;
      gset.forEach(gid => {
        const msgs = (threads.get(gid)?.messages || []);
        if (msgs.some(m => m.direction === 'in' && !!m.ts && new Date(m.ts) > dayD && nights(dayD, new Date(m.ts)) <= 14)) replied++;
        const g = guests.find(x => x.id === gid);
        const after = (g?.bookingIds || []).map((bid) => bookingById.get(bid)).filter(Boolean)
          .some((b) => b!.imported === false && b!.created && b!.created > dayD && nights(dayD, b!.created) <= 120);
        if (after) booked++;
      });
      return {
        date: day,
        daysAgo: nights(dayD, asOf),
        recipients: gset.size,
        repliedWithin14d: replied,
        replyRatePct: round(replied / gset.size * 100),
        bookedWithin120d: booked,
      };
    });
}

// ── forward-inventory calendar signals (free runs + occasion/long-weekend windows) ──────────────
// Extracted VERBATIM from the inline pack code (situationPack.ts §forward-inventory) so the situation
// analyst AND the landing example-stays reasoner (src/lib/landing/exampleStays.ts) share one truth.
// Pure over already-shaped data (dates + holiday docs) — output byte-identical to the old inline loops.

/** A row from the `holidays` collection (subset the compute functions read). */
export interface HolidayDoc { name: string; type: string; startDate: string; endDate: string; source?: string | null }
/** An upcoming public holiday / school break, ready for the pack or a reasoner. */
export interface Occasion { name: string; type: string; startDate: string; endDate: string; source: string | null }
/** A contiguous run of free nights: `end` is the last free NIGHT (checkout = end + 1 day). */
export interface FreeRun { start: string; end: string; nights: number }
/** A long-weekend / bridge window: consecutive off-days (weekends + holidays), joined across 1-2
 *  working-day bridges. `bridgeDaysRequired` = leave days to take the whole window (0 = already long). */
export interface ExtendedWindow {
  start: string; end: string; totalDays: number;
  bridgeDaysRequired: number; bridgeDays: string[]; holidaysInside: string[];
}

/**
 * Group an ordered list of `YYYY-MM-DD` dates into contiguous runs of free nights. `isFree(date)`
 * decides each night (the pack passes `availByDate` with missing = available; the reasoner passes the
 * inverse of the availability service's blocked set). `end` is the last free night in the run.
 */
export function computeFreeRuns(dates: string[], isFree: (ymd: string) => boolean): FreeRun[] {
  const runs: FreeRun[] = [];
  let cur: string[] = [];
  for (const k of dates) {
    if (isFree(k)) cur.push(k);
    else { if (cur.length) runs.push({ start: cur[0], end: cur[cur.length - 1], nights: cur.length }); cur = []; }
  }
  if (cur.length) runs.push({ start: cur[0], end: cur[cur.length - 1], nights: cur.length });
  return runs;
}

/** Upcoming occasions from the `holidays` collection (endDate on/after `asOf`), soonest first. */
export function computeOccasions(holidays: HolidayDoc[], asOf: Date, limit = 20): Occasion[] {
  return holidays
    .filter(h => h.endDate >= ymd(asOf))
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
    .slice(0, limit)
    .map(h => ({ name: h.name, type: h.type, startDate: h.startDate, endDate: h.endDate, source: h.source ?? null }));
}

/**
 * Derive long-weekend / bridge windows over `horizonDays` from `asOf`: runs of off-days (Sat/Sun +
 * holiday days) joined when only 1-2 working days separate them (those working days become the bridge).
 * Only windows a guest would actually travel for (≥4 total days, anchored by a bridge or an edge
 * holiday) are returned, newest-first, capped at 12. Byte-identical to the pack's inline IIFE.
 */
export function computeExtendedWindows(holidays: HolidayDoc[], asOf: Date, horizonDays = 400): ExtendedWindow[] {
  const holidayDates = new Set<string>();
  holidays
    .filter(h => h.type === 'major' || h.type === 'minor' || h.type === 'bridge-day')
    .forEach(h => {
      for (let d = new Date(`${h.startDate}T00:00:00Z`); ymd(d) <= h.endDate; d = new Date(+d + 86400000)) holidayDates.add(ymd(d));
    });
  const isOff = (d: Date) => { const w = d.getUTCDay(); return w === 0 || w === 6 || holidayDates.has(ymd(d)); };
  const offRuns: { start: Date; end: Date }[] = [];
  let run: Date[] = [];
  for (let d = new Date(asOf); d < new Date(+asOf + horizonDays * 86400000); d = new Date(+d + 86400000)) {
    if (isOff(d)) run.push(new Date(d));
    else { if (run.length) offRuns.push({ start: run[0], end: run[run.length - 1] }); run = []; }
  }
  if (run.length) offRuns.push({ start: run[0], end: run[run.length - 1] });
  const windows: ExtendedWindow[] = [];
  for (let i = 0; i < offRuns.length; i++) {
    const start = offRuns[i].start;
    let end = offRuns[i].end;
    const bridges: string[] = [];
    while (i + 1 < offRuns.length) {
      const gap = nights(end, offRuns[i + 1].start) - 1;
      if (gap >= 1 && gap <= 2) {
        for (let k = 1; k <= gap; k++) bridges.push(ymd(new Date(+end + k * 86400000)));
        end = offRuns[i + 1].end; i++;
      } else break;
    }
    const total = nights(start, end) + 1;
    if (total >= 4 && (bridges.length || holidayDates.has(ymd(start)) || holidayDates.has(ymd(end)))) {
      windows.push({
        start: ymd(start), end: ymd(end), totalDays: total,
        bridgeDaysRequired: bridges.length, bridgeDays: bridges,
        holidaysInside: [...holidayDates].filter(h => h >= ymd(start) && h <= ymd(end)).sort(),
      });
    }
  }
  return windows.slice(0, 12);
}

// ── convenience fetchers (propertyId → result) for in-app arms (Move 4). Server-only. ──

function shapeBooking(id: string, x: Record<string, unknown>): SignalBooking {
  return {
    id,
    status: x.status as string | undefined,
    ci: toDate(x.checkInDate),
    co: toDate(x.checkOutDate),
    created: toDate(x.createdAt),
    cancelledAt: x.cancelledAt,
    source: (x.source as string | undefined) ?? null,
    imported: x.imported as boolean | undefined,
    pricing: x.pricing as SignalBooking['pricing'],
  };
}

/** Forward cancellations for a property (re-opened inventory + demand-softness). */
export async function getRecentCancellations(propertyId: string, asOf: Date = new Date()): Promise<RecentCancellations> {
  const db = await getAdminDb();
  const snap = await db.collection('bookings').where('propertyId', '==', propertyId).get();
  const bookings = snap.docs
    .map(d => shapeBooking(d.id, d.data() as Record<string, unknown>))
    .filter(b => b.ci && b.co);
  return computeRecentCancellations(bookings, asOf);
}

/** Past-outreach ledger for a property (recency + attributable conversion). */
export async function getOutreachLedger(propertyId: string, asOf: Date = new Date()): Promise<OutreachRun[]> {
  const db = await getAdminDb();
  const [bSnap, gSnap, tSnap] = await Promise.all([
    db.collection('bookings').where('propertyId', '==', propertyId).get(),
    db.collection('guests').where('propertyIds', 'array-contains', propertyId).get(),
    db.collection('whatsappThreads').get(),
  ]);
  const bookingById = new Map<string, SignalBooking>();
  bSnap.docs.forEach(d => {
    const b = shapeBooking(d.id, d.data() as Record<string, unknown>);
    if (b.ci && b.co) bookingById.set(d.id, b);
  });
  const guests: SignalGuest[] = gSnap.docs.map(d => ({ id: d.id, bookingIds: (d.data() as { bookingIds?: string[] }).bookingIds }));
  const threads = new Map<string, SignalThread>(tSnap.docs.map(d => [d.id, d.data() as SignalThread]));
  return computeOutreachLedger(threads, guests, bookingById, asOf);
}

/** All rows from the `holidays` collection (shared by the analyst pack + the landing reasoner). */
export async function getHolidays(): Promise<HolidayDoc[]> {
  const db = await getAdminDb();
  const snap = await db.collection('holidays').get();
  return snap.docs.map(d => d.data() as HolidayDoc);
}
