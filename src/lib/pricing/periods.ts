/**
 * The Period — pricing INTENT, and the compiler that turns it into what the engine already eats.
 *
 * THE PROBLEM: this system has a pricing engine but no pricing model. `calculateDayPrice()` turns
 * rules into a night's price correctly, but nothing owns the rules. The 2026 seasons were written by a
 * script that ran once and cannot be re-run; because nothing owns them, nothing can project them onto
 * the other channels, nothing can reason about them, nothing notices when they drift — and 2027 has no
 * prices at all, because nobody re-ran the script. The owner's real model (one base rate, a demand tier
 * per period, per-channel gross-ups, direct slightly under) lives in a spreadsheet.
 *
 * THE GOVERNING RULE: the guest-facing engine is frozen. This compiles DOWN into `seasonalPricing` and
 * `dateOverrides`, exactly the relationship `priceCalendars` already has to those collections. Nothing
 * in the booking flow learns that periods exist, so there is no guest-facing risk — and it buys a
 * decisive acceptance test: `compile ∘ migrate = identity`.
 *
 * This module is PURE. No clock, no Firestore, no I/O — so overlap semantics become unit-testable,
 * which is the whole point: `findMatchingSeason` resolves overlaps by highest-multiplier, which is not
 * a decision anyone made. The compiler emits a FLATTENED, non-overlapping season set, so the engine
 * never sees two candidates and that latent bug can never fire.
 */

/** The owner's real demand ladder. Six tiers, not the engine's deleted five. */
export type Tier = 'min' | 'low' | 'base' | 'medium' | 'high' | 'max';

export const TIERS: Tier[] = ['min', 'low', 'base', 'medium', 'high', 'max'];

export type TierMultipliers = Record<Tier, number>;

/**
 * Defaults matching what the owner actually uses in production (verified against the 13 live 2026
 * seasons: minimum ×0.8, low ×0.9, medium ×1.1, high ×1.2). Overridable per property via
 * `property.pricingConfig.tierMultipliers` — the ladder is DATA, not code. The engine's old hardcoded
 * `SEASON_MULTIPLIERS` {0.7 … 1.5} was a different ladder entirely, which is why re-labelling a season
 * from the dropdown silently repriced it.
 */
export const DEFAULT_TIER_MULTIPLIERS: TierMultipliers = {
  min: 0.8, low: 0.9, base: 1.0, medium: 1.1, high: 1.2, max: 1.3,
};

/**
 * `seasonType` is a label the engine never reads — `calculateDayPrice` uses only `priceMultiplier`,
 * dates, `minimumStay` and `enabled`. It is mapped here purely so migrated rows round-trip unchanged.
 */
const TIER_TO_SEASON_TYPE: Record<Tier, string> = {
  min: 'minimum', low: 'low', base: 'standard', medium: 'medium', high: 'high', max: 'high',
};

export interface PricingPeriod {
  id: string;
  propertyId: string;
  year: number;
  slug: string;
  name: string;
  startDate: string;  // YYYY-MM-DD, inclusive
  endDate: string;    // YYYY-MM-DD, inclusive
  tier: Tier;
  /** Higher wins where periods overlap. Explicit, because the engine's implicit rule is a bug. */
  priority: number;
  /** Hand-set nightly price. Wins over the tier, and compiles to dateOverrides. */
  fixedNightPrice: number | null;
  minStay: number | null;
  status: 'draft' | 'active' | 'archived';
  /** Flat rate ignores the occupancy ladder — what a hand-set peak price means. */
  flatRate?: boolean;
  available?: boolean;
  /** Holiday doc ids. A REFERENCE for rolling the period forward; never a price input. */
  holidayRefs?: string[];
  /**
   * The season document this period was migrated FROM. `priceCalendars.days[].seasonId` stores the
   * source doc id, so reusing it is what makes `compile ∘ migrate` byte-identical rather than merely
   * equivalent. Without this, every day of every calendar changes id and the proof is worthless.
   */
  legacySeasonId?: string;
  /** Same, per date, for hand-set prices that were already dateOverride documents. */
  legacyOverrideIdByDate?: Record<string, string>;
  legacySeasonType?: string;
}

export interface Provenance {
  source: 'period-compiler' | 'proposal' | 'manual';
  periodId?: string;
  compiledAt?: string;
}

export interface CompiledSeason {
  id: string;
  propertyId: string;
  name: string;
  seasonType: string;
  startDate: string;
  endDate: string;
  priceMultiplier: number;
  minimumStay: number;
  enabled: boolean;
  provenance: Provenance;
}

export interface CompiledOverride {
  id: string;
  propertyId: string;
  date: string;
  customPrice: number;
  minimumStay: number;
  available: boolean;
  flatRate: boolean;
  reason: string;
  provenance: Provenance;
}

export interface CompileWarning {
  kind: 'overlap-same-priority' | 'invalid-range' | 'unknown-tier' | 'split-loses-legacy-id';
  message: string;
  periodIds: string[];
  dates?: string[];
}

export interface CompileResult {
  seasons: CompiledSeason[];
  overrides: CompiledOverride[];
  warnings: CompileWarning[];
  /** Every date covered by at least one active period — the compiler's footprint. */
  coveredDates: string[];
}

// ---- date helpers. String in, string out, UTC throughout ----------------------------------------
// The codebase has a history of off-by-one bugs from `new Date("YYYY-MM-DD")` (parsed as UTC) being
// compared against local Date objects. Nothing here ever leaves UTC.

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysYmd(s: string, n: number): string {
  const d = parseYmd(s);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

/** Inclusive range, as YYYY-MM-DD strings. */
export function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  if (start > end) return out;
  for (let s = start; s <= end; s = addDaysYmd(s, 1)) out.push(s);
  return out;
}

// ---- the compiler --------------------------------------------------------------------------------

/**
 * Resolve overlaps to exactly one winner per day, then regroup into contiguous segments.
 *
 * Ties on priority are a genuine ambiguity, so they are WARNED about rather than silently resolved.
 * The deterministic fallback (later start, then id) exists only so the output is stable and reviewable
 * — it is not a claim about what the owner meant.
 */
function winnersByDate(
  periods: PricingPeriod[],
  warnings: CompileWarning[],
): Map<string, PricingPeriod> {
  const byDate = new Map<string, PricingPeriod[]>();

  for (const p of periods) {
    if (p.startDate > p.endDate) {
      warnings.push({
        kind: 'invalid-range',
        message: `Period "${p.slug}" ends (${p.endDate}) before it starts (${p.startDate}) — skipped.`,
        periodIds: [p.id],
      });
      continue;
    }
    for (const d of datesInRange(p.startDate, p.endDate)) {
      (byDate.get(d) ?? byDate.set(d, []).get(d)!).push(p);
    }
  }

  const ambiguous = new Map<string, string[]>();
  const winners = new Map<string, PricingPeriod>();

  for (const [date, candidates] of byDate) {
    if (candidates.length === 1) { winners.set(date, candidates[0]); continue; }
    const sorted = [...candidates].sort(
      (a, b) => b.priority - a.priority || b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id),
    );
    const top = sorted[0];
    if (sorted[1] && sorted[1].priority === top.priority) {
      const key = [top.id, sorted[1].id].sort().join('|');
      (ambiguous.get(key) ?? ambiguous.set(key, []).get(key)!).push(date);
    }
    winners.set(date, top);
  }

  for (const [key, dates] of ambiguous) {
    const ids = key.split('|');
    warnings.push({
      kind: 'overlap-same-priority',
      message:
        `Periods "${ids[0]}" and "${ids[1]}" overlap on ${dates.length} date(s) at the SAME priority. ` +
        'Resolved deterministically (later start wins), but this is a guess — set distinct priorities.',
      periodIds: ids,
      dates,
    });
  }

  return winners;
}

/** Contiguous runs of the same winning period. */
interface Segment { period: PricingPeriod; start: string; end: string }

function segmentsFrom(winners: Map<string, PricingPeriod>): Segment[] {
  const dates = [...winners.keys()].sort();
  const segments: Segment[] = [];
  let cur: Segment | null = null;

  for (const d of dates) {
    const p = winners.get(d)!;
    if (cur && cur.period.id === p.id && addDaysYmd(cur.end, 1) === d) {
      cur.end = d;
    } else {
      if (cur) segments.push(cur);
      cur = { period: p, start: d, end: d };
    }
  }
  if (cur) segments.push(cur);
  return segments;
}

export interface CompileOptions {
  tierMultipliers?: TierMultipliers;
  /** Stamped on every emitted row. Pass a fixed value in tests so output is deterministic. */
  compiledAt?: string;
  /** Floor applied when a period states no minimum stay. */
  defaultMinimumStay?: number;
}

export function compilePeriods(periods: PricingPeriod[], opts: CompileOptions = {}): CompileResult {
  const tiers = opts.tierMultipliers ?? DEFAULT_TIER_MULTIPLIERS;
  const compiledAt = opts.compiledAt;
  const defaultMinStay = opts.defaultMinimumStay ?? 1;
  const warnings: CompileWarning[] = [];

  const active = periods.filter((p) => p.status === 'active');
  const winners = winnersByDate(active, warnings);
  const segments = segmentsFrom(winners);

  const seasons: CompiledSeason[] = [];
  const overrides: CompiledOverride[] = [];

  // How many segments each period produced — a period that got split cannot reuse its single legacy id.
  const segCount = new Map<string, number>();
  segments.forEach((s) => segCount.set(s.period.id, (segCount.get(s.period.id) ?? 0) + 1));

  let segIndex = new Map<string, number>();

  for (const seg of segments) {
    const p = seg.period;
    const prov: Provenance = { source: 'period-compiler', periodId: p.id, ...(compiledAt ? { compiledAt } : {}) };
    const minimumStay = p.minStay ?? defaultMinStay;

    if (p.fixedNightPrice != null) {
      // A hand-set price means "replace everything for this night", which is exactly dateOverride
      // semantics — so it compiles to one override per date rather than to a season.
      for (const date of datesInRange(seg.start, seg.end)) {
        overrides.push({
          id: p.legacyOverrideIdByDate?.[date] ?? `${p.propertyId}-${date}-${p.slug}`,
          propertyId: p.propertyId,
          date,
          customPrice: p.fixedNightPrice,
          minimumStay,
          available: p.available ?? true,
          flatRate: p.flatRate ?? true,
          reason: p.name,
          provenance: prov,
        });
      }
      continue;
    }

    const multiplier = tiers[p.tier];
    if (multiplier == null) {
      warnings.push({
        kind: 'unknown-tier',
        message: `Period "${p.slug}" has tier "${p.tier}", which has no multiplier configured — skipped.`,
        periodIds: [p.id],
      });
      continue;
    }

    const n = (segIndex.get(p.id) ?? 0) + 1;
    segIndex.set(p.id, n);
    const wasSplit = (segCount.get(p.id) ?? 1) > 1;

    if (wasSplit && p.legacySeasonId && n === 1) {
      warnings.push({
        kind: 'split-loses-legacy-id',
        message:
          `Period "${p.slug}" compiles to ${segCount.get(p.id)} segments because a higher-priority period ` +
          `overlaps it, so it cannot reuse its original season id (${p.legacySeasonId}). Calendars for ` +
          'these dates will change seasonId — a real change, not a price change.',
        periodIds: [p.id],
      });
    }

    seasons.push({
      id: !wasSplit && p.legacySeasonId ? p.legacySeasonId : `${p.propertyId}_${p.year}_${p.slug}${wasSplit ? `_${n}` : ''}`,
      propertyId: p.propertyId,
      name: p.name,
      seasonType: p.legacySeasonType ?? TIER_TO_SEASON_TYPE[p.tier],
      startDate: seg.start,
      endDate: seg.end,
      priceMultiplier: multiplier,
      minimumStay,
      enabled: true,
      provenance: prov,
    });
  }

  return {
    seasons,
    overrides,
    warnings,
    coveredDates: [...winners.keys()].sort(),
  };
}
