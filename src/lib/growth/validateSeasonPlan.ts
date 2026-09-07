/**
 * validateSeasonPlan — the deterministic gate between the season planner (an LLM
 * plus an allocator) and Firestore.
 *
 * The season twin of `validateAdPlan`. Where that one guards the money and geo of
 * ONE campaign, this guards the shape of a whole season: that the plan spends no
 * more than the year has left, that its phases are arithmetically closed and
 * schedulable, that it never plans two campaigns to compete with each other, and
 * — the rule that catches the quiet failures — that every candidate is accounted
 * for.
 *
 * Pure. No Firestore, no Meta. `scripts/land-season-plan.ts` re-runs it before
 * writing, and additionally re-computes the ledger LIVE, because a plan made on
 * Tuesday against a Wednesday boost is arithmetically valid and financially
 * wrong.
 */
import type { SeasonPlan, SeasonSlot } from './contracts';

export interface SeasonPackForValidation {
  season: { start: string; end: string };
  candidates: Array<{ id: string; checkIn: string; checkOut: string; nights: number }>;
  constraints: {
    annualBudgetMinor: number;
    maxDailyBudgetMinor: number;
    absoluteMaxPerCampaignMinor: number;
    minLeadDays: number;
    adSetDailyFloorMinor: number;
  };
  ledger: { remainingMinor: number; reserveMinor: number; committedMinor: number };
  /** Ids of custom audiences Meta reports as deliverable. Empty ⇒ no retarget phase may be planned. */
  deliverableAudienceIds: string[];
}

export interface SeasonPlanValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    slots: number;
    funded: number;
    unfunded: number;
    excluded: number;
    totalAdvisoryMinor: number;
    remainingAfterMinor: number;
    tiersFunded: number[];
  };
}

const DAY = 86_400_000;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const daysBetween = (a: string, b: string) => Math.round((d(b).getTime() - d(a).getTime()) / DAY);

/** Do two [start, end) ranges overlap? */
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function validateSeasonPlan(
  pack: SeasonPackForValidation,
  plan: Pick<SeasonPlan, 'slots' | 'excluded' | 'season' | 'envelope' | 'asOf'>,
  now?: number
): SeasonPlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const asOfYmd = plan.asOf.slice(0, 10);
  const nowMs = now ?? Date.parse(plan.asOf);

  const candidateById = new Map(pack.candidates.map((c) => [c.id, c]));
  const funded = plan.slots.filter((s) => s.funded);

  // ── 1. narrows-never-widens: a slot may only be a candidate the pack offered,
  //       with the dates the pack measured. A slot that quietly moved its own
  //       dates is the season equivalent of inventing a city key.
  for (const s of plan.slots) {
    const c = candidateById.get(s.candidateId);
    if (!c) {
      errors.push(`slot ${s.candidateId} is not in the pack's candidates — the plan invented a window`);
      continue;
    }
    if (s.checkIn !== c.checkIn || s.checkOut !== c.checkOut || s.nights !== c.nights) {
      errors.push(
        `slot ${s.candidateId} changed its dates: pack has ${c.checkIn}..${c.checkOut} (${c.nights}n), ` +
          `plan has ${s.checkIn}..${s.checkOut} (${s.nights}n)`
      );
    }
  }
  for (const e of plan.excluded) {
    if (!candidateById.has(e.candidateId)) {
      errors.push(`excluded ${e.candidateId} is not in the pack's candidates`);
    }
    if (!e.reason || !e.reason.trim()) {
      errors.push(`excluded ${e.candidateId} carries no reason — an exclusion must say why`);
    }
  }

  // ── 2. coverage: every candidate lands somewhere, exactly once. An un-planned
  //       window must render as un-planned, never as absent (parityWorklist doctrine).
  const seen = new Map<string, number>();
  for (const id of [...plan.slots.map((s) => s.candidateId), ...plan.excluded.map((e) => e.candidateId)]) {
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  for (const c of pack.candidates) {
    const n = seen.get(c.id) ?? 0;
    if (n === 0) errors.push(`candidate ${c.id} appears in neither slots nor excluded — it vanished`);
    else if (n > 1) errors.push(`candidate ${c.id} appears ${n} times — it must appear exactly once`);
  }

  // ── 3. the gate: a plan may not spend more than the year has left.
  const totalAdvisoryMinor = plan.slots.reduce((s, x) => s + x.advisoryBudgetMinor, 0);
  if (totalAdvisoryMinor > pack.ledger.remainingMinor) {
    errors.push(
      `plan allocates ${totalAdvisoryMinor} bani against ${pack.ledger.remainingMinor} remaining in the ad year`
    );
  }
  const spendableFloor = pack.constraints.annualBudgetMinor - pack.ledger.committedMinor - pack.ledger.reserveMinor;
  if (totalAdvisoryMinor > spendableFloor) {
    errors.push(
      `plan allocates ${totalAdvisoryMinor} bani, which breaks into the ${pack.ledger.reserveMinor} bani reserve`
    );
  }

  // ── 4. per-slot ceilings + phase arithmetic.
  for (const s of plan.slots) {
    if (s.advisoryBudgetMinor < 0) errors.push(`slot ${s.candidateId} has a negative budget`);
    if (s.advisoryBudgetMinor > s.hardCapMinor) {
      errors.push(
        `slot ${s.candidateId} allocates ${s.advisoryBudgetMinor} above its own cap ${s.hardCapMinor}`
      );
    }
    if (s.hardCapMinor > pack.constraints.absoluteMaxPerCampaignMinor) {
      errors.push(
        `slot ${s.candidateId} cap ${s.hardCapMinor} exceeds the absolute per-campaign ceiling ` +
          `${pack.constraints.absoluteMaxPerCampaignMinor}`
      );
    }

    const phaseTotal = s.phases.reduce((sum, p) => sum + p.budgetMinor, 0);
    if (phaseTotal !== s.advisoryBudgetMinor) {
      errors.push(
        `slot ${s.candidateId} phases sum to ${phaseTotal} but the slot advises ${s.advisoryBudgetMinor}`
      );
    }

    for (const p of s.phases) {
      if (p.budgetMinor !== p.dailyBudgetMinor * p.days) {
        errors.push(
          `slot ${s.candidateId} ${p.kind} phase: ${p.budgetMinor} != ${p.dailyBudgetMinor} x ${p.days}`
        );
      }
      if (p.dailyBudgetMinor <= 0 || p.dailyBudgetMinor > pack.constraints.maxDailyBudgetMinor) {
        errors.push(
          `slot ${s.candidateId} ${p.kind} phase daily budget ${p.dailyBudgetMinor} is outside ` +
            `(0, ${pack.constraints.maxDailyBudgetMinor}]`
        );
      }
      if (p.dailyBudgetMinor < pack.constraints.adSetDailyFloorMinor) {
        errors.push(
          `slot ${s.candidateId} ${p.kind} phase daily budget ${p.dailyBudgetMinor} is below Meta's ` +
            `per-ad-set floor ${pack.constraints.adSetDailyFloorMinor} — it would not deliver`
        );
      }
      // ── 5. schedulable, and before the stay it sells.
      if (p.endDate >= s.checkIn) {
        errors.push(
          `slot ${s.candidateId} ${p.kind} phase ends ${p.endDate}, on or after check-in ${s.checkIn} — ` +
            'an ad for a stay you can no longer book has a zero ceiling on return'
        );
      }
      if (p.startDate < asOfYmd) {
        errors.push(`slot ${s.candidateId} ${p.kind} phase starts ${p.startDate}, in the past`);
      }
      if (p.days <= 0) errors.push(`slot ${s.candidateId} ${p.kind} phase has ${p.days} days`);
    }

    // ── 6. a retarget burst needs a pool: either a deliverable audience, or a
    //       cold phase in the same slot that will have built one.
    const rt = s.phases.filter((p) => p.kind === 'retarget');
    const hasCold = s.phases.some((p) => p.kind === 'cold');
    if (rt.length > 0 && !hasCold && pack.deliverableAudienceIds.length === 0) {
      errors.push(
        `slot ${s.candidateId} plans a retarget phase with no deliverable audience and no cold phase ` +
          'to build one — it would target an empty pool'
      );
    }
    for (const p of rt) {
      const cold = s.phases.find((x) => x.kind === 'cold');
      if (cold && p.startDate < cold.endDate) {
        errors.push(
          `slot ${s.candidateId} retarget phase starts ${p.startDate}, before the cold phase ends ` +
            `${cold.endDate} — cold builds the pool the burst works`
        );
      }
    }

    if (s.funded && s.phases.length === 0) {
      errors.push(`slot ${s.candidateId} is marked funded but carries no phases`);
    }
    if (!s.funded && s.advisoryBudgetMinor > 0) {
      errors.push(`slot ${s.candidateId} is unfunded but carries ${s.advisoryBudgetMinor} bani`);
    }
  }

  // ── 7. self-competition: two funded slots must not run flights at the same
  //       time for overlapping stays. On Meta your own ad sets bid against each
  //       other, so you pay more and neither leaves the learning phase.
  for (let i = 0; i < funded.length; i++) {
    for (let j = i + 1; j < funded.length; j++) {
      const a = funded[i];
      const b = funded[j];
      const flightsOverlap = a.phases.some((pa) =>
        b.phases.some((pb) => overlaps(pa.startDate, pa.endDate, pb.startDate, pb.endDate))
      );
      if (!flightsOverlap) continue;
      if (overlaps(a.checkIn, a.checkOut, b.checkIn, b.checkOut)) {
        errors.push(
          `slots ${a.candidateId} and ${b.candidateId} run overlapping flights for overlapping stays — ` +
            'they would compete in the same auction for the same nights'
        );
      } else {
        warnings.push(
          `slots ${a.candidateId} and ${b.candidateId} have overlapping flight dates. Geo is not known ` +
            'at season-plan time, so check they do not also share cities when each campaign is generated.'
        );
      }
    }
  }

  // ── warnings: things worth seeing at review, never blocking.
  for (const s of funded) {
    const c = candidateById.get(s.candidateId);
    if (!c) continue;
    const lead = daysBetween(asOfYmd, s.checkIn);
    if (lead < pack.constraints.minLeadDays) {
      warnings.push(`slot ${s.candidateId} is only ${lead}d out, under the ${pack.constraints.minLeadDays}d minimum lead`);
    }
  }
  const unfundedTier1 = plan.slots.filter((s) => !s.funded && s.tier === 1);
  for (const s of unfundedTier1) {
    warnings.push(`tier-1 window ${s.candidateId} (${s.occasion ?? s.checkIn}) is unfunded: ${s.fundingNote}`);
  }
  for (const s of plan.slots) {
    if (s.checkIn < pack.season.start || s.checkIn > pack.season.end) {
      warnings.push(`slot ${s.candidateId} starts outside the planned season ${pack.season.start}..${pack.season.end}`);
    }
  }
  if (funded.length === 0 && plan.slots.length > 0) {
    warnings.push('no window is funded — the plan advertises nothing this season');
  }
  if (!Number.isFinite(nowMs)) warnings.push(`plan.asOf "${plan.asOf}" is not a parseable timestamp`);

  const tiersFunded = [...new Set(funded.map((s: SeasonSlot) => s.tier))].sort();

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      slots: plan.slots.length,
      funded: funded.length,
      unfunded: plan.slots.length - funded.length,
      excluded: plan.excluded.length,
      totalAdvisoryMinor,
      remainingAfterMinor: pack.ledger.remainingMinor - totalAdvisoryMinor,
      tiersFunded,
    },
  };
}
