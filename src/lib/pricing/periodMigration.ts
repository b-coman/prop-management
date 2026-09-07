/**
 * Lift today's production pricing rows into periods — the `migrate` half of `compile ∘ migrate = identity`.
 *
 * Pure: rows in, periods out. Everything here is reversible by construction, because each period keeps
 * the id of the document it came from and the compiler writes back to that same id.
 *
 * What is deliberately NOT migrated: disabled seasons. Two fossils exist in production
 * (`summer-season-2024` ×1.3 "medium", `winter-season-2023` ×1.5 "high") whose multipliers come from
 * the OLD hardcoded ladder {0.7 … 1.5}, not the owner's {0.8 … 1.3}. They are evidence of the
 * dropdown-relink bug, not pricing intent. They stay where they are as `manual` rows, outside the
 * period model, rather than being given a tier that would misrepresent them.
 */
import {
  DEFAULT_TIER_MULTIPLIERS, TIERS, datesInRange, addDaysYmd,
  type PricingPeriod, type Tier, type TierMultipliers,
} from './periods';

export interface LegacySeasonRow {
  id: string;
  propertyId: string;
  name: string;
  seasonType?: string;
  startDate: string;
  endDate: string;
  priceMultiplier: number;
  minimumStay?: number;
  enabled?: boolean;
}

export interface LegacyOverrideRow {
  id: string;
  propertyId: string;
  date: string;
  customPrice: number;
  minimumStay?: number;
  available?: boolean;
  flatRate?: boolean;
  reason?: string;
}

export interface MigrationIssue {
  kind: 'no-matching-tier' | 'skipped-disabled' | 'override-gap';
  message: string;
  ids: string[];
}

export interface PeriodMigrationResult {
  periods: PricingPeriod[];
  issues: MigrationIssue[];
}

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'period';

/** Reverse the ladder: which tier means this multiplier? Exact match only — no nearest-neighbour. */
export function tierForMultiplier(m: number, tiers: TierMultipliers = DEFAULT_TIER_MULTIPLIERS): Tier | null {
  const hit = TIERS.find((t) => Math.abs(tiers[t] - m) < 1e-9);
  return hit ?? null;
}

/**
 * Fixed-price periods must outrank tier periods: a hand-set peak price is the most specific statement
 * the owner can make about a night.
 */
export const FIXED_PRICE_PRIORITY = 100;
export const TIER_PRIORITY = 0;

export function migrateToPeriods(
  propertyId: string,
  seasons: LegacySeasonRow[],
  overrides: LegacyOverrideRow[],
  opts: { tierMultipliers?: TierMultipliers; defaultMinimumStay?: number } = {},
): PeriodMigrationResult {
  const tiers = opts.tierMultipliers ?? DEFAULT_TIER_MULTIPLIERS;
  const periods: PricingPeriod[] = [];
  const issues: MigrationIssue[] = [];

  // ---- seasons ----
  for (const s of seasons.filter((r) => r.propertyId === propertyId)) {
    if (s.enabled === false) {
      issues.push({
        kind: 'skipped-disabled',
        message:
          `Season "${s.name}" (${s.startDate}→${s.endDate}, ×${s.priceMultiplier}) is disabled and was NOT ` +
          'migrated. It stays as a manual row outside the period model.',
        ids: [s.id],
      });
      continue;
    }
    const tier = tierForMultiplier(s.priceMultiplier, tiers);
    if (!tier) {
      issues.push({
        kind: 'no-matching-tier',
        message:
          `Season "${s.name}" has multiplier ×${s.priceMultiplier}, which is not on this property's tier ` +
          `ladder (${TIERS.map((t) => `${t} ×${tiers[t]}`).join(', ')}). Left as a manual row — adjust the ` +
          'ladder or the season, then re-run.',
        ids: [s.id],
      });
      continue;
    }
    const year = Number(s.startDate.slice(0, 4));
    periods.push({
      id: `${propertyId}_${year}_${slugify(s.name)}`,
      propertyId, year, slug: slugify(s.name), name: s.name,
      startDate: s.startDate, endDate: s.endDate,
      tier, priority: TIER_PRIORITY,
      fixedNightPrice: null,
      minStay: s.minimumStay ?? null,
      status: 'active',
      legacySeasonId: s.id,
      legacySeasonType: s.seasonType,
    });
  }

  // ---- overrides: consecutive days sharing a price and reason are ONE period ----
  // This is the step that turns eleven scattered documents back into the four decisions that produced
  // them (Christmas, pre-New-Year, New Year's Eve, post-New-Year).
  const mine = overrides.filter((r) => r.propertyId === propertyId).sort((a, b) => a.date.localeCompare(b.date));
  // NOTE: price is deliberately NOT part of the key.
  //
  // It used to be, and that broke the moment one product carried a price CURVE.
  // The New Year season is six nights at 940/940/2351/2351/940/940 under a single
  // reason; keying on price split it into three runs, two of which produced the
  // SAME id (`..._2026_new-year`, from the same reason and year). They collided,
  // one won, and 2,351 — the most valuable rate on the property — silently became
  // 940 on the round trip.
  //
  // Grouping by the DECISION (reason, minimum, flags) and expressing the price
  // variation as a `nightProfile` is the faithful inverse of what the compiler
  // emits. Where a run's price is constant, this produces exactly what it always
  // did.
  const key = (o: LegacyOverrideRow) =>
    [o.minimumStay ?? '', o.reason ?? '', o.flatRate ?? true, o.available ?? true].join('|');

  let run: LegacyOverrideRow[] = [];
  const flush = () => {
    if (!run.length) return;
    const first = run[0];
    const year = Number(first.date.slice(0, 4));
    const slug = slugify(first.reason || `fixed-${first.customPrice}`);

    // The run's base price is the one most nights carry; every night that differs
    // becomes a profile entry. Constant runs yield no profile at all.
    const tally = new Map<number, number>();
    for (const o of run) tally.set(o.customPrice, (tally.get(o.customPrice) ?? 0) + 1);
    const basePriceForRun = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    const profile = run
      .filter((o) => o.customPrice !== basePriceForRun)
      .map((o) => ({ date: o.date, price: o.customPrice }));

    periods.push({
      id: `${propertyId}_${year}_${slug}`,
      propertyId, year, slug,
      name: first.reason || `Fixed ${first.customPrice}`,
      startDate: first.date,
      endDate: run[run.length - 1].date,
      tier: 'base',                       // inert: fixedNightPrice wins
      priority: FIXED_PRICE_PRIORITY,
      fixedNightPrice: basePriceForRun,
      ...(profile.length ? { nightProfile: profile } : {}),
      minStay: first.minimumStay ?? null,
      status: 'active',
      flatRate: first.flatRate ?? true,
      available: first.available ?? true,
      legacyOverrideIdByDate: Object.fromEntries(run.map((o) => [o.date, o.id])),
    });
    run = [];
  };

  for (const o of mine) {
    const prev = run[run.length - 1];
    if (prev && key(prev) === key(o) && addDaysYmd(prev.date, 1) === o.date) run.push(o);
    else { flush(); run = [o]; }
  }
  flush();

  // A period's range must contain exactly the dates it came from; a gap would mean the compiler
  // invents an override for a date that never had one.
  for (const p of periods.filter((x) => x.fixedNightPrice != null)) {
    const span = datesInRange(p.startDate, p.endDate);
    const known = Object.keys(p.legacyOverrideIdByDate ?? {});
    if (span.length !== known.length) {
      issues.push({
        kind: 'override-gap',
        message: `Fixed-price period "${p.slug}" spans ${span.length} nights but came from ${known.length} overrides.`,
        ids: [p.id],
      });
    }
  }

  return { periods, issues };
}
