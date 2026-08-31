/**
 * The year board: one screen's worth of pricing truth, assembled.
 *
 * WHY THIS EXISTS. The admin had four tabs, each shaped like a Firestore collection, and the owner
 * said of them: *"a collection of patches... not a place where I can have a 360 view very fast over my
 * position, not places to act"*. Splitting the answer across tabs is what made it unusable, because
 * the three units never met:
 *
 *   - parity measures a STAY WINDOW ("3 nights for 4 people, 24-27 Dec")
 *   - the calendar sells a NIGHT
 *   - the owner's only lever is a PERIOD (a date range with a tier or a hand-set price)
 *
 * This module puts all three on one spine, so "these dates are wrong" and "here is the control that
 * fixes them" are the same object on the screen.
 *
 * TWO THINGS IT REFUSES TO DO, both learned from the screens it replaces:
 *
 *  1. **Never total only what it can see.** The old Position tab headlined "56,902 lei still unsold"
 *     for a year that actually had 172,770 lei of open nights: 203 of them sat in no period at all
 *     and silently left the sum. Coverage is computed here as a first-class fact, and uncovered
 *     nights are counted, priced and shown as gaps rather than dropped.
 *  2. **Never let two screens disagree.** The noise band lives in one place and every verdict on the
 *     board comes through it, so a +0.4% window cannot read "level" in one panel and "LOSING" in red
 *     in the next.
 *
 * PURE. No clock, no Firestore, no I/O.
 */
import type { PeriodPosition, PeriodVerdict } from '@/lib/parity/pricingPosition';
import {
  solveWeekdayNightlyForStayTotal, suggestLever, stayTotal, nightlyChargeProjected,
  type NightFact, type StayEconomics, type PeriodProposal,
} from './priceProjection';
import type { Tier, TierMultipliers } from './periods';

export interface BoardPeriod extends PeriodPosition {
  tier: Tier;
  fixedNightPrice: number | null;
  flatRate: boolean;
  minStay: number | null;
  /** What to change, and what it would be worth. Null when nothing is wrong or nothing is known. */
  recommendation: Recommendation | null;
}

export interface Recommendation {
  /** Ranked by money, so the list reads as a to-do rather than a report. */
  valueAtRisk: number;
  verdict: PeriodVerdict;
  /** One sentence, in the owner's terms. No jargon, no percentages standing alone. */
  headline: string;
  /**
   * True when hitting the discount target would price below the point where a direct booking beats
   * the platform one. Both numbers are then real and they disagree; the owner decides.
   */
  conflictsWithFloor?: boolean;
  /** The lowest weekday price that keeps every measured stay in this period above its floor. */
  floorWeekday?: number | null;
  /** The weekday nightly price that would put this period where it should be. */
  wantedWeekday: number;
  currentWeekday: number | null;
  /** The control to move: a tier if the ladder can express it, otherwise a hand-set nightly price. */
  lever: { kind: 'tier'; tier: Tier; weekday: number } | { kind: 'fixed'; weekday: number };
  /** Which measured stay drove this, so the owner can check the evidence rather than trust it. */
  evidence: { checkIn: string; checkOut: string; nights: number; guests: number;
              direct: number; bestChannel: string; bestPrice: number; ageDays: number } | null;
}

/** A run of forward nights that belongs to no active period. Priced and sellable, but ungoverned. */
export interface CoverageGap {
  startDate: string;
  endDate: string;
  nights: number;
  openNights: number;
  /** Open nights x current price. Money the old screen did not count. */
  value: number;
  /** True when these nights fall back to the bare base rate, i.e. nothing is deciding their price. */
  atBaseRate: boolean;
}

/**
 * Runs of forward nights covered by no period.
 *
 * Deliberately returns ranges rather than a count: "2027-01-04 to 2027-07-31" is a decision (roll the
 * periods forward), while "203 nights" is a statistic nobody can act on.
 */
export function findCoverageGaps(
  nights: NightFact[],
  periods: Array<{ startDate: string; endDate: string }>,
  basePrice: number,
): CoverageGap[] {
  const covered = new Set<string>();
  for (const p of periods) for (const d of eachDate(p.startDate, p.endDate)) covered.add(d);

  const loose = nights.filter((n) => !covered.has(n.date)).sort((a, b) => a.date.localeCompare(b.date));
  const gaps: CoverageGap[] = [];
  let run: NightFact[] = [];

  const flush = () => {
    if (!run.length) return;
    const open = run.filter((n) => n.available);
    gaps.push({
      startDate: run[0].date,
      endDate: run[run.length - 1].date,
      nights: run.length,
      openNights: open.length,
      value: Math.round(open.reduce((s, n) => s + (n.price ?? 0), 0)),
      atBaseRate: run.every((n) => n.price !== null && Math.abs(n.price - basePrice) < 0.005),
    });
    run = [];
  };

  for (const n of loose) {
    if (run.length && nextDate(run[run.length - 1].date) !== n.date) flush();
    run.push(n);
  }
  flush();
  return gaps;
}

/**
 * What to do about one period, if anything.
 *
 * The recommendation is derived from the WORST measured window, not an average: an average gap over a
 * period hides the stay shape that is actually losing bookings, and the owner prices the period as a
 * whole. Where parity gives a target stay total, this converts it back into the nightly price that
 * produces it, which is the number the owner can actually type.
 */
export function buildRecommendation(
  p: PeriodPosition & { flatRate: boolean },
  periodWindows: Array<{ checkIn: string; checkOut: string; guests: number; floor: number | null }>,
  nightsByWindow: Map<string, NightFact[]>,
  opts: {
    basePrice: number; weekendAdjustment: number; tierMultipliers: TierMultipliers; econ: StayEconomics;
  },
): Recommendation | null {
  const w = p.worstWindow;

  if (p.verdict === 'unmeasured') {
    if (p.openNights === 0) return null;
    return {
      valueAtRisk: p.valueAtRisk, verdict: p.verdict,
      headline: `${p.openNights} nights open and never compared against Airbnb or Booking. You do not know if you are the cheapest place to book these dates.`,
      conflictsWithFloor: false, floorWeekday: null,
      wantedWeekday: p.weekdayPrice ?? 0, currentWeekday: p.weekdayPrice,
      lever: { kind: 'fixed', weekday: Math.round(p.weekdayPrice ?? 0) },
      evidence: null,
    };
  }

  if ((p.verdict !== 'losing' && p.verdict !== 'level' && p.verdict !== 'overshoot') || !w) return null;
  if (!w.targetPrice || !w.direct || !w.bestChannel || !w.bestPrice) return null;

  const nightsForWorst = nightsByWindow.get(`${w.checkIn}|${w.checkOut}|${w.guests}`) ?? [];

  /**
   * Solve the price the SAME WAY the lever will apply it, or the two disagree and the answer is wrong.
   *
   * The first version solved assuming the weekend uplift survives (a tier multiplies weekday and
   * weekend alike) and then, when no tier could express the result, handed back a hand-set price —
   * which compiles to a date override and is FLAT. So the solve assumed Fridays at 1.3x while the
   * lever charged them the weekday rate, and four measured stays landed below their floor while the
   * screen claimed to respect it. `weekendAdjustment: 1` models flat nights, which is what a hand-set
   * price actually does, so each candidate lever is solved under its own semantics.
   */
  const solveUnder = (weekendAdjustment: number) => {
    const atTarget = solveWeekdayNightlyForStayTotal(
      w.targetPrice!, nightsForWorst, w.guests, { flatRate: p.flatRate },
      { weekendAdjustment, econ: opts.econ },
    );
    // The highest floor across EVERY measured window in the period. Fixing only the worst stay
    // over-corrects the rest, so the floor is checked against all of them.
    let floorNightly = 0;
    let floorsChecked = 0;
    for (const pw of periodWindows) {
      if (pw.floor === null) continue;
      const nights = nightsByWindow.get(`${pw.checkIn}|${pw.checkOut}|${pw.guests}`) ?? [];
      if (!nights.length) continue;
      const atFloor = solveWeekdayNightlyForStayTotal(
        pw.floor, nights, pw.guests, { flatRate: p.flatRate },
        { weekendAdjustment, econ: opts.econ },
      );
      if (atFloor !== null) { floorNightly = Math.max(floorNightly, atFloor); floorsChecked++; }
    }
    return { atTarget, floorNightly: floorsChecked ? floorNightly : null };
  };

  // A tier keeps the weekend uplift, so it is solved with it, and preferred when the ladder can reach.
  const tiered = solveUnder(opts.weekendAdjustment);
  if (tiered.atTarget === null) return null;
  const tierLever = suggestLever(tiered.atTarget, { basePrice: opts.basePrice, tierMultipliers: opts.tierMultipliers });

  // A hand-set price is flat, so it is solved flat.
  const solved = tierLever.kind === 'tier' ? tiered : solveUnder(1);
  if (solved.atTarget === null) return null;

  const wanted = solved.atTarget;
  const floorWeekday = solved.floorNightly;

  /**
   * The two rules can genuinely conflict, and when they do the screen must NOT quietly pick one.
   *
   * An earlier version clamped the recommendation up to the floor. On Fall that turned a real answer
   * (473 -> 375, his stated 10% rule) into a 5-lei cut that left him still dearer than Airbnb on most
   * stays: the clamp silently chose "protect the margin" over "win the booking" and then presented the
   * result as the recommendation. Where the target sits BELOW the floor, the platforms in that period
   * are priced low enough that he cannot be 10% cheaper and still be better off taking the booking
   * himself. That is a business decision with two defensible answers, so both prices are carried and
   * the conflict is stated.
   */
  const conflictsWithFloor = floorWeekday !== null && floorWeekday > wanted + 0.005;
  const lever: Recommendation['lever'] = tierLever.kind === 'tier'
    ? tierLever
    : { kind: 'fixed', weekday: Math.round(wanted) };

  const headline =
    p.verdict === 'overshoot'
      ? `You are cheaper than ${w.bestChannel} by so much that you keep less than if they had taken the booking. There is room to charge more.`
      : p.verdict === 'level'
        ? `Your price and ${w.bestChannel} are within 3% of each other, so a guest has no reason to book with you rather than them.`
        : `A guest pays ${Math.round(w.gapPct! * 100)}% more on your site than on ${w.bestChannel}. They book there and you pay the commission.`;

  return {
    valueAtRisk: p.valueAtRisk,
    verdict: p.verdict,
    headline,
    conflictsWithFloor,
    floorWeekday,
    wantedWeekday: wanted,
    currentWeekday: p.weekdayPrice,
    lever,
    evidence: {
      checkIn: w.checkIn ?? '', checkOut: w.checkOut ?? '', nights: w.nights, guests: w.guests,
      direct: Math.round(w.direct), bestChannel: w.bestChannel, bestPrice: Math.round(w.bestPrice),
      ageDays: p.freshestAgeDays ?? 0,
    },
  };
}

/**
 * What a proposal does to the money still on the table for one period, at a glance.
 * Separate from the full preview because the recommendation cards need it without the night-by-night diff.
 */
export function valueDelta(
  nights: NightFact[],
  proposal: PeriodProposal,
  opts: { basePrice: number; weekendAdjustment: number; tierMultipliers: TierMultipliers; econ: StayEconomics },
): { from: number; to: number; delta: number } {
  const open = nights.filter((n) => n.available);
  const from = Math.round(open.reduce((s, n) => s + (n.price ?? 0), 0));
  const to = Math.round(open.reduce(
    (s, n) => s + nightlyChargeProjected(n, opts.econ.baseOccupancy, proposal, opts), 0));
  return { from, to, delta: to - from };
}

/** Sum of one stay at today's prices, for the evidence line. Thin wrapper, kept so callers stay honest. */
export const totalForNights = (charges: number[], econ: StayEconomics) => stayTotal(charges, econ);

export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  while (d <= e) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

export function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
