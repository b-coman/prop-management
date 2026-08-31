/**
 * "What happens to my prices, and to my position, if I change this period?"
 *
 * THE PROBLEM THIS SOLVES: the admin could tell the owner he was 12% dearer than Airbnb, and it could
 * let him change a season multiplier, but nothing connected the two. He had to guess what a new
 * multiplier would do to a guest-facing total, and the only way to find out was to save it and look.
 * On a live production site with no staging, that is not an acceptable way to price.
 *
 * So this module answers, before anything is written: which nights change, from what to what, and
 * where that leaves the verdict against the platforms.
 *
 * THE HONESTY PROPERTY, which is the whole reason this is a separate pure module:
 * `direct` in a parity window is a MEASURED capture of the live site, not a computed number. This
 * module rebuilds that same total from the calendar. If the rebuild does not match the capture, the
 * model is wrong about something and every projection built on it is wrong too. So `modelCheck` rides
 * on every window and the screen refuses to show a projected verdict when it fails. A projection that
 * quietly disagrees with reality is worse than no projection.
 *
 * That check earned its keep immediately: rebuilding from `adjustedPrice` plus an extra-guest fee
 * matched 44 of 56 live captures to the leu and missed all 12 holiday windows above base occupancy,
 * because those nights sell at ONE whole-house price for any party size. The calendar already stores
 * that as a per-occupancy dict, so the totals here read it rather than re-deriving it.
 *
 * PURE. No clock, no Firestore, no I/O.
 */
import type { Tier, TierMultipliers } from './periods';

/** The parts of a stay total the calendar does not already hold. */
export interface StayEconomics {
  baseOccupancy: number;
  extraGuestFee: number;
  cleaningFee: number;
  /** Only `enabled` rows count; the highest threshold at or below the stay length wins. */
  lengthOfStayDiscounts: Array<{ nightsThreshold: number; discountPercentage: number; enabled?: boolean }>;
}

/** One forward night, as `priceCalendars.days[]` holds it. */
export interface NightFact {
  date: string;
  /** `adjustedPrice` — the base-occupancy price. */
  price: number | null;
  /** `prices` — what each party size pays. The engine's own source of truth for occupancy. */
  pricesByGuests: Record<string, number> | null;
  isWeekend: boolean;
  available: boolean;
  /** True when every party size costs the same: a whole-house night that ignores the ladder. */
  flatRate: boolean;
  /** Present when the night is priced by a season or override, for showing WHY it costs what it does. */
  sourceName?: string | null;
}

/** What the owner is proposing for a period. One lever each, mirroring `PricingPeriod`. */
export interface PeriodProposal {
  tier: Tier;
  /** Hand-set nightly price. Wins over the tier, and compiles to a dateOverride. */
  fixedNightPrice: number | null;
  minStay: number | null;
  /** Whole-house pricing: every party size pays the nightly price. */
  flatRate: boolean;
}

/** Derive the flat-rate flag from a stored occupancy dict: every party size at the same price. */
export function isFlatRate(pricesByGuests: Record<string, number> | null | undefined): boolean {
  if (!pricesByGuests) return false;
  const vals = Object.values(pricesByGuests);
  return vals.length > 1 && vals.every((v) => Math.abs(v - vals[0]) < 0.005);
}

/**
 * The nightly price a proposal produces, by the engine's own rule:
 * base x weekendAdjustment x tierMultiplier, or the hand-set price flat.
 *
 * Mirrors `calculateDayPrice` steps 1-3: weekend compounds with the season multiplier, and a date
 * override REPLACES both. `fixedNightPrice` compiles to an override, so it ignores the weekend.
 */
export function projectNightlyPrice(
  night: Pick<NightFact, 'isWeekend'>,
  proposal: PeriodProposal,
  opts: { basePrice: number; weekendAdjustment: number; tierMultipliers: TierMultipliers },
): number {
  if (proposal.fixedNightPrice !== null) return proposal.fixedNightPrice;
  const weekend = night.isWeekend ? opts.weekendAdjustment : 1;
  const tier = opts.tierMultipliers[proposal.tier] ?? 1;
  return round2(opts.basePrice * weekend * tier);
}

/** What a party of `guests` is charged for one night, today. Reads the calendar's own dict first. */
export function nightlyChargeToday(night: NightFact, guests: number, econ: StayEconomics): number | null {
  if (night.pricesByGuests?.[String(guests)] !== undefined) return night.pricesByGuests[String(guests)];
  if (night.price === null) return null;
  return night.price + Math.max(0, guests - econ.baseOccupancy) * econ.extraGuestFee;
}

/** The same, under a proposal. Flat-rate nights charge every party the nightly price. */
export function nightlyChargeProjected(
  night: NightFact,
  guests: number,
  proposal: PeriodProposal,
  opts: { basePrice: number; weekendAdjustment: number; tierMultipliers: TierMultipliers; econ: StayEconomics },
): number {
  const nightly = projectNightlyPrice(night, proposal, opts);
  if (proposal.flatRate) return nightly;
  return nightly + Math.max(0, guests - opts.econ.baseOccupancy) * opts.econ.extraGuestFee;
}

/** The discount tier that applies to a stay of `nights`: the highest threshold at or below it. */
export function lengthOfStayDiscountPct(
  nights: number,
  discounts: StayEconomics['lengthOfStayDiscounts'],
): number {
  const applicable = discounts
    .filter((d) => d.enabled !== false && nights >= d.nightsThreshold)
    .sort((a, b) => b.nightsThreshold - a.nightsThreshold)[0];
  return applicable ? applicable.discountPercentage / 100 : 0;
}

/**
 * The guest-facing total, exactly as `calculateBookingPrice` builds it:
 *
 *   subtotal = SUM of per-night charges + cleaningFee
 *   total    = subtotal x (1 - lengthOfStayDiscount)
 */
export function stayTotal(nightlyCharges: number[], econ: StayEconomics): number {
  const subtotal = nightlyCharges.reduce((s, c) => s + c, 0) + econ.cleaningFee;
  return subtotal * (1 - lengthOfStayDiscountPct(nightlyCharges.length, econ.lengthOfStayDiscounts));
}

export interface WindowProjection {
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  /** The live capture of the direct site. The thing to be believed. */
  measuredDirect: number | null;
  /** The same total, rebuilt from the calendar. Should equal `measuredDirect`. */
  modelledDirect: number | null;
  modelCheck: { ok: boolean; diff: number | null; diffPct: number | null };
  /** The direct total the proposal would produce for this same stay. Null when the model failed. */
  projectedDirect: number | null;
  bestChannel: string | null;
  bestPrice: number | null;
  /** Guest-facing gap: >0 means direct costs the guest MORE than the cheapest platform. */
  currentGapPct: number | null;
  projectedGapPct: number | null;
  /** Below this the owner nets less than letting the OTA have the booking. */
  floor: number | null;
  belowFloor: boolean;
}

/** How far the rebuilt total may sit from the capture before a projection is refused. */
export const MODEL_TOLERANCE_PCT = 0.02;

/** Project one measured parity window onto a proposal. `stayNights` are check-in inclusive, check-out exclusive. */
export function projectWindow(
  w: {
    checkIn: string; checkOut: string; nights: number; guests: number;
    direct: number | null; bestChannel: string | null; bestPrice: number | null; floor: number | null;
  },
  stayNights: NightFact[],
  proposal: PeriodProposal,
  opts: { basePrice: number; weekendAdjustment: number; tierMultipliers: TierMultipliers; econ: StayEconomics },
): WindowProjection {
  const todayCharges = stayNights.map((n) => nightlyChargeToday(n, w.guests, opts.econ));
  const complete = stayNights.length === w.nights && todayCharges.every((c) => c !== null);

  const modelledDirect = complete ? stayTotal(todayCharges as number[], opts.econ) : null;
  const projectedDirect = complete
    ? stayTotal(stayNights.map((n) => nightlyChargeProjected(n, w.guests, proposal, opts)), opts.econ)
    : null;

  const diff = modelledDirect !== null && w.direct !== null ? modelledDirect - w.direct : null;
  const diffPct = diff !== null && w.direct ? diff / w.direct : null;
  const ok = diffPct !== null && Math.abs(diffPct) <= MODEL_TOLERANCE_PCT;

  const gap = (direct: number | null) =>
    direct !== null && w.bestPrice ? (direct - w.bestPrice) / w.bestPrice : null;

  return {
    checkIn: w.checkIn, checkOut: w.checkOut, nights: w.nights, guests: w.guests,
    measuredDirect: w.direct, modelledDirect,
    modelCheck: { ok, diff, diffPct },
    // Only offer a projected number when the model demonstrably reproduces reality.
    projectedDirect: ok ? projectedDirect : null,
    bestChannel: w.bestChannel, bestPrice: w.bestPrice,
    currentGapPct: gap(w.direct),
    projectedGapPct: ok ? gap(projectedDirect) : null,
    floor: w.floor,
    belowFloor: ok && projectedDirect !== null && w.floor !== null && projectedDirect < w.floor,
  };
}

export interface PeriodChangePreview {
  changedNights: Array<{ date: string; from: number | null; to: number; available: boolean }>;
  unchangedNights: number;
  weekday: { from: number | null; to: number | null };
  weekend: { from: number | null; to: number | null };
  /** Open nights x price, before and after: what the change does to the money still on the table. */
  valueAtRisk: { from: number; to: number };
  windows: WindowProjection[];
  /** Worst guest-facing gap across the measured windows, before and after. */
  worstGap: { from: number | null; to: number | null };
  belowFloorWindows: WindowProjection[];
  /** Windows whose rebuild disagreed with the live capture, so they were not projected. */
  unverifiableWindows: WindowProjection[];
}

/** The whole consequence of a proposal for one period: nights moved, money, and resulting verdict. */
export function previewPeriodChange(
  periodNights: NightFact[],
  windows: Parameters<typeof projectWindow>[0][],
  nightsByWindow: Map<string, NightFact[]>,
  proposal: PeriodProposal,
  opts: { basePrice: number; weekendAdjustment: number; tierMultipliers: TierMultipliers; econ: StayEconomics },
): PeriodChangePreview {
  const changedNights: PeriodChangePreview['changedNights'] = [];
  let unchanged = 0;
  for (const n of periodNights) {
    const to = projectNightlyPrice(n, proposal, opts);
    if (n.price !== null && Math.abs(n.price - to) < 0.005) unchanged++;
    else changedNights.push({ date: n.date, from: n.price, to, available: n.available });
  }

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const wd = periodNights.filter((n) => !n.isWeekend);
  const we = periodNights.filter((n) => n.isWeekend);
  const open = periodNights.filter((n) => n.available);

  const projections = windows.map((w) =>
    projectWindow(w, nightsByWindow.get(windowKey(w)) ?? [], proposal, opts));

  const worst = (pick: (p: WindowProjection) => number | null) => {
    const vals = projections.map(pick).filter((v): v is number => v !== null);
    return vals.length ? Math.max(...vals) : null;
  };

  return {
    changedNights,
    unchangedNights: unchanged,
    weekday: { from: avg(wd.map((n) => n.price).filter((p): p is number => p !== null)),
               to: avg(wd.map((n) => projectNightlyPrice(n, proposal, opts))) },
    weekend: { from: avg(we.map((n) => n.price).filter((p): p is number => p !== null)),
               to: avg(we.map((n) => projectNightlyPrice(n, proposal, opts))) },
    valueAtRisk: {
      from: Math.round(open.reduce((s, n) => s + (n.price ?? 0), 0)),
      to: Math.round(open.reduce((s, n) => s + projectNightlyPrice(n, proposal, opts), 0)),
    },
    windows: projections,
    worstGap: { from: worst((p) => p.currentGapPct), to: worst((p) => p.projectedGapPct) },
    belowFloorWindows: projections.filter((p) => p.belowFloor),
    unverifiableWindows: projections.filter((p) => p.measuredDirect !== null && !p.modelCheck.ok),
  };
}

export const windowKey = (w: { checkIn: string; checkOut: string; guests: number }) =>
  `${w.checkIn}|${w.checkOut}|${w.guests}`;

/**
 * Work backwards from a wanted STAY total to the nightly price that produces it.
 *
 * Parity states its answer as a stay total ("a 6-night stay should be 2275"), because that is what a
 * guest compares. The owner's lever is a nightly rate. Nothing in the old admin bridged those two, so
 * every recommendation ended in arithmetic the owner had to do himself.
 *
 * Solved numerically rather than algebraically on purpose: the total is piecewise (length-of-stay
 * tiers, flat-rate nights, an additive extra-guest fee, weekend compounding), and a closed form would
 * have to duplicate all of it and then drift from the engine. The total is monotonic in the base, so
 * a bisection is exact to the leu in ~40 steps and stays correct when the engine's rules change.
 */
export function solveWeekdayNightlyForStayTotal(
  wantedTotal: number,
  stayNights: NightFact[],
  guests: number,
  proposal: { flatRate: boolean },
  opts: { weekendAdjustment: number; econ: StayEconomics },
  bounds: { lo?: number; hi?: number } = {},
): number | null {
  if (!stayNights.length || wantedTotal <= 0) return null;
  // A unit multiplier, so the value being solved for IS the weekday nightly price the owner sets.
  const UNIT: TierMultipliers = { min: 1, low: 1, base: 1, medium: 1, high: 1, max: 1 };
  const totalAt = (weekday: number) =>
    stayTotal(
      stayNights.map((n) => nightlyChargeProjected(n, guests,
        { tier: 'base', fixedNightPrice: null, minStay: null, flatRate: proposal.flatRate },
        { basePrice: weekday, weekendAdjustment: opts.weekendAdjustment, tierMultipliers: UNIT, econ: opts.econ })),
      opts.econ,
    );

  let lo = bounds.lo ?? 1;
  let hi = bounds.hi ?? 100000;
  if (totalAt(lo) > wantedTotal || totalAt(hi) < wantedTotal) return null;
  for (let i = 0; i < 60 && hi - lo > 0.005; i++) {
    const mid = (lo + hi) / 2;
    if (totalAt(mid) < wantedTotal) lo = mid; else hi = mid;
  }
  return round2((lo + hi) / 2);
}

/**
 * The nightly price at which the WORST measured stay in a period reaches a wanted discount.
 *
 * THE BUG THIS REPLACES. The first version solved one stay in isolation: it took the window with
 * today's biggest gap and found the price that put THAT stay 10% under its cheapest platform. But the
 * ranking is not fixed - it moves as the price moves. Every stay has its own length-of-stay discount,
 * its own extra-guest fee and its own OTA price, so lowering the nightly rate closes the gaps at
 * different speeds and a different stay ends up worst. On Fall it recommended 413, which put the stay
 * it was solving for at -10% and left the new worst stay at -0.7%: a recommendation that did not
 * achieve the thing it was recommended for. Reaching "at least 10% under on every stay" needs 349.
 *
 * So the target is a property of the SET, not of one member. `worstGap` is monotonic in price (every
 * stay total rises with the nightly rate), so one bisection over the whole set finds it exactly.
 *
 * Returns null when no price in range achieves it, which is a real answer and must not be faked.
 */
export function solveFlatPriceForWorstGap(
  targetGapPct: number,
  stays: Array<{ nights: NightFact[]; guests: number; bestPrice: number }>,
  proposal: { flatRate: boolean },
  opts: { weekendAdjustment: number; econ: StayEconomics },
  bounds: { lo?: number; hi?: number } = {},
): number | null {
  const usable = stays.filter((s) => s.nights.length > 0 && s.bestPrice > 0);
  if (!usable.length) return null;

  const UNIT: TierMultipliers = { min: 1, low: 1, base: 1, medium: 1, high: 1, max: 1 };
  const worstGapAt = (weekday: number) => Math.max(...usable.map((s) => {
    const total = stayTotal(
      s.nights.map((n) => nightlyChargeProjected(n, s.guests,
        { tier: 'base', fixedNightPrice: null, minStay: null, flatRate: proposal.flatRate },
        { basePrice: weekday, weekendAdjustment: opts.weekendAdjustment, tierMultipliers: UNIT, econ: opts.econ })),
      opts.econ,
    );
    return (total - s.bestPrice) / s.bestPrice;
  }));

  let lo = bounds.lo ?? 1;
  let hi = bounds.hi ?? 100000;
  if (worstGapAt(lo) > targetGapPct || worstGapAt(hi) < targetGapPct) return null;
  for (let i = 0; i < 60 && hi - lo > 0.005; i++) {
    const mid = (lo + hi) / 2;
    if (worstGapAt(mid) < targetGapPct) lo = mid; else hi = mid;
  }
  return round2((lo + hi) / 2);
}

/** Where every measured stay lands at a given nightly price. The spread is the answer, not one number. */
export function spreadAt(
  weekday: number,
  stays: Array<{ nights: NightFact[]; guests: number; bestPrice: number; floor: number | null }>,
  proposal: { flatRate: boolean },
  opts: { weekendAdjustment: number; econ: StayEconomics },
): { gaps: number[]; worst: number | null; deepest: number | null; dearer: number; belowFloor: number } {
  const UNIT: TierMultipliers = { min: 1, low: 1, base: 1, medium: 1, high: 1, max: 1 };
  const gaps: number[] = [];
  let belowFloor = 0;
  for (const s of stays) {
    if (!s.nights.length || !s.bestPrice) continue;
    const total = stayTotal(
      s.nights.map((n) => nightlyChargeProjected(n, s.guests,
        { tier: 'base', fixedNightPrice: null, minStay: null, flatRate: proposal.flatRate },
        { basePrice: weekday, weekendAdjustment: opts.weekendAdjustment, tierMultipliers: UNIT, econ: opts.econ })),
      opts.econ,
    );
    gaps.push((total - s.bestPrice) / s.bestPrice);
    if (s.floor !== null && total < s.floor) belowFloor++;
  }
  gaps.sort((a, b) => b - a);
  return {
    gaps,
    worst: gaps.length ? gaps[0] : null,
    deepest: gaps.length ? gaps[gaps.length - 1] : null,
    dearer: gaps.filter((g) => g > 0).length,
    belowFloor,
  };
}

/**
 * The cheapest lever that reaches a wanted nightly price.
 *
 * The tier ladder is coarse (0.8 to 1.3 of base), so it often cannot express the price parity asks
 * for. Saying so is the point: the answer is either "click this tier" or "the ladder cannot do this,
 * set the night by hand", and the owner should not have to work out which.
 */
export function suggestLever(
  wantedWeekday: number,
  opts: { basePrice: number; tierMultipliers: TierMultipliers; tolerancePct?: number },
): { kind: 'tier'; tier: Tier; weekday: number } | { kind: 'fixed'; weekday: number } {
  const tol = opts.tolerancePct ?? 0.02;
  const best = (Object.entries(opts.tierMultipliers) as Array<[Tier, number]>)
    .map(([tier, m]) => ({ tier, weekday: round2(opts.basePrice * m) }))
    .sort((a, b) => Math.abs(a.weekday - wantedWeekday) - Math.abs(b.weekday - wantedWeekday))[0];
  if (best && wantedWeekday > 0 && Math.abs(best.weekday - wantedWeekday) / wantedWeekday <= tol) {
    return { kind: 'tier', tier: best.tier, weekday: best.weekday };
  }
  return { kind: 'fixed', weekday: Math.round(wantedWeekday) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
