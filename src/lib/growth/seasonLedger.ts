/**
 * seasonLedger — how much of the ad year's envelope is already spoken for.
 *
 * Pure. No Firestore, no Meta. The I/O lives in
 * `src/services/growth/metaAds/accountSpend.ts`; this module only does the
 * arithmetic, so it is exhaustively unit-testable and the numbers a season plan
 * is built on can be reproduced without a network.
 *
 * Two design facts worth stating up front, because both were bugs waiting to
 * happen:
 *
 * 1. **Spend is read at ACCOUNT level, never by summing our own campaign docs.**
 *    The owner boosts page posts by hand in Ads Manager — the "Vine toamna"
 *    post spent 23.72 RON that way — and those boosts never produce an
 *    `adCampaigns` doc. A ledger built from our own records would overstate the
 *    remaining budget by exactly the amount he spends outside the system, which
 *    is the one error a budget ledger must not make. Our docs are used only to
 *    SUBTRACT (`spentTrackedMinor`) and to project forward
 *    (`reservedInFlightMinor`).
 *
 * 2. **Actuals are not commitments.** An active campaign with 12 days left at
 *    30 RON/day has spent something and *will spend 360 RON more*. Counting only
 *    what Meta has already billed makes "remaining" look better than it is,
 *    every single day, right up until the money is gone. `reservedInFlightMinor`
 *    is that forward commitment.
 */
import type { AdYear } from '@/config/growth-ads';

/** Default staleness threshold for a cached account-spend read. */
export const LEDGER_MAX_AGE_HOURS = 24;

export interface AccountSpendForLedger {
  /** Account-level total for the ad year to date, bani. ALL campaigns, incl. manual boosts. */
  spendMinor: number;
  /** Per-campaign breakdown, so the unplanned part can be named rather than guessed. */
  byCampaign: Array<{ campaignId: string; name: string; spendMinor: number }>;
  /** ISO timestamp of the read. */
  fetchedAt: string;
}

export interface SeasonLedgerInput {
  adYear: AdYear;
  annualMinor: number;
  reservePct: number;
  /** Null when Meta could not be read — the ledger then reports `available:false` rather than zeros. */
  accountSpend: AccountSpendForLedger | null;
  /** `metaCampaignId`s of campaigns this system created, to split tracked from unplanned spend. */
  trackedMetaCampaignIds: string[];
  /** Forward commitment on approved/active campaigns, bani (from `inFlight`). */
  reservedInFlightMinor: number;
  /** Owner-entered: boosts paid on a personal card / another ad account. Invisible to us otherwise. */
  spentOffAccountMinor?: number;
  /** What the plan under consideration proposes for windows not yet launched, bani. */
  plannedMinor?: number;
  /** ISO timestamp the ledger is computed for. */
  asOf: string;
  maxAgeHours?: number;
  adAccountId?: string;
}

export interface SeasonLedger {
  available: boolean;
  adYear: AdYear;
  annualMinor: number;
  reserveMinor: number;
  spentMinor: number;
  spentTrackedMinor: number;
  spentUnplannedMinor: number;
  spentOffAccountMinor: number;
  reservedInFlightMinor: number;
  plannedMinor: number;
  committedMinor: number;
  remainingMinor: number;
  /** remaining - planned. Negative ⇒ the plan overspends the year. */
  uncommittedAfterPlanMinor: number;
  freshness: { fetchedAt: string | null; ageHours: number | null; stale: boolean };
  coverage: { adAccountId: string | null; note: string };
  warnings: string[];
  note: string;
}

const HOUR_MS = 60 * 60 * 1000;

const COVERAGE_NOTE =
  'Covers everything billed to this ad account, including boosts made by hand in Ads Manager. It ' +
  'CANNOT see a boost paid with a personal card against a different ad account — record those in ' +
  'spentOffAccountMinor rather than assuming the total is complete.';

const NOTE =
  'committed = account spend + off-account spend + forward commitment on live campaigns. ' +
  'remaining = annual - committed - reserve. Meta restates spend for roughly 48h, so figures ' +
  'inside that window are provisional. Every amount here is in BANI (minor units).';

/**
 * Compute the ad-year ledger. Never throws and never clamps `remainingMinor`:
 * a negative remaining is a true and important state, not an error to hide.
 */
export function computeSeasonLedger(input: SeasonLedgerInput): SeasonLedger {
  const warnings: string[] = [];
  const maxAgeHours = input.maxAgeHours ?? LEDGER_MAX_AGE_HOURS;
  const spentOffAccountMinor = Math.max(0, Math.round(input.spentOffAccountMinor ?? 0));
  const plannedMinor = Math.max(0, Math.round(input.plannedMinor ?? 0));
  const reservedInFlightMinor = Math.max(0, Math.round(input.reservedInFlightMinor));
  const reserveMinor = Math.round(input.annualMinor * input.reservePct);

  const available = input.accountSpend != null;
  const spentMinor = input.accountSpend ? Math.max(0, Math.round(input.accountSpend.spendMinor)) : 0;

  const tracked = new Set(input.trackedMetaCampaignIds);
  const trackedRaw = (input.accountSpend?.byCampaign ?? [])
    .filter((r) => tracked.has(r.campaignId))
    .reduce((sum, r) => sum + Math.max(0, Math.round(r.spendMinor)), 0);
  const spentTrackedMinor = Math.min(trackedRaw, spentMinor);

  const unplannedRaw = spentMinor - spentTrackedMinor;
  const spentUnplannedMinor = Math.max(0, unplannedRaw);
  if (unplannedRaw < 0) {
    warnings.push(
      'ledger:unplanned-clamped — tracked campaign spend exceeded the account total, which should be ' +
        'impossible; the breakdown and the total disagree (check the RON-vs-bani conversion).'
    );
  }

  let ageHours: number | null = null;
  let stale = false;
  const fetchedAt = input.accountSpend?.fetchedAt ?? null;
  if (fetchedAt) {
    const delta = Date.parse(input.asOf) - Date.parse(fetchedAt);
    if (Number.isFinite(delta)) {
      ageHours = Math.max(0, Math.round((delta / HOUR_MS) * 10) / 10);
      stale = ageHours > maxAgeHours;
    }
  }

  if (!available) {
    warnings.push(
      'ledger:unavailable — Meta account spend could not be read, so every figure below except the ' +
        'annual envelope is unknown. Do NOT plan money against this ledger.'
    );
  } else if (stale) {
    warnings.push(`ledger:stale — account spend is ${ageHours}h old (threshold ${maxAgeHours}h).`);
  }

  const committedMinor = spentMinor + spentOffAccountMinor + reservedInFlightMinor;
  const remainingMinor = input.annualMinor - committedMinor - reserveMinor;
  const uncommittedAfterPlanMinor = remainingMinor - plannedMinor;

  if (remainingMinor < 0) {
    warnings.push(
      `ledger:over-envelope — committed (${committedMinor}) plus reserve (${reserveMinor}) already ` +
        `exceeds the annual envelope (${input.annualMinor}).`
    );
  }
  if (uncommittedAfterPlanMinor < 0) {
    warnings.push(
      `ledger:plan-overspends — the plan proposes ${plannedMinor} against ${remainingMinor} remaining.`
    );
  }
  if (spentUnplannedMinor > 0) {
    warnings.push(
      `ledger:unplanned-spend — ${spentUnplannedMinor} bani was spent on campaigns this system did ` +
        'not create (hand-made boosts). It counts against the envelope.'
    );
  }

  return {
    available,
    adYear: input.adYear,
    annualMinor: input.annualMinor,
    reserveMinor,
    spentMinor,
    spentTrackedMinor,
    spentUnplannedMinor,
    spentOffAccountMinor,
    reservedInFlightMinor,
    plannedMinor,
    committedMinor,
    remainingMinor,
    uncommittedAfterPlanMinor,
    freshness: { fetchedAt, ageHours, stale },
    coverage: { adAccountId: input.adAccountId ?? null, note: COVERAGE_NOTE },
    warnings,
    note: NOTE,
  };
}
