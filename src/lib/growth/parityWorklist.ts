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
 * Stable, human-readable, and identical across runs for the same logical cell — so a February run can
 * be diffed against a December one.
 */
export function cellId(
  propertyId: string, checkIn: string, checkOut: string, guests: number, channel: string,
): string {
  return `${propertyId}|${checkIn}|${checkOut}|${guests}|${channel}`;
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
