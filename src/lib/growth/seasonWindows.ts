/**
 * seasonWindows — turn a season's empty calendar into ranked-able CANDIDATES.
 *
 * Pure. Every fact arrives through a lookup the caller supplies, so this module
 * can be unit-tested against a fabricated season with no Firestore and no Meta.
 * The I/O lives in `seasonPack.ts`.
 *
 * ## Why four sources and not just holidays
 *
 * Of the 201 empty nights in the 2026-27 winter, occasion windows cover perhaps
 * 25. A planner that ranks only holidays is quietly answering a different
 * question than the one the owner asked, which is "fill the calendar". So
 * weekends and plain midweek residue are first-class candidates, ranked lower
 * but never invisible.
 *
 * ## The off-by-one this module exists to contain
 *
 * `computeFreeRuns` reports `end` as the LAST FREE NIGHT. `travelWindow` reports
 * `checkOut` as EXCLUSIVE. A candidate therefore fits a run when
 * `checkOut <= addDays(run.end, 1)` — not `checkOut <= run.end`. Two conventions
 * meeting inside one function is exactly where this would silently lose a night.
 *
 * ## The trap with school breaks
 *
 * `travelWindow` must NEVER be fed a `school-break` row. The 2026-27 winter break
 * runs 23 Dec to 10 Jan; its `isOff` walk would return true for all nineteen days
 * and yield one absurd nineteen-night "window". `computeExtendedWindows` filters
 * to `major|minor|bridge-day` for precisely this reason (signals.ts:212);
 * `travelWindow` has no such filter because its caller was assumed to pass
 * official days only. Here, that caller is us.
 */
import { travelWindow, suggestedMinStay, type OfficialDay } from '@/lib/pricing/travelWindow';
import type { SeasonCandidate, SeasonCandidateKind } from './contracts';

/** Holiday types that describe days the country is OFF work, and so make a travel window. */
const OFFICIAL_TYPES = new Set(['major', 'minor', 'bridge-day']);

/** Preference order when two sources propose the same (checkIn, nights). */
const KIND_STRENGTH: Record<SeasonCandidateKind, number> = {
  occasion: 5,
  period: 4,
  'school-break': 3,
  weekend: 2,
  residual: 1,
};

const DAY = 86_400_000;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
export const addDays = (s: string, n: number): string => iso(new Date(d(s).getTime() + n * DAY));
const dayOfWeek = (s: string) => d(s).getUTCDay();
/** A night people pay a weekend rate for: the Friday or Saturday night. */
const isWeekendNight = (s: string) => dayOfWeek(s) === 5 || dayOfWeek(s) === 6;
const daysBetween = (a: string, b: string) => Math.round((d(b).getTime() - d(a).getTime()) / DAY);

export interface FreeRunInput {
  start: string;
  /** The LAST FREE NIGHT, not a checkout date. */
  end: string;
  nights: number;
}

export interface HolidayRow {
  name: string;
  type: string;
  startDate: string;
  /** INCLUSIVE — the last day off. */
  endDate: string;
  /**
   * The seeded caveat, verbatim. It carries things no date can: that `Vacanta
   * mobila` is a three-week window in which each county picks ONE week, not a
   * three-week break. Surfaced on the candidate so a reasoner can see the
   * uncertainty instead of planning six campaigns into it.
   */
  notes?: string;
}

/** One of the owner's pricing periods — a commercial window he already decided on. */
export interface PeriodRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  tier: string;
  minStay: number | null;
}

export interface SeasonWindowsInput {
  season: { start: string; end: string };
  asOf: string;
  freeRuns: FreeRunInput[];
  holidays: HolidayRow[];
  /**
   * The owner's pricing periods. A FIRST-CLASS candidate source, not decoration.
   *
   * Without this, a 25-night block like `Late Fall` (tier min, 10,854 lei of open
   * inventory) is invisible: it decomposes into twenty anonymous three-night
   * "residual" scraps, each worth ~1,200, each ranking below every two-night
   * minor holiday. The owner named that window and priced it; it should compete
   * as the one thing it is.
   */
  periods?: PeriodRow[];
  /** Per-date calendar minimum stay. */
  minStayByDate: (ymd: string) => number;
  /** Asking price for one night, or null when the calendar has no data for it. */
  priceByDate: (ymd: string) => number | null;
  /** A real stay total at base occupancy; null when any night lacks calendar data. */
  quote: (checkIn: string, nights: number) => number | null;
  /** The pricing period owning a date, with its parity verdict. */
  periodByDate: (ymd: string) => { id: string; name: string; verdict: SeasonCandidate['parityVerdict'] } | null;
  /** Whether the gallery can dress a stay starting here, and what is missing if not. */
  creativeFor: (checkIn: string) => { ready: boolean; gaps: string[] };
}

export interface SeasonWindowsResult {
  candidates: SeasonCandidate[];
  /** Proposals that could not become candidates, with a reason. Nothing vanishes silently. */
  skipped: Array<{ checkIn: string; nights: number; kind: SeasonCandidateKind; reason: string }>;
}

/** A proposal before it is measured — just a shape and where it came from. */
interface Proposal {
  checkIn: string;
  nights: number;
  kind: SeasonCandidateKind;
  occasion: SeasonCandidate['occasion'];
  why: string | null;
  bridged: string[];
  departureEvening: boolean;
  /**
   * Value this proposal over a WIDER range than the stay it proposes.
   *
   * A period candidate proposes a representative stay but carries the whole
   * period's open inventory as its value, because that is what the campaign is
   * competing for.
   */
  valueOverride?: { from: string; to: string };
}

/** The free run wholly containing `[checkIn, checkIn+nights)`, or null. */
function runContaining(runs: FreeRunInput[], checkIn: string, nights: number): FreeRunInput | null {
  const checkOut = addDays(checkIn, nights);
  return (
    runs.find((r) => checkIn >= r.start && checkOut <= addDays(r.end, 1)) ?? null
  );
}

/** Expand every official holiday row into individual days, as `travelWindow` expects. */
export function toOfficialDays(holidays: HolidayRow[]): OfficialDay[] {
  const out: OfficialDay[] = [];
  for (const h of holidays) {
    if (!OFFICIAL_TYPES.has(h.type)) continue; // school-break must never reach travelWindow
    for (let cur = h.startDate; cur <= h.endDate; cur = addDays(cur, 1)) {
      out.push({ date: cur, name: h.name });
    }
  }
  return out;
}

/** Occasion windows — the real travel shape around each public holiday. */
function occasionProposals(input: SeasonWindowsInput): Proposal[] {
  const official = toOfficialDays(input.holidays);
  const out: Proposal[] = [];
  for (const h of input.holidays) {
    if (!OFFICIAL_TYPES.has(h.type)) continue;
    if (h.endDate < input.season.start || h.startDate > input.season.end) continue;
    const w = travelWindow(h.startDate, h.endDate, official);
    // A bridged stretch is SHARED: once 28-31 Dec are seeded as bridge days, Craciun,
    // the punte and Anul Nou all return the same 24 Dec -> 3 Jan window. Naming it
    // after whichever holiday happened to be iterated first is misleading — it read
    // "Anul Nou" for a window that is mostly Christmas. Name it after what it spans.
    const spanned = [...new Set(w.spans.map((o) => o.name))].filter((n) => !/^punte/i.test(n));
    const name = spanned.length > 1 ? spanned.join(' + ') : h.name;
    out.push({
      checkIn: w.checkIn,
      nights: Math.max(w.nights, suggestedMinStay(w)),
      kind: 'occasion',
      occasion: { name, type: h.type, startDate: h.startDate, endDate: h.endDate },
      why: w.why,
      bridged: w.bridged,
      departureEvening: w.departureEvening,
    });
  }
  return out;
}

/**
 * School breaks, sliced. A nineteen-night break is not a stay; the weekends
 * inside it and a midweek block are.
 */
function schoolBreakProposals(input: SeasonWindowsInput): Proposal[] {
  const out: Proposal[] = [];
  for (const h of input.holidays) {
    if (h.type !== 'school-break') continue;
    if (h.endDate < input.season.start || h.startDate > input.season.end) continue;
    // A marker row (start === end) is not a break — "first day of school" is a date.
    if (h.startDate === h.endDate) continue;

    const from = h.startDate > input.season.start ? h.startDate : input.season.start;
    const to = h.endDate < input.season.end ? h.endDate : input.season.end;

    // Anchor on the first night inside the break a stay can actually start, but
    // CLAIM the whole break.
    let checkIn: string | null = null;
    let nights = 0;
    for (let cur = from; cur <= to; cur = addDays(cur, 1)) {
      const want = Math.max(input.minStayByDate(cur), 3);
      if (runContaining(input.freeRuns, cur, want)) { checkIn = cur; nights = want; break; }
    }
    if (!checkIn) continue;

    out.push({
      checkIn,
      nights,
      kind: 'school-break',
      occasion: { name: h.name, type: h.type, startDate: h.startDate, endDate: h.endDate },
      why: h.notes?.trim()
        ? `${h.name} (${from} to ${to}). ${h.notes.trim()}`
        : `${h.name} (${from} to ${to}) as one window`,
      bridged: [],
      departureEvening: false,
      // ONE named window, ONE campaign. Slicing a break into every weekend and
      // midweek block inside it funded the same nine autumn nights three times,
      // and put six campaigns on `Vacanta mobila` — a three-week FEREASTRA in which
      // each county picks a single week, so five of those six are certainly wrong.
      valueOverride: { from, to },
    });
  }
  return out;
}

/**
 * One candidate per pricing period — the owner's own commercial window, entire.
 *
 * The stay proposed is the period's own minimum, anchored at its first free night,
 * but the VALUE carried is the whole period's open inventory. That is deliberate:
 * the ad buys attention for the period, and the landing page shows the sellable
 * stays inside it. A campaign for "Late Fall" is one campaign, not twenty.
 */
function periodProposals(input: SeasonWindowsInput): Proposal[] {
  const out: Proposal[] = [];
  for (const p of input.periods ?? []) {
    if (p.endDate < input.season.start || p.startDate > input.season.end) continue;
    const from = p.startDate > input.season.start ? p.startDate : input.season.start;
    const to = p.endDate < input.season.end ? p.endDate : input.season.end;
    // Anchor on the first night inside the period that a stay can actually start.
    let checkIn: string | null = null;
    for (let cur = from; cur <= to; cur = addDays(cur, 1)) {
      const nights = Math.max(p.minStay ?? 2, input.minStayByDate(cur));
      if (runContaining(input.freeRuns, cur, nights)) { checkIn = cur; break; }
    }
    if (!checkIn) continue;
    out.push({
      checkIn,
      nights: Math.max(p.minStay ?? 2, input.minStayByDate(checkIn)),
      kind: 'period',
      occasion: { name: p.name, type: `period:${p.tier}`, startDate: p.startDate, endDate: p.endDate },
      why: `The ${p.name} period (${p.startDate} to ${p.endDate}, tier ${p.tier}) as one commercial window`,
      bridged: [],
      departureEvening: false,
      /** The period's whole open inventory, not just this representative stay. */
      valueOverride: { from, to },
    });
  }
  return out;
}

/** Plain Friday-to-Sunday weekends anywhere in the season. */
function weekendProposals(input: SeasonWindowsInput): Proposal[] {
  const out: Proposal[] = [];
  for (let cur = input.season.start; cur <= input.season.end; cur = addDays(cur, 1)) {
    if (dayOfWeek(cur) !== 5) continue;
    out.push({
      checkIn: cur, nights: 2, kind: 'weekend', occasion: null,
      why: 'Friday-to-Sunday weekend', bridged: [], departureEvening: false,
    });
  }
  return out;
}

/**
 * Residual midweek nights — the leftovers no holiday or weekend claims. Low
 * value individually, and collectively most of an empty winter.
 */
function residualProposals(input: SeasonWindowsInput, claimed: Set<string>): Proposal[] {
  const out: Proposal[] = [];
  for (const run of input.freeRuns) {
    for (let cur = run.start; cur <= run.end; cur = addDays(cur, 1)) {
      if (cur < input.season.start || cur > input.season.end) continue;
      if (dayOfWeek(cur) !== 1) continue; // Monday starts
      const nights = Math.max(input.minStayByDate(cur), 3);
      if (claimed.has(`${cur}_${nights}`)) continue;
      out.push({
        checkIn: cur, nights, kind: 'residual', occasion: null,
        why: 'Midweek nights with no occasion attached', bridged: [], departureEvening: false,
      });
    }
  }
  return out;
}

/** Measure a proposal into a candidate, or explain why it cannot be one. */
function measure(
  p: Proposal,
  input: SeasonWindowsInput
): { candidate: SeasonCandidate } | { reason: string } {
  const minStay = input.minStayByDate(p.checkIn);
  const nights = Math.max(p.nights, minStay);
  const checkOut = addDays(p.checkIn, nights);

  if (p.checkIn < input.season.start || p.checkIn > input.season.end) return { reason: 'outside-season' };
  if (!runContaining(input.freeRuns, p.checkIn, nights)) return { reason: 'nights-not-all-free' };

  const nightDates: string[] = [];
  for (let i = 0; i < nights; i++) nightDates.push(addDays(p.checkIn, i));

  let valueAtRiskRon = 0;
  for (const n of nightDates) {
    const price = input.priceByDate(n);
    if (price == null) return { reason: 'no-calendar-price' };
    valueAtRiskRon += price;
  }

  // A period candidate is valued over its WHOLE open inventory, not just the
  // representative stay — that is the money the campaign is actually competing
  // for. Only free nights count; a sold night is not at risk.
  let openNights = nights;
  if (p.valueOverride) {
    let sum = 0;
    let free = 0;
    for (let cur = p.valueOverride.from; cur <= p.valueOverride.to; cur = addDays(cur, 1)) {
      if (!input.freeRuns.some((r) => cur >= r.start && cur <= r.end)) continue;
      const price = input.priceByDate(cur);
      if (price == null) continue;
      sum += price;
      free += 1;
    }
    if (free > 0) { valueAtRiskRon = sum; openNights = free; }
  }

  const period = input.periodByDate(p.checkIn);
  const creative = input.creativeFor(p.checkIn);

  return {
    candidate: {
      id: `${p.checkIn}_${nights}`,
      checkIn: p.checkIn,
      checkOut,
      nights,
      kind: p.kind,
      occasion: p.occasion,
      why: p.why,
      bridged: p.bridged,
      departureEvening: p.departureEvening,
      minStay,
      priceRon: input.quote(p.checkIn, nights),
      valueAtRiskRon: Math.round(valueAtRiskRon),
      openNights,
      daysOut: daysBetween(input.asOf.slice(0, 10), p.checkIn),
      periodId: period?.id ?? null,
      periodName: period?.name ?? null,
      parityVerdict: period?.verdict ?? 'unmeasured',
      includesWeekendNight: nightDates.some(isWeekendNight),
      // A period claims its whole span; everything else claims only its own stay.
      covers: p.valueOverride ?? { from: p.checkIn, to: addDays(checkOut, -1) },
      creativeReady: creative.ready,
      creativeGaps: creative.gaps,
    },
  };
}

/**
 * Build every candidate stay window in a season, deduped by `(checkIn, nights)`
 * keeping the strongest source.
 */
export function buildSeasonCandidates(input: SeasonWindowsInput): SeasonWindowsResult {
  const proposals = [
    ...occasionProposals(input),
    ...periodProposals(input),
    ...schoolBreakProposals(input),
    ...weekendProposals(input),
  ];
  const claimed = new Set(proposals.map((p) => `${p.checkIn}_${p.nights}`));
  proposals.push(...residualProposals(input, claimed));

  const byId = new Map<string, SeasonCandidate>();
  const kindById = new Map<string, SeasonCandidateKind>();
  const skipped: SeasonWindowsResult['skipped'] = [];

  for (const p of proposals) {
    const r = measure(p, input);
    if ('reason' in r) {
      skipped.push({ checkIn: p.checkIn, nights: p.nights, kind: p.kind, reason: r.reason });
      continue;
    }
    const c = r.candidate;
    const existing = kindById.get(c.id);
    if (existing && KIND_STRENGTH[existing] >= KIND_STRENGTH[c.kind]) continue;
    byId.set(c.id, c);
    kindById.set(c.id, c.kind);
  }

  const candidates = [...byId.values()].sort((a, b) => (a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : a.nights - b.nights));
  return { candidates, skipped };
}
