/** @jest-environment node */

import { migrateToPeriods, tierForMultiplier, type LegacySeasonRow, type LegacyOverrideRow } from '../periodMigration';
import { compilePeriods, DEFAULT_TIER_MULTIPLIERS } from '../periods';

const P = 'prahova-mountain-chalet';

/** Real rows, copied from production on 2026-08-07. */
const LIVE_SEASONS: LegacySeasonRow[] = [
  { id: `${P}-2026-vacanta-paste`, propertyId: P, name: 'Vacanta Paste', seasonType: 'medium', startDate: '2026-04-10', endDate: '2026-04-20', priceMultiplier: 1.1, minimumStay: 2, enabled: true },
  { id: `${P}-2026-summer`, propertyId: P, name: 'Summer', seasonType: 'high', startDate: '2026-06-20', endDate: '2026-08-31', priceMultiplier: 1.2, minimumStay: 2, enabled: true },
  { id: `${P}-2026-late-fall`, propertyId: P, name: 'Late Fall', seasonType: 'minimum', startDate: '2026-11-02', endDate: '2026-11-27', priceMultiplier: 0.8, minimumStay: 2, enabled: true },
  // The two fossils: multipliers from the OLD hardcoded ladder {0.7 … 1.5}, both disabled.
  { id: 'summer-season-2024', propertyId: P, name: 'Summer Season 2024', seasonType: 'medium', startDate: '2024-06-15', endDate: '2024-08-31', priceMultiplier: 1.3, minimumStay: 2, enabled: false },
  { id: 'winter-season-2023', propertyId: P, name: 'Winter Holiday Season 2023', seasonType: 'high', startDate: '2023-12-20', endDate: '2024-01-05', priceMultiplier: 1.5, minimumStay: 3, enabled: false },
];

const LIVE_OVERRIDES: LegacyOverrideRow[] = [
  ...['24', '25', '26', '27'].map((d) => ({
    id: `${P}-2026-12-${d}-christmas`, propertyId: P, date: `2026-12-${d}`,
    customPrice: 1175, minimumStay: 3, available: true, flatRate: true, reason: 'Christmas',
  })),
  ...['28', '29'].map((d) => ({
    id: `${P}-2026-12-${d}-pre-new-year`, propertyId: P, date: `2026-12-${d}`,
    customPrice: 940, minimumStay: 2, available: true, flatRate: true, reason: 'Pre-New Year',
  })),
  ...['30', '31'].map((d) => ({
    id: `${P}-2026-12-${d}-new-year-s-eve`, propertyId: P, date: `2026-12-${d}`,
    customPrice: 2351, minimumStay: 3, available: true, flatRate: true, reason: "New Year's Eve",
  })),
];

describe('tierForMultiplier', () => {
  it('matches the owner ladder exactly', () => {
    expect(tierForMultiplier(0.8)).toBe('min');
    expect(tierForMultiplier(0.9)).toBe('low');
    expect(tierForMultiplier(1.0)).toBe('base');
    expect(tierForMultiplier(1.1)).toBe('medium');
    expect(tierForMultiplier(1.2)).toBe('high');
    expect(tierForMultiplier(1.3)).toBe('max');
  });

  it('tolerates float representation error', () => {
    expect(tierForMultiplier(0.1 + 1.0)).toBe('medium'); // 1.1000000000000003
  });

  // Guessing a nearest tier would silently reprice. 1.15 is not a tier; say so.
  it('refuses to guess a nearby tier', () => {
    expect(tierForMultiplier(1.15)).toBeNull();
    expect(tierForMultiplier(1.5)).toBeNull();
  });
});

describe('migrating the real production rows', () => {
  const { periods, issues } = migrateToPeriods(P, LIVE_SEASONS, LIVE_OVERRIDES);

  it('migrates only enabled seasons', () => {
    const fromSeasons = periods.filter((p) => p.legacySeasonId);
    expect(fromSeasons.map((p) => p.legacySeasonId)).toEqual([
      `${P}-2026-vacanta-paste`, `${P}-2026-summer`, `${P}-2026-late-fall`,
    ]);
  });

  it('leaves the old-ladder fossils out, and says why', () => {
    const skipped = issues.filter((i) => i.kind === 'skipped-disabled');
    expect(skipped.map((s) => s.ids[0]).sort()).toEqual(['summer-season-2024', 'winter-season-2023']);
    // Crucially they are NOT silently given tier 'max'/'high' — 1.5 is not on this ladder at all.
    expect(periods.some((p) => p.legacySeasonId === 'winter-season-2023')).toBe(false);
  });

  it('collapses eight override documents into the three decisions behind them', () => {
    const fixed = periods.filter((p) => p.fixedNightPrice != null);
    expect(fixed.map((p) => [p.name, p.startDate, p.endDate, p.fixedNightPrice])).toEqual([
      ['Christmas', '2026-12-24', '2026-12-27', 1175],
      ['Pre-New Year', '2026-12-28', '2026-12-29', 940],
      ["New Year's Eve", '2026-12-30', '2026-12-31', 2351],
    ]);
  });

  it('keeps every original override id, so calendars keep their overrideId', () => {
    const xmas = periods.find((p) => p.name === 'Christmas')!;
    expect(xmas.legacyOverrideIdByDate).toEqual({
      '2026-12-24': `${P}-2026-12-24-christmas`,
      '2026-12-25': `${P}-2026-12-25-christmas`,
      '2026-12-26': `${P}-2026-12-26-christmas`,
      '2026-12-27': `${P}-2026-12-27-christmas`,
    });
  });

  it('ranks hand-set prices above tiers', () => {
    const fixed = periods.filter((p) => p.fixedNightPrice != null);
    const tiered = periods.filter((p) => p.fixedNightPrice == null);
    expect(Math.min(...fixed.map((p) => p.priority))).toBeGreaterThan(Math.max(...tiered.map((p) => p.priority)));
  });

  it('does not merge adjacent overrides that differ in price', () => {
    // 27th (1175) and 28th (940) are consecutive days but different decisions.
    const names = periods.filter((p) => p.fixedNightPrice != null).map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('reports nothing anomalous for clean production data', () => {
    expect(issues.filter((i) => i.kind !== 'skipped-disabled')).toEqual([]);
  });
});

/**
 * The acceptance property, at unit scale: what comes out of the compiler must be what went in.
 * `scripts/verify-period-identity.ts` proves the same thing against live Firestore, night by night.
 */
describe('compile ∘ migrate = identity', () => {
  const { periods } = migrateToPeriods(P, LIVE_SEASONS, LIVE_OVERRIDES);
  const out = compilePeriods(periods, { tierMultipliers: DEFAULT_TIER_MULTIPLIERS, defaultMinimumStay: 1 });

  it('reproduces each enabled season on its original id, dates and multiplier', () => {
    for (const s of LIVE_SEASONS.filter((x) => x.enabled)) {
      const got = out.seasons.find((c) => c.id === s.id);
      expect(got).toBeDefined();
      expect([got!.startDate, got!.endDate, got!.priceMultiplier, got!.minimumStay, got!.seasonType])
        .toEqual([s.startDate, s.endDate, s.priceMultiplier, s.minimumStay, s.seasonType]);
    }
  });

  it('reproduces every override on its original id, date and price', () => {
    expect(out.overrides).toHaveLength(LIVE_OVERRIDES.length);
    for (const o of LIVE_OVERRIDES) {
      const got = out.overrides.find((c) => c.id === o.id);
      expect(got).toBeDefined();
      expect([got!.date, got!.customPrice, got!.minimumStay, got!.flatRate, got!.available, got!.reason])
        .toEqual([o.date, o.customPrice, o.minimumStay, o.flatRate, o.available, o.reason]);
    }
  });

  it('emits no warnings for production data', () => {
    expect(out.warnings).toEqual([]);
  });

  it('stamps everything with period-compiler provenance, so the compiler can own its own rows', () => {
    [...out.seasons, ...out.overrides].forEach((r) => {
      expect(r.provenance.source).toBe('period-compiler');
      expect(r.provenance.periodId).toBeTruthy();
    });
  });
});
