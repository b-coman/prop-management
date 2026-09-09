/**
 * seasonAllocator — rank a season's windows, then spread one year's money over them.
 *
 * Pure. Every number a season plan contains is computed here, which is the point:
 * the SKILL that reviews this output is forbidden from doing arithmetic
 * (".claude/skills" house rule — "a single invented figure destroys the owner's
 * trust in everything else you write"), so the arithmetic has to live somewhere
 * testable.
 *
 * ## Who decides what
 *
 * `rankSeasonWindows` produces a baseline order that is already usable on its
 * own. `applyPlannerEdits` lets the skill exclude a window, or shift its
 * emphasis by a NAMED TIER — never by a number. `allocateSeasonBudget` then
 * re-runs the money over whatever order survived. The skill cannot set a budget
 * because `SeasonPlanEdits` has no numeric field to set one in.
 *
 * ## Why an ordinal ladder rather than a weighted score
 *
 * This account has `hasConversionHistory:false` and a single completed campaign.
 * Any expected-value score would be a fabricated conversion rate wearing a
 * number's clothes. Rules with a stated precedence are both more honest and
 * more arguable — and they match `rollUpVerdict`'s taste in
 * `@/lib/parity/pricingPosition`.
 *
 * ## Breadth before depth
 *
 * When the goal is "fill empty nights" and no window has proven ROAS, the season
 * gets COVERAGE before any one window gets depth. Pass 1 funds as many windows
 * as possible at the minimum that can actually deliver; pass 2 tops up in rank
 * order. Spreading 4,000 RON evenly across seven months is ~19 RON/day, below
 * Meta's learning threshold, so the honest output is often to fund four to six
 * windows properly and mark the rest explicitly unfunded.
 */
import type {
  SeasonCandidate,
  SeasonCandidateKind,
  SeasonPhase,
  SeasonPlan,
  SeasonPlanEdits,
  SeasonSlot,
} from './contracts';

const DAY = 86_400_000;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(d(s).getTime() + n * DAY));
const daysBetween = (a: string, b: string) => Math.round((d(b).getTime() - d(a).getTime()) / DAY);

/** Meta's hard per-ad-set daily minimum on this account: RON 4.00 (§9g, err 100/1885272). */
export const AD_SET_DAILY_FLOOR_MINOR = 400;
/** Below this a cold phase has too little runway to build a pool worth retargeting. */
export const MIN_COLD_DAYS = 7;

export interface AllocatorPolicy {
  annualMinor: number;
  reservePct: number;
  minLeadDays: number;
  minViableDailyMinor: number;
  maxDailyBudgetMinor: number;
  absoluteMaxPerCampaignMinor: number;
  /** Never plan to spend more than this share of the money at stake on one window. */
  maxSpendRatioOfValue: number;
  coldStartsDaysBefore: number;
  coldEndsDaysBefore: number;
  retargetEndsDaysBefore: number;
  phaseSplitCold: number;
  /** The account's own lifetime CPC, RON. Null ⇒ fall back to the floor rather than invent one. */
  accountCpc: number | null;
  targetClicksPerDay: number;
  /** False when no custom audience is `deliverable` — then no retarget phase can be planned. */
  retargetPossible: boolean;
  /**
   * What this horizon may spend, from the owner's days-on-air model: horizon length x his daily
   * rate. Null means no pacing (the old behaviour).
   *
   * Without it the allocator spends `ledger.remainingMinor` — the whole YEAR's money — on whatever
   * span it happens to be handed. Asked for a 61-day horizon on 2026-09-09 it proposed 2,423 RON,
   * 89% of everything left for the following twelve months, and stacked five overlapping flights
   * totalling 144 flight-days into those 61 calendar days: about 40 RON/day of real spend against
   * an intended 15.
   */
  paceBudgetMinor: number | null;
}

export const DEFAULT_PHASE_POLICY = {
  coldStartsDaysBefore: 35,
  coldEndsDaysBefore: 10,
  retargetEndsDaysBefore: 3,
  phaseSplitCold: 0.7,
  targetClicksPerDay: 40,
} as const;

export interface RankedWindow {
  candidateId: string;
  tier: 1 | 2 | 3 | 4;
  baselineRank: number;
  rank: number;
  emphasis: 'lead' | 'normal' | 'trailing';
  gated: boolean;
  gatedReason: string | null;
  gatedBy: 'allocator' | 'planner' | null;
  scoreComponents: Array<{ name: string; value: number; note: string }>;
}

export interface LedgerForAllocator {
  remainingMinor: number;
  reserveMinor: number;
  committedMinor: number;
}

const TIER_BY_KIND: Record<SeasonCandidateKind, 1 | 2 | 3 | 4> = {
  occasion: 1,
  period: 2,
  'school-break': 2,
  weekend: 3,
  residual: 4,
};

/** The owner's pricing tier on a period, mapped to the ladder. His judgement, not ours. */
const TIER_BY_PRICE_TIER: Record<string, 1 | 2 | 3 | 4> = {
  max: 1, high: 1, medium: 2, base: 2, low: 3, min: 3,
};

/**
 * The tier a candidate actually earns.
 *
 * Source kind is not enough. The seeded calendar marks Boboteaza and Ziua Unirii
 * `minor` and Craciun `major`, and treating all three as tier 1 put a 1,365 RON
 * two-night minor holiday above a 6,582 RON New Year block in the first real run.
 * A minor holiday is a reason to travel, not a peak — it ranks with the school
 * breaks.
 */
export function tierFor(c: SeasonCandidate): 1 | 2 | 3 | 4 {
  if (c.kind === 'occasion') return c.occasion?.type === 'major' ? 1 : 2;
  // A period carries the owner's own demand judgement in its tier. `Late Fall` is
  // `min` because he considers it quiet; `Vacanta Toamna` is `medium`. Reading it
  // here means the ladder reflects what he already decided rather than a guess
  // about what kind of window it is.
  if (c.kind === 'period') {
    const t = (c.occasion?.type ?? '').replace(/^period:/, '');
    return TIER_BY_PRICE_TIER[t] ?? 3;
  }
  return TIER_BY_KIND[c.kind];
}

export const ALLOCATOR_METHOD: string[] = [
  'Gate first: a window is excluded, with a written reason, before it is ever ranked. Nothing is silently dropped.',
  "parityVerdict 'losing' is a HARD gate: if a guest can beat this price on an OTA, an ad pays to send them to the worse price. Fix the price, do not buy reach.",
  'Rank is an ordinal ladder, never a weighted score: tier (occasion > school-break > weekend > residual), then value at risk descending, then earliest check-in.',
  'The skill may exclude a window or shift its emphasis one tier. It may never set a number.',
  'Money is allocated breadth-first: fund as many windows as possible at the minimum that can actually deliver, then top up in rank order.',
  'The minimum viable daily budget is derived from the account\'s own CPC, not chosen. Lowering it to "cover more windows" buys coverage on paper and delivery nowhere.',
  'Cold runs first and builds the pool; the retarget burst follows it and never runs in parallel. Without a deliverable audience there is no retarget phase at all.',
  'Every phase respects Meta\'s RON 4.00 per-ad-set daily floor. A phase that cannot clear it is dropped rather than planned to fail.',
];

/** The cold-phase window actually available for a candidate, clamped to the present. */
function coldSpan(checkIn: string, asOf: string, policy: AllocatorPolicy) {
  const earliest = addDays(asOf, 1);
  const wanted = addDays(checkIn, -policy.coldStartsDaysBefore);
  const start = wanted > earliest ? wanted : earliest;
  const end = addDays(checkIn, -policy.coldEndsDaysBefore);
  return { start, end, days: daysBetween(start, end) };
}

function retargetSpan(checkIn: string, policy: AllocatorPolicy) {
  const start = addDays(checkIn, -policy.coldEndsDaysBefore);
  const end = addDays(checkIn, -policy.retargetEndsDaysBefore);
  return { start, end, days: daysBetween(start, end) };
}

/** The minimum daily budget that can actually deliver, derived from the account's own CPC. */
export function minViableDailyMinor(policy: AllocatorPolicy): number {
  const fromCpc =
    policy.accountCpc != null && policy.accountCpc > 0
      ? Math.round(policy.targetClicksPerDay * policy.accountCpc * 100)
      : 0;
  return Math.max(policy.minViableDailyMinor, fromCpc);
}

/**
 * Baseline ranking. Gated windows keep a rank of 0 and carry their reason; they
 * are never ordered against the fundable ones.
 */
export function rankSeasonWindows(
  candidates: SeasonCandidate[],
  policy: AllocatorPolicy,
  asOf: string
): RankedWindow[] {
  const rows: RankedWindow[] = candidates.map((c) => {
    const cold = coldSpan(c.checkIn, asOf, policy);
    const tier = tierFor(c);

    let gatedReason: string | null = null;
    if (c.openNights === 0) gatedReason = 'already-sold: no open nights left in this window';
    else if (c.priceRon == null) gatedReason = 'cannot-quote: the calendar has no price for these nights';
    else if (c.parityVerdict === 'losing')
      gatedReason =
        'price-not-reach: this period is losing on parity, so an ad would amplify a price the guest can beat elsewhere';
    else if (c.daysOut < policy.minLeadDays)
      gatedReason = `too-close: ${c.daysOut}d out, under the ${policy.minLeadDays}d minimum lead`;
    else if (cold.days < MIN_COLD_DAYS)
      gatedReason = `no-room-for-cold-phase: only ${cold.days}d of runway before the window opens`;

    return {
      candidateId: c.id,
      tier,
      baselineRank: 0,
      rank: 0,
      emphasis: 'normal' as const,
      gated: gatedReason != null,
      gatedReason,
      gatedBy: gatedReason != null ? ('allocator' as const) : null,
      scoreComponents: [
        { name: 'tier', value: tier, note: `${c.kind} (1 = strongest)` },
        { name: 'valueAtRiskRon', value: c.valueAtRiskRon, note: `${c.openNights} open nights x asking price` },
        { name: 'daysOut', value: c.daysOut, note: 'days from today to check-in' },
        { name: 'coldDays', value: cold.days, note: 'runway available for a cold phase' },
        { name: 'weekendNight', value: c.includesWeekendNight ? 1 : 0, note: 'contains a Fri or Sat night' },
        { name: 'creativeReady', value: c.creativeReady ? 1 : 0, note: c.creativeGaps.join('; ') || 'assets exist for this season' },
      ],
    };
  });

  return orderRows(rows, candidates, true);
}

/** Order the ungated rows by the ladder and assign ranks. */
function orderRows(rows: RankedWindow[], candidates: SeasonCandidate[], setBaseline: boolean): RankedWindow[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const open = rows.filter((r) => !r.gated);
  open.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const ca = byId.get(a.candidateId)!;
    const cb = byId.get(b.candidateId)!;
    if (cb.valueAtRiskRon !== ca.valueAtRiskRon) return cb.valueAtRiskRon - ca.valueAtRiskRon;
    return ca.checkIn < cb.checkIn ? -1 : 1;
  });
  open.forEach((r, i) => {
    r.rank = i + 1;
    if (setBaseline) r.baselineRank = i + 1;
  });
  return rows;
}

/**
 * Apply the skill's three powers. Exclusions become gates attributed to the
 * planner; an emphasis shifts the tier by exactly one step, so the skill's
 * influence is bounded and visible against `baselineRank`.
 */
export function applyPlannerEdits(
  ranked: RankedWindow[],
  candidates: SeasonCandidate[],
  edits: SeasonPlanEdits
): RankedWindow[] {
  const rows = ranked.map((r) => ({ ...r, scoreComponents: [...r.scoreComponents] }));
  const byId = new Map(rows.map((r) => [r.candidateId, r]));

  for (const x of edits.exclude ?? []) {
    const row = byId.get(x.candidateId);
    if (!row || row.gated) continue;
    row.gated = true;
    row.gatedReason = x.reason;
    row.gatedBy = 'planner';
    row.rank = 0;
  }

  for (const e of edits.emphasis ?? []) {
    const row = byId.get(e.candidateId);
    if (!row || row.gated) continue;
    row.emphasis = e.emphasis;
    const shift = e.emphasis === 'lead' ? -1 : e.emphasis === 'trailing' ? 1 : 0;
    row.tier = Math.min(4, Math.max(1, row.tier + shift)) as 1 | 2 | 3 | 4;
    row.scoreComponents.push({
      name: 'plannerEmphasis',
      value: shift,
      note: `${e.emphasis} — ${e.citing}`,
    });
  }

  return orderRows(rows, candidates, false);
}

/** The ceiling for one window: never outspend a share of the money actually at stake. */
export function windowCapMinor(c: SeasonCandidate, policy: AllocatorPolicy): number {
  return Math.min(
    policy.absoluteMaxPerCampaignMinor,
    Math.round(c.valueAtRiskRon * 100 * policy.maxSpendRatioOfValue)
  );
}

export interface FlightShape {
  start: string;
  end: string;
  days: number;
  capMinor: number;
  availableDays: number;
  /** The cold flight's cost at the minimum viable daily budget, bani. */
  minFlightMinor: number;
  /**
   * True when the cold flight was shortened to leave room inside the cap for a
   * retarget burst. False on a window too small to afford both — those get cold
   * only, which is the right trade: without a cold phase there is no pool to
   * retarget in the first place.
   */
  reservesRetarget: boolean;
  viable: boolean;
  reason: string | null;
}

/**
 * How long a cold flight for this window can actually run.
 *
 * A window worth 1,000 RON cannot carry a 25-day flight at the minimum daily
 * budget that delivers — that would be 500 RON against 1,000 RON at stake, three
 * times the 15% rule. The answer is to SHORTEN the flight to fit the value, not
 * to blow through the cap and not to refuse the window outright. It is trimmed
 * from the START, so what survives is the stretch closest to the stay, which is
 * where intent is highest.
 *
 * Only when even a minimum-length flight cannot fit is the window genuinely not
 * worth advertising, and that is said plainly.
 */
export function flightShape(
  c: SeasonCandidate,
  asOf: string,
  policy: AllocatorPolicy,
  daily: number
): FlightShape {
  const avail = coldSpan(c.checkIn, asOf, policy);
  const capMinor = windowCapMinor(c, policy);
  const wantRetarget = policy.retargetPossible && retargetSpan(c.checkIn, policy).days > 0;

  // Prefer a cold flight short enough to leave the retarget burst room inside the
  // cap. If that starves cold below the length that can build a pool, spend the
  // whole cap on cold instead — a retarget phase with nothing to retarget is worse
  // than no retarget phase.
  const withReserve = Math.min(
    avail.days,
    Math.floor(Math.floor(capMinor * policy.phaseSplitCold) / daily)
  );
  const fullCap = Math.min(avail.days, Math.floor(capMinor / daily));

  const reservesRetarget = wantRetarget && withReserve >= MIN_COLD_DAYS;
  const days = reservesRetarget ? withReserve : fullCap;
  const viable = days >= MIN_COLD_DAYS;

  return {
    start: addDays(avail.end, -days),
    end: avail.end,
    days,
    capMinor,
    availableDays: avail.days,
    minFlightMinor: daily * days,
    reservesRetarget,
    viable,
    reason: viable
      ? null
      : avail.days < MIN_COLD_DAYS
        ? `no-room-for-cold-phase: only ${avail.days}d of runway`
        : `value-too-small: ${c.valueAtRiskRon} RON at stake caps spend at ${capMinor / 100} RON, ` +
          `which buys ${days}d at the minimum daily budget that delivers (needs ${MIN_COLD_DAYS}d)`,
  };
}

/**
 * Build the phases for one funded window.
 *
 * Cold gets its minimum viable spend first, because it is what builds the pool.
 * Anything above that goes to the retarget burst, and only then back into cold —
 * a burst that cannot clear Meta's per-ad-set floor is dropped rather than
 * scheduled to under-deliver.
 */
function buildPhases(
  c: SeasonCandidate,
  totalMinor: number,
  shape: FlightShape,
  daily: number,
  policy: AllocatorPolicy
): SeasonPhase[] {
  if (!shape.viable) return [];

  const rt = retargetSpan(c.checkIn, policy);
  const wantRetarget = policy.retargetPossible && rt.days > 0 && shape.reservesRetarget;

  let coldMinor = Math.min(totalMinor, daily * shape.days);
  let rtMinor = 0;

  let spare = totalMinor - coldMinor;
  if (wantRetarget && spare > 0) {
    rtMinor = Math.min(spare, policy.maxDailyBudgetMinor * rt.days);
    spare -= rtMinor;
  }
  if (spare > 0) {
    coldMinor = Math.min(coldMinor + spare, policy.maxDailyBudgetMinor * shape.days);
  }
  if (wantRetarget && rtMinor > 0 && Math.floor(rtMinor / rt.days) < AD_SET_DAILY_FLOOR_MINOR) {
    coldMinor = Math.min(coldMinor + rtMinor, policy.maxDailyBudgetMinor * shape.days);
    rtMinor = 0;
  }

  const phases: SeasonPhase[] = [];

  const coldDaily = Math.min(Math.floor(coldMinor / shape.days), policy.maxDailyBudgetMinor);
  if (coldDaily >= AD_SET_DAILY_FLOOR_MINOR) {
    phases.push({
      kind: 'cold',
      startDate: shape.start,
      endDate: shape.end,
      days: shape.days,
      dailyBudgetMinor: coldDaily,
      budgetMinor: coldDaily * shape.days,
      objective: 'traffic',
      purpose:
        'Reach strangers and fill the pixel. Sells the stay itself — the occasion, the food, the fire.',
    });
  }

  if (rtMinor > 0) {
    const rtDaily = Math.min(Math.floor(rtMinor / rt.days), policy.maxDailyBudgetMinor);
    if (rtDaily >= AD_SET_DAILY_FLOOR_MINOR) {
      phases.push({
        kind: 'retarget',
        startDate: rt.start,
        endDate: rt.end,
        days: rt.days,
        dailyBudgetMinor: rtDaily,
        budgetMinor: rtDaily * rt.days,
        objective: 'traffic',
        purpose:
          'Close the people the cold phase already reached. Answers the objection — price against the OTAs, what is included, what is left — never repeats the fantasy.',
        requires: 'deliverable-custom-audience',
      });
    }
  }

  return phases;
}

export interface AllocationResult {
  slots: SeasonSlot[];
  excluded: SeasonPlan['excluded'];
  method: string[];
  /** Money left unspent after both passes, bani. */
  unallocatedMinor: number;
  warnings: string[];
}

/**
 * Spread the remaining envelope across the ranked windows. Gated windows become
 * `excluded`; everything else becomes a slot, funded or explicitly not, so
 * `slots ∪ excluded` covers every candidate exactly once.
 */
export function allocateSeasonBudget(
  candidates: SeasonCandidate[],
  ranked: RankedWindow[],
  ledger: LedgerForAllocator,
  policy: AllocatorPolicy,
  asOf: string
): AllocationResult {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const warnings: string[] = [];
  const excluded: SeasonPlan['excluded'] = [];

  for (const r of ranked.filter((x) => x.gated)) {
    const c = byId.get(r.candidateId);
    if (!c) continue;
    excluded.push({
      candidateId: c.id,
      checkIn: c.checkIn,
      nights: c.nights,
      reason: r.gatedReason ?? 'gated',
      by: r.gatedBy ?? 'allocator',
    });
  }

  const order = ranked.filter((x) => !x.gated).sort((a, b) => a.rank - b.rank);
  const daily = minViableDailyMinor(policy);
  // The horizon is a rolling window, not a one-shot season: whatever is not spent here is for the
  // next one. So pace against the daily rate as well as the annual envelope, and take the tighter.
  const paced = policy.paceBudgetMinor != null
    ? Math.min(Math.max(0, ledger.remainingMinor), policy.paceBudgetMinor)
    : Math.max(0, ledger.remainingMinor);
  if (policy.paceBudgetMinor != null && policy.paceBudgetMinor < ledger.remainingMinor) {
    warnings.push(
      `pace: this horizon may spend ${policy.paceBudgetMinor} bani (its length at the owner's daily ` +
      `rate), not the ${ledger.remainingMinor} left in the year. The rest is for the horizons after it.`
    );
  }
  let spendable = paced;

  const allocated = new Map<string, number>();
  const shapes = new Map<string, FlightShape>();
  const notes = new Map<string, string>();

  // Pass 1 — COVERAGE. Each window is funded at the minimum that can actually
  // deliver, over a flight already trimmed to fit the value at stake.
  //
  // Candidates OVERLAP by construction: Craciun exists both as its own occasion
  // window and as a slice of the winter school break, and both describe the same
  // nights. Funding both would buy two campaigns for one piece of inventory and
  // set them bidding against each other in the same auction. The higher-ranked
  // one wins the nights; the other is recorded as unfunded, with the reason.
  const fundedStays: Array<{ id: string; from: string; to: string }> = [];
  let exhaustedAt: number | null = null;
  for (const r of order) {
    const c = byId.get(r.candidateId)!;
    const shape = flightShape(c, asOf, policy, daily);
    shapes.set(c.id, shape);

    if (!shape.viable) {
      allocated.set(c.id, 0);
      notes.set(c.id, `unfunded — ${shape.reason}`);
      continue;
    }
    // Judged on what each candidate CLAIMS, not on the representative stay it
    // proposes. A funded period covers every night inside it, so a school-break
    // slice within that period is already paid for.
    const clash = fundedStays.find((f) => c.covers.from <= f.to && f.from <= c.covers.to);
    if (clash) {
      allocated.set(c.id, 0);
      notes.set(c.id, `unfunded — these nights are already covered by ${clash.id}, which ranked higher`);
      continue;
    }
    if (spendable >= shape.minFlightMinor) {
      allocated.set(c.id, shape.minFlightMinor);
      spendable -= shape.minFlightMinor;
      fundedStays.push({ id: c.id, from: c.covers.from, to: c.covers.to });
    } else {
      allocated.set(c.id, 0);
      if (exhaustedAt == null) exhaustedAt = r.rank;
      notes.set(c.id, `unfunded — envelope exhausted at rank ${exhaustedAt}`);
    }
  }

  // Pass 2 — DEPTH, in rank order, bounded by the value actually at stake.
  for (const r of order) {
    if (spendable <= 0) break;
    const c = byId.get(r.candidateId)!;
    const current = allocated.get(c.id) ?? 0;
    if (current === 0) continue;
    const cap = shapes.get(c.id)!.capMinor;
    const topUp = Math.max(0, Math.min(cap - current, spendable));
    if (topUp > 0) {
      allocated.set(c.id, current + topUp);
      spendable -= topUp;
    }
  }

  const slots: SeasonSlot[] = order.map((r) => {
    const c = byId.get(r.candidateId)!;
    const budget = allocated.get(c.id) ?? 0;
    const shape = shapes.get(c.id)!;
    const phases = budget > 0 ? buildPhases(c, budget, shape, daily, policy) : [];
    const phaseTotal = phases.reduce((s, p) => s + p.budgetMinor, 0);
    const funded = phases.length > 0 && phaseTotal > 0;

    if (budget > 0 && !funded) {
      warnings.push(
        `slot:${c.id} — ${budget} bani allocated but no phase cleared Meta's RON 4.00 daily floor; left unfunded.`
      );
    }

    const hardCapMinor = shape.capMinor;

    return {
      candidateId: c.id,
      rank: r.rank,
      baselineRank: r.baselineRank,
      tier: r.tier,
      checkIn: c.checkIn,
      checkOut: c.checkOut,
      nights: c.nights,
      kind: c.kind,
      occasion: c.occasion?.name ?? null,
      valueAtRiskRon: c.valueAtRiskRon,
      priceRon: c.priceRon,
      advisoryBudgetMinor: funded ? phaseTotal : 0,
      hardCapMinor,
      phases,
      funded,
      fundingNote: funded
        ? phaseTotal >= hardCapMinor
          ? 'topped up to cap'
          : shape.days < shape.availableDays
            ? `funded at minimum viable, flight trimmed to ${shape.days}d to stay within 15% of the value at stake`
            : 'funded at minimum viable'
        : (notes.get(c.id) ?? 'unfunded — no phase cleared the daily floor'),
      emphasis: r.emphasis,
      angle: null,
      rationale: null,
      campaignIds: [],
      scoreComponents: r.scoreComponents,
    };
  });

  const fundedCount = slots.filter((s) => s.funded).length;
  if (fundedCount === 0 && slots.length > 0) {
    warnings.push('allocator:nothing-funded — the remaining envelope cannot support a single deliverable flight.');
  }

  return { slots, excluded, method: ALLOCATOR_METHOD, unallocatedMinor: spendable, warnings };
}
