/**
 * The parity worklist — the contract that makes a run COMPLETE rather than partial.
 *
 * The failure this exists to prevent: a probe list is generated, a human drives a browser through
 * "enough" of it, and the report is assembled by hand from whatever came back. Gaps are invisible
 * because a cell that was never captured simply doesn't appear in the table. The reader sees a tidy
 * grid and reasonably assumes it is the whole picture.
 *
 * So: the unit of work is a CELL — one (window × occupancy × channel) — with a stable id. Every cell
 * is owed an outcome. A cell with no observation renders as UNKNOWN and counts against coverage; it is
 * never silently dropped. A channel that REFUSES to quote (Airbnb enforcing a 4-night minimum) is a
 * recorded outcome with a reason, not a blank.
 *
 * Ids are stable across runs so the same cell can be compared over time — that is what turns a
 * one-off snapshot into drift tracking.
 *
 * Pure: no clock, no I/O. `now` is injected so staleness is deterministic in tests.
 */

export type ObservationStatus =
  /** A price was read. */
  | 'captured'
  /** The channel exists but will not quote this stay (min-stay, occupancy cap, closed dates). */
  | 'refused'
  /** The channel quotes nothing because the dates are taken. */
  | 'unavailable'
  /** The capture failed (bot check, timeout, layout change). Distinct from `refused` on purpose. */
  | 'error';

export interface WorklistCell {
  cellId: string;
  propertyId: string;
  window: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  channel: string;
  priority: 'high' | 'normal';
}

export interface Observation {
  cellId: string;
  status: ObservationStatus;
  /** Guest-facing total, or the direct total for channel `direct`. Null unless status is `captured`. */
  guestTotal: number | null;
  /** The struck-through pre-promotion price, when the page shows one. */
  listTotal?: number | null;
  promoActive?: boolean;
  /** Why a channel refused or a capture failed — required for anything other than `captured`. */
  reason?: string;
  /** ISO timestamp. */
  capturedAt: string;
  /** `api` for the direct engine, `browser` for anything read off a page. */
  source: 'api' | 'browser';
  url?: string;
}

/**
 * WHOSE price a cell holds.
 *
 * Lives here rather than beside the store because `cellId` consumes it, and the cell id is the one
 * thing that must never collide between the owner's own listing and someone else's. Re-exported from
 * `services/growth/parityObservations` so the store keeps a single import for its record shape.
 */
export type ObservationSubject =
  | { kind: 'self' }
  | { kind: 'competitor'; listingId: string };

/** A row written before `subject` existed is the owner's own — competitor capture never ran. */
export const DEFAULT_SUBJECT: ObservationSubject = { kind: 'self' };

/**
 * Stable, human-readable, and identical across runs for the same logical cell — so a February run can
 * be diffed against a December one.
 *
 * **A SELF cell id is byte-identical to what it has always been.** The subject segment is appended
 * only for a competitor, which is what makes competitor tracking a zero-migration change over a store
 * that already holds 790 rows:
 *
 *     self        prahova-mountain-chalet|2026-10-24|2026-10-28|3|airbnb
 *     competitor  prahova-mountain-chalet|2026-10-24|2026-10-28|3|airbnb|comp:vila-luna
 *
 * Without the segment the two collide exactly, and `latestByCell` — which keys on nothing but this
 * string, newest wins — would let a competitor's price silently become the owner's on a board that
 * feeds `apply-band-pricing.ts`, a live price-writing path.
 *
 * The id is built, compared and sorted, never parsed (verified across every call site), so appending
 * a segment is safe.
 */
export function cellId(
  propertyId: string, checkIn: string, checkOut: string, guests: number, channel: string,
  subject: ObservationSubject = DEFAULT_SUBJECT,
): string {
  const base = `${propertyId}|${checkIn}|${checkOut}|${guests}|${channel}`;
  if (subject.kind === 'self') return base;
  // `|` is the field separator. A listing id containing one would produce an id that reads as a
  // different shape and could, with enough bad luck, collide with a real cell. Refuse it at the only
  // place ids are made rather than discovering it in the store.
  if (!subject.listingId || subject.listingId.includes('|')) {
    throw new Error(
      `competitor listingId must be non-empty and free of "|" — got ${JSON.stringify(subject.listingId)}`,
    );
  }
  return `${base}|comp:${subject.listingId}`;
}

/**
 * WHICH subjects a read is asking for. **Required on every read**, with no default, because the
 * failure it prevents is silent and lands on a live price-writing path.
 *
 * `loadObservations` filters on `propertyId` alone. Once competitor rows share this collection, every
 * unscoped reader — `parityView`, `pricing-position`, the report, and `apply-band-pricing.ts`, which
 * WRITES LIVE PRICES — would ingest someone else's price as the owner's without a single error.
 *
 * `'all'` exists but must be asked for by name. There is no honest reason to mix the two subjects in
 * one calculation; the only legitimate uses are auditing and migration.
 */
export type ObservationScope =
  | { kind: 'self' }
  | { kind: 'competitor'; listingId?: string }   // omit listingId for the whole comparable set
  | { kind: 'all' };

/**
 * The subject a stored row represents.
 *
 * **199 of the first 790 rows carry no `subject` field at all** — they predate it, and competitor
 * capture had never run, so every one of them is the owner's own. They must read as `self` rather
 * than as unknown: a Firestore `where('subject.kind','==','self')` would have dropped a quarter of
 * the history silently, which is why scope filtering happens in memory and not in the query.
 */
export function subjectOf(record: { subject?: ObservationSubject }): ObservationSubject {
  return record.subject ?? DEFAULT_SUBJECT;
}

export function matchesScope(record: { subject?: ObservationSubject }, scope: ObservationScope): boolean {
  if (scope.kind === 'all') return true;
  const s = subjectOf(record);
  if (scope.kind === 'self') return s.kind === 'self';
  return s.kind === 'competitor' && (!scope.listingId || s.listingId === scope.listingId);
}

/**
 * Reject a missing or malformed scope AT RUNTIME, not just in the type system.
 *
 * `tsconfig.json` excludes `scripts/`, and twelve of the thirteen callers of these functions live
 * there. A required parameter therefore breaks nothing at compile time for the callers most likely to
 * be missed — this repo has already shipped one annotation that "compiled" only because of that
 * exclusion. So the type is the documentation and this is the guard.
 */
export function requireScope(scope: unknown, fn: string): ObservationScope {
  const k = (scope as { kind?: unknown } | null | undefined)?.kind;
  if (k !== 'self' && k !== 'competitor' && k !== 'all') {
    throw new Error(
      `${fn}() requires an explicit ObservationScope — got ${JSON.stringify(scope)}.\n` +
      `  Pass { kind: 'self' } for the owner's own listings (what every existing caller wants),\n` +
      `  { kind: 'competitor', listingId? } for the comparable set, or { kind: 'all' } to audit both.\n` +
      `  There is no default: an unscoped read would let a competitor's price be read as the owner's.`,
    );
  }
  return scope as ObservationScope;
}

export interface ProbeInput {
  label: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  priority: 'high' | 'normal';
}

/**
 * Expand probes into cells — one per channel, plus a `direct` cell so the site's own price is a
 * recorded observation with provenance rather than an unexamined given.
 */
export function buildWorklist(propertyId: string, probes: ProbeInput[], channels: string[]): WorklistCell[] {
  const cells: WorklistCell[] = [];
  for (const p of probes) {
    for (const channel of ['direct', ...channels]) {
      cells.push({
        cellId: cellId(propertyId, p.checkIn, p.checkOut, p.guests, channel),
        propertyId, window: p.label, checkIn: p.checkIn, checkOut: p.checkOut,
        nights: p.nights, guests: p.guests, channel, priority: p.priority,
      });
    }
  }
  return cells;
}

export interface Coverage {
  total: number;
  captured: number;
  refused: number;
  unavailable: number;
  errored: number;
  /** Cells with no observation at all. The number that matters. */
  missing: number;
  /** Cells resolved one way or another, over total. */
  resolvedPct: number;
  /** Age in days of the OLDEST observation in play — the report's honesty about staleness. */
  oldestAgeDays: number | null;
  /** Cells whose observation is older than the freshness budget. */
  staleCellIds: string[];
  missingCellIds: string[];
  complete: boolean;
}

/**
 * Coverage over a worklist. `complete` requires every cell resolved AND nothing stale — a run that
 * cannot say both is a partial run and must present itself as one.
 */
export function computeCoverage(
  cells: WorklistCell[],
  observations: Observation[],
  opts?: { now?: Date; freshnessDays?: number },
): Coverage {
  const now = opts?.now ?? new Date();
  // 42 days matches the 4-6 week re-measure cadence the skill prescribes and what every caller
  // passes. The old default of 7 was reachable only by a caller that forgot the option, and would
  // have silently reported six-week-old captures as stale under a different rule than the report's.
  const freshnessDays = opts?.freshnessDays ?? 42;
  const byId = new Map<string, Observation>();
  for (const o of observations) {
    const prev = byId.get(o.cellId);
    if (!prev || o.capturedAt > prev.capturedAt) byId.set(o.cellId, o); // newest wins
  }

  let captured = 0, refused = 0, unavailable = 0, errored = 0;
  const missingCellIds: string[] = [];
  const staleCellIds: string[] = [];
  let oldestMs: number | null = null;

  for (const c of cells) {
    const o = byId.get(c.cellId);
    if (!o) { missingCellIds.push(c.cellId); continue; }
    if (o.status === 'captured') captured++;
    else if (o.status === 'refused') refused++;
    else if (o.status === 'unavailable') unavailable++;
    else errored++;

    const ageMs = now.getTime() - Date.parse(o.capturedAt);
    if (Number.isFinite(ageMs)) {
      if (oldestMs === null || ageMs > oldestMs) oldestMs = ageMs;
      if (ageMs > freshnessDays * 86_400_000) staleCellIds.push(c.cellId);
    }
  }

  const resolved = captured + refused + unavailable;
  return {
    total: cells.length,
    captured, refused, unavailable, errored,
    missing: missingCellIds.length,
    resolvedPct: cells.length ? resolved / cells.length : 0,
    oldestAgeDays: oldestMs === null ? null : Math.floor(oldestMs / 86_400_000),
    staleCellIds, missingCellIds,
    // `errored` deliberately blocks completeness: a failed capture is unfinished work, not an answer.
    complete: missingCellIds.length === 0 && errored === 0 && staleCellIds.length === 0,
  };
}

/** The cells still owed work, highest priority first — what the skill should go and do next. */
export function outstandingCells(
  cells: WorklistCell[],
  observations: Observation[],
  opts?: { now?: Date; freshnessDays?: number },
): WorklistCell[] {
  const cov = computeCoverage(cells, observations, opts);
  const owed = new Set([...cov.missingCellIds, ...cov.staleCellIds]);
  // Newest-wins, exactly as computeCoverage resolves it. Building this map with a plain
  // `new Map(observations.map(...))` takes whichever observation happens to come LAST in the array,
  // which is arbitrary. That was harmless only because both callers pre-deduped via `latestByCell`;
  // anything reading raw append-only history would have re-queued cells by coin flip.
  const byId = new Map<string, Observation>();
  for (const o of observations) {
    const prev = byId.get(o.cellId);
    if (!prev || o.capturedAt > prev.capturedAt) byId.set(o.cellId, o);
  }
  for (const c of cells) if (byId.get(c.cellId)?.status === 'error') owed.add(c.cellId);
  return cells
    .filter((c) => owed.has(c.cellId))
    .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1) || a.checkIn.localeCompare(b.checkIn));
}
