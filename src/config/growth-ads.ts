/**
 * Growth Ad Engine (Meta Ads) runtime configuration & dark-launch flags —
 * Phase 0 (plans §9, §13 H5).
 *
 * Mirrors `src/config/growth-engine.ts`'s two-switch safety model EXACTLY, but
 * for the ads/spend path: everything defaults to OFF / dry-run. The ads engine
 * is inert until `GROWTH_ADS_ENABLED=true` is set at deploy time, and no Meta
 * campaign is ever un-paused until `GROWTH_ADS_MODE=live` is ALSO set. This is
 * the same discipline as the messaging path — a stray env var (or a UI click)
 * alone can never spend real money.
 *
 * Plain module (not `'use server'`) so it can export constants and be
 * imported by both server services and (flag reads only) client code.
 */

export type AdsMode = 'dry-run' | 'live';

/** Master kill switch for the ads engine. Default OFF — requires a deploy-time env var. */
export function isAdsEngineEnabled(): boolean {
  return process.env.GROWTH_ADS_ENABLED === 'true';
}

/**
 * Effective ads mode. Defaults to 'dry-run'. Only resolves to 'live' when BOTH
 * the ads engine is enabled AND `GROWTH_ADS_MODE=live` — two independent
 * switches must be flipped before any Meta campaign can be un-paused.
 */
export function getAdsMode(): AdsMode {
  if (!isAdsEngineEnabled()) return 'dry-run';
  return process.env.GROWTH_ADS_MODE === 'live' ? 'live' : 'dry-run';
}

/**
 * True only when a real (spend-affecting) Meta activation may be performed.
 * `adExecutionGateway.activateCampaign` is a no-op live-action whenever this
 * is false — the money-path gate (Fable H5).
 */
export function isAdsLiveAllowed(): boolean {
  return getAdsMode() === 'live';
}

/**
 * Hard server-side ceiling on daily ad spend, in bani — 200 RON/day (plan
 * REVISIONS B2). This is the REAL gate: `adComposer.validateDailyBudget`
 * enforces it at compose time, and it is meant to be RE-CHECKED at approve
 * time too (Build B) — a compose form's own max-budget field is UX only, not
 * a security boundary, per B2/S1.5 ("form max budget — enforce SERVER-side").
 */
export const MAX_DAILY_BUDGET_MINOR = 20000; // 200 RON/day

/** Getter form, for parity with the other flag readers in this module. */
export function getMaxDailyBudgetMinor(): number {
  return MAX_DAILY_BUDGET_MINOR;
}

// ── Season planning: the ad year and the annual envelope ────────────────────
//
// Everything below is the MONEY POLICY for planning a whole season at once
// (docs/season-ad-planner.md). It lives here, in config, for the same reason
// MAX_DAILY_BUDGET_MINOR does: raising a ceiling should require a deploy, not a
// form field. The per-window slot a season plan proposes is ADVISORY — the
// operator approves or changes it at review — but the ANNUAL envelope below
// bites at approval time (`approveAdAction`), overridable only by an explicit,
// recorded `overrodeAnnualBudget` flag.

/**
 * The DEFAULT annual Meta ad envelope, bani. 4,000 RON — this owner's stated
 * yearly budget for his one property.
 *
 * A second property will not share it. Use `annualBudgetMinorFor(propertyId)`
 * rather than this constant, so a per-property override is a config change and
 * not a code change when that day comes.
 */
export const AD_ANNUAL_BUDGET_MINOR = 400_000;

/**
 * Per-property annual envelopes, bani. A property absent here falls back to the
 * default above — which is correct for a single-property operator and stays
 * correct as the first override is added.
 */
export const AD_ANNUAL_BUDGET_BY_PROPERTY: Record<string, number> = {
  'prahova-mountain-chalet': 400_000,
};

/** The ad-year envelope for one property, bani. */
export function annualBudgetMinorFor(propertyId: string): number {
  return AD_ANNUAL_BUDGET_BY_PROPERTY[propertyId] ?? AD_ANNUAL_BUDGET_MINOR;
}

/**
 * The ad year starts 1 SEPTEMBER, not 1 January (MM-DD).
 *
 * The owner's commercial year turns here: summer ends, the early-autumn period
 * begins, and the Romanian school year restarts. Two practical consequences,
 * both of which a calendar year gets wrong:
 *   1. A winter season (e.g. 2026-10-11 → 2027-04-29) straddles New Year, so a
 *      calendar envelope would split ONE season across TWO budgets and force a
 *      plan to carry two ledgers.
 *   2. The first real flights launched 2026-09-06. A 1 October boundary would
 *      charge them to a prior ad year that has no plan and no envelope.
 */
export const AD_YEAR_START_MONTH_DAY = '09-01';

/**
 * Share of the annual envelope held back from season planning, for the window
 * nobody predicted — a late cancellation re-opening a holiday, a competitor
 * going off sale. A season plan may allocate `annual - committed - reserve`.
 */
export const AD_RESERVE_PCT = 0.2;

/**
 * Floor for a flight's daily budget, bani (20 RON/day).
 *
 * A delivery threshold, but it binds on the OPTIMISATION EVENT, and which event
 * that is changes the answer completely.
 *
 * Meta wants ~50 optimisation events per ad set per week to leave the learning
 * phase. This account has no conversion history, so it optimises for TRAFFIC and
 * the event is a link click. Measured over its whole life: 377.89 RON bought 9,301
 * link clicks, a CPC of 0.041 RON. At 15 RON/day that is ~369 clicks a day, about
 * 2,584 a week — fifty times the threshold.
 *
 * So 20 was far too conservative. The earlier comment here reasoned as if the
 * event were a purchase, where 50 a week really would be out of reach; on traffic
 * it never was. Owner's model, 2026-09-09: think in DAYS ON AIR rather than
 * per-window envelopes — 15 RON/day on a 4,000 RON year is 267 days of running,
 * which is roughly one flight a month, continuously.
 *
 * Meta's own ad-set floor is 4 RON/day, so 15 still leaves real headroom. Do not
 * drop below it without re-checking the CPC: the reasoning is the arithmetic
 * above, not the number.
 */
export const MIN_VIABLE_DAILY_MINOR = 1_500;

/** Days a window needs between planning and check-in for a cold phase to be worth running. */
export const MIN_LEAD_DAYS = 14;

/** Never plan to spend more than this share of the money at stake on one window. */
export const MAX_SPEND_RATIO_OF_VALUE = 0.15;

/**
 * Absolute per-campaign total-spend ceiling, bani. MOVED here from
 * `adPlannerPack.ts`, where it was module-private and therefore unreachable by
 * the season allocator.
 *
 * Its ROLE changed with the season plan: it used to be policy ("no campaign may
 * exceed 500 RON"). Policy now lives in the advisory season slot, which the
 * operator can overrule. This remains only as a TYPO GUARD — the thing that
 * catches 4000 fat-fingered as 40000 — so it sits well above any flight that
 * would really be run.
 */
export const ABSOLUTE_MAX_TOTAL_MINOR = 50_000;

/**
 * The spend envelope for ONE campaign, bani: never plan to outspend the revenue
 * at risk, and never exceed the typo guard.
 *
 * Extracted because this expression was about to exist in three places
 * (`adPlannerPack`, the season allocator, the review screen) and three copies
 * of a money rule drift invisibly — the drift only surfaces as a plan rejected
 * for a reason nobody can reproduce.
 */
export function campaignSpendEnvelopeMinor(valueAtRiskRon: number | null | undefined): number {
  const atRiskMinor =
    valueAtRiskRon != null && valueAtRiskRon > 0 ? Math.round(valueAtRiskRon * 100) : null;
  return atRiskMinor != null ? Math.min(atRiskMinor, ABSOLUTE_MAX_TOTAL_MINOR) : ABSOLUTE_MAX_TOTAL_MINOR;
}

/** One ad year: inclusive `start`/`end` as YYYY-MM-DD, plus a '2026-27' style label. */
export interface AdYear {
  start: string;
  end: string;
  label: string;
}

/** Add whole days to a YYYY-MM-DD string in UTC. String in, string out — never a local Date. */
function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * The ad year containing `date`. Pure, and deliberately string-only: this
 * codebase has repeatedly been bitten by local-time date maths (see the
 * `parseDateLocal` fixes and the DST bug in `getMonthsBetweenDates`), so the
 * boundary is compared as text and advanced in UTC.
 */
export function adYearFor(date: string | Date): AdYear {
  const ymd = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  const year = Number(ymd.slice(0, 4));
  const monthDay = ymd.slice(5, 10);
  const startYear = monthDay >= AD_YEAR_START_MONTH_DAY ? year : year - 1;
  const start = `${startYear}-${AD_YEAR_START_MONTH_DAY}`;
  const end = addDaysYmd(`${startYear + 1}-${AD_YEAR_START_MONTH_DAY}`, -1);
  return { start, end, label: `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}` };
}
