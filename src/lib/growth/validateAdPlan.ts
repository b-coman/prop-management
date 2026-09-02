/**
 * validateAdPlan — the deterministic gate between the ad planner (an LLM) and the ad creative
 * intelligence / console. The AD twin of `validatePlan`: it enforces plan §2 principle 1 ("the
 * LLM narrows, never widens") for the acquisition arm, in CODE. Where `validatePlan` guards a guest
 * list + an offer ceiling, this guards the MONEY + GEO of an `AdBrief`:
 *
 *   1. Narrows-never-widens — every selected city.key must be in the pack's candidate set. The
 *      planner may only pick geo the pack offered; it cannot invent an ad-geolocation key.
 *   2. Budget ceiling — dailyBudgetMinor within (0, maxDailyBudgetMinor]. This mirrors
 *      `adComposer.validateDailyBudget`'s server-side ceiling (B2) at the plan stage, before any
 *      Meta call, so a runaway budget is rejected as a plan, not caught downstream.
 *   3. Spend envelope — a bounded run: dailyBudgetMinor × days-to-end must not exceed the pack's
 *      maxTotalSpendMinor (the plan's budget envelope). The real per-campaign spend cap is set later
 *      at approval (`adExecutionGateway` + `validateApprovalCap`); this is the earlier, plan-level
 *      backstop so an over-budget plan never reaches the creative stage.
 *   4. Sane targeting — a future end time, at least one city, and each radius within Meta's range.
 *
 * Pure — no Firestore, no network, no Meta — so it is exhaustively unit-testable and safe to import
 * from both the eventual in-app ad planner and any CLI harness. The `adExecutionGateway` still
 * re-checks the money gates at activation regardless; this is the campaign-level backstop that stops
 * a bad PLAN from ever being composed into a PAUSED ad.
 */
import type { AdBrief } from './contracts';

/** Meta city-radius bounds (kilometers) — the neutral layer targets in km (§9f). */
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 80; // Meta's ~50-mile city-radius ceiling

/** The subset of the ad-planner pack this validator needs. */
export interface AdPlannerPackForValidation {
  constraints: {
    /** Hard daily ceiling, bani — mirrors `MAX_DAILY_BUDGET_MINOR`. */
    maxDailyBudgetMinor: number;
    /** Optional overall spend envelope for this plan, bani. Null ⇒ no envelope in the pack (warn, don't block). */
    maxTotalSpendMinor: number | null;
  };
  targeting: {
    /** The ad-geolocation city keys the planner may pick from (narrows-never-widens). */
    candidateCityKeys: string[];
    /**
     * The custom audiences the planner may retarget, with Meta's own deliverability verdict.
     *
     * `deliverable` comes from the audience's `delivery_status` (code 200 = ready). It has to be
     * carried IN THE PACK rather than checked here because this validator is pure: Meta reports
     * every audience's approximate size as "1000-1000" regardless of the truth, so delivery_status
     * is the only honest signal and it costs a network call to read.
     */
    candidateAudiences?: Array<{ id: string; name: string; deliverable: boolean }>;
  };
}

export interface AdPlanValidationResult {
  ok: boolean;
  errors: string[];   // hard failures — reject the whole plan (feed back to the planner; bounded repair)
  warnings: string[]; // worth surfacing at review but not blocking
  stats: { dailyBudgetMinor: number; cities: number; audiences: number; daysToEnd: number | null; projectedTotalMinor: number | null };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Validate an ad-planner `AdBrief` against its pack. Errors are written repair-prompt-ready: on
 * failure, feed them back to the planner (bounded to 1–2 retries), then escalate to the human.
 * Never silently drop the offending targeting and proceed — that hides a reasoning defect.
 *
 * `now` is injectable for deterministic tests; it defaults to the wall clock (same discipline as
 * `adComposer.validateApprovalCap`, which reads `Date.now()`).
 */
export function validateAdPlan(
  pack: AdPlannerPackForValidation,
  brief: Pick<AdBrief, 'act' | 'objective' | 'targeting' | 'dailyBudgetMinor' | 'endTime'>,
  now: number = Date.now()
): AdPlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cities = brief.targeting?.cities ?? [];
  const countries = brief.targeting?.countries ?? [];
  const audiences = brief.targeting?.customAudiences ?? [];
  const excluded = brief.targeting?.excludedCustomAudiences ?? [];
  const nothing = (daysToEnd: number | null, projected: number | null): AdPlanValidationResult => ({
    ok: errors.length === 0,
    errors,
    warnings,
    stats: { dailyBudgetMinor: brief.dailyBudgetMinor, cities: cities.length, audiences: audiences.length, daysToEnd, projectedTotalMinor: projected },
  });

  // A plan that declined to act is valid iff it targeted nobody (mirrors validatePlan's act:false rule).
  if (!brief.act) {
    if (cities.length > 0) errors.push(`act:false but ${cities.length} city target(s) selected — a declined plan must target nobody`);
    if (audiences.length > 0) errors.push(`act:false but ${audiences.length} audience(s) selected — a declined plan must target nobody`);
    return nothing(null, null);
  }

  // 1. Objective (2a supports only 'sales').
  if (brief.objective !== 'sales') errors.push(`unsupported objective "${brief.objective}" — only 'sales' is verified`);

  // 2. Budget ceiling.
  const daily = brief.dailyBudgetMinor;
  if (!Number.isFinite(daily) || daily <= 0) {
    errors.push(`invalid daily budget ${daily} — must be a positive number of bani`);
  } else if (daily > pack.constraints.maxDailyBudgetMinor) {
    errors.push(`daily budget ${daily} exceeds the ceiling ${pack.constraints.maxDailyBudgetMinor} (bani)`);
  }

  // 3. End time — must parse and be in the future.
  const endMs = Date.parse(brief.endTime);
  let daysToEnd: number | null = null;
  if (Number.isNaN(endMs)) {
    errors.push(`invalid end time "${brief.endTime}" — must be ISO 8601`);
  } else {
    daysToEnd = Math.ceil((endMs - now) / DAY_MS);
    if (daysToEnd <= 0) errors.push('end time is not in the future — a bounded run needs a future end date');
  }

  // 4. Geo — a target is required, all cities from the candidate set, each with a sane radius.
  //
  // A RETARGETING plan may target a whole country instead of cities: the audience is the real
  // targeting, and pinning website visitors to one city radius silently discards part of the pool
  // the cold flight paid to build. Meta still demands SOME geo, so one of the two must be present.
  if (cities.length === 0 && countries.length === 0) {
    errors.push('no geo targeting — an ad set needs at least one city or country');
  } else if (cities.length === 0 && audiences.length === 0) {
    errors.push('country-level geo with no custom audience — too broad for a prospecting ad set; pick cities or an audience');
  } else if (cities.length > 0) {
    const candidates = new Set(pack.targeting.candidateCityKeys);
    const offList = cities.filter((c) => !candidates.has(c.key)).map((c) => c.key);
    if (offList.length) errors.push(`selected ${offList.length} city key(s) not in the pack's candidates: ${offList.join(', ')}`);
    const badRadius = cities.filter((c) => !Number.isFinite(c.radius) || c.radius < MIN_RADIUS_KM || c.radius > MAX_RADIUS_KM);
    if (badRadius.length) {
      errors.push(`${badRadius.length} city radius/radii out of range [${MIN_RADIUS_KM}, ${MAX_RADIUS_KM}] km: ${badRadius.map((c) => `${c.key}:${c.radius}`).join(', ')}`);
    }
  }

  // 4b. Audiences — narrows-never-widens, and each must actually be able to deliver.
  if (audiences.length || excluded.length) {
    const candidates = pack.targeting.candidateAudiences ?? [];
    if (!candidates.length) {
      errors.push('audience targeting selected but the pack offers no candidate audiences — the planner cannot invent an audience id');
    } else {
      const byId = new Map(candidates.map((a) => [a.id, a]));
      for (const [label, list] of [['targeted', audiences], ['excluded', excluded]] as const) {
        const off = list.filter((a) => !byId.has(a.id));
        if (off.length) {
          errors.push(`${off.length} ${label} audience id(s) not in the pack's candidates: ${off.map((a) => a.id).join(', ')}`);
        }
      }
      // Deliverability applies to TARGETED audiences only. An excluded audience under the floor is
      // harmless — Meta simply subtracts a small set — whereas a targeted one cannot run at all.
      const undeliverable = audiences.filter((a) => byId.get(a.id) && !byId.get(a.id)!.deliverable);
      if (undeliverable.length) {
        errors.push(
          `${undeliverable.length} targeted audience(s) below Meta's delivery floor (~1,000 people): ` +
            undeliverable.map((a) => `${a.name || a.id}`).join(', ') +
            ' — wait for the audience to fill, or target a broader one'
        );
      }
    }
  }

  // 5. Spend envelope — dailyBudget × days must fit the plan's total budget (when the pack sets one).
  let projected: number | null = null;
  if (Number.isFinite(daily) && daily > 0 && daysToEnd && daysToEnd > 0) {
    projected = daily * daysToEnd;
    if (pack.constraints.maxTotalSpendMinor == null) {
      warnings.push(`projected total ~${projected} bani over ${daysToEnd} day(s), but the pack sets no maxTotalSpendMinor envelope — confirm the total manually`);
    } else if (projected > pack.constraints.maxTotalSpendMinor) {
      errors.push(`projected total ${projected} bani (${daily}/day × ${daysToEnd}d) exceeds the plan envelope ${pack.constraints.maxTotalSpendMinor}`);
    }
  }

  return nothing(daysToEnd, projected);
}
