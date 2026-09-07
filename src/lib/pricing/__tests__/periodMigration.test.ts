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

describe('compilePeriods — night profile (one season, a price curve)', () => {
  const base = {
    propertyId: 'p', year: 2026, priority: 100, tier: 'base' as const,
    status: 'active' as const, minStay: 3, weekdayRate: null,
  };

  /** The three rows as they stood before the merge. */
  const THREE = [
    { ...base, id: 'p_pre-new-year_2026', slug: 'pre-new-year', name: 'Pre-New Year',
      startDate: '2026-12-28', endDate: '2026-12-29', fixedNightPrice: 940 },
    { ...base, id: 'p_new-year-s-eve_2026', slug: 'new-year-s-eve', name: "New Year's Eve",
      startDate: '2026-12-30', endDate: '2026-12-31', fixedNightPrice: 2351 },
    { ...base, id: 'p_post-new-year_2027', slug: 'post-new-year', name: 'Post-New Year',
      startDate: '2027-01-01', endDate: '2027-01-02', fixedNightPrice: 940 },
  ];

  /** The same product as ONE period carrying the curve. */
  const MERGED = [{
    ...base, id: 'p_new-year_2026', slug: 'new-year', name: 'New Year',
    startDate: '2026-12-28', endDate: '2027-01-02', fixedNightPrice: 940,
    nightProfile: [
      { date: '2026-12-30', price: 2351 },
      { date: '2026-12-31', price: 2351 },
    ],
    legacyOverrideIdByDate: {
      '2026-12-28': 'p-2026-12-28-pre-new-year',
      '2026-12-29': 'p-2026-12-29-pre-new-year',
      '2026-12-30': 'p-2026-12-30-new-year-s-eve',
      '2026-12-31': 'p-2026-12-31-new-year-s-eve',
      '2027-01-01': 'p-2027-01-01-post-new-year',
      '2027-01-02': 'p-2027-01-02-post-new-year',
    },
  }];

  const opts = { basePrice: 525, defaultMinimumStay: 2 };

  it('produces BYTE-IDENTICAL overrides to the three rows it replaces', () => {
    const a = compilePeriods(THREE as never, opts).overrides
      .map((o) => ({ id: o.id, date: o.date, customPrice: o.customPrice, minimumStay: o.minimumStay, flatRate: o.flatRate }))
      .sort((x, y) => (x.date < y.date ? -1 : 1));
    const b = compilePeriods(MERGED as never, opts).overrides
      .map((o) => ({ id: o.id, date: o.date, customPrice: o.customPrice, minimumStay: o.minimumStay, flatRate: o.flatRate }))
      .sort((x, y) => (x.date < y.date ? -1 : 1));
    expect(b).toEqual(a);
    expect(b.map((o) => o.customPrice)).toEqual([940, 940, 2351, 2351, 940, 940]);
  });

  it('keeps the party premium on exactly the two nights around 31 Dec', () => {
    const out = compilePeriods(MERGED as never, opts).overrides;
    const at = (d: string) => out.find((o) => o.date === d)!.customPrice;
    expect(at('2026-12-29')).toBe(940);
    expect(at('2026-12-30')).toBe(2351);
    expect(at('2026-12-31')).toBe(2351);
    expect(at('2027-01-01')).toBe(940);
  });

  it('falls back to fixedNightPrice for a night the profile does not name', () => {
    const out = compilePeriods(MERGED as never, opts).overrides;
    expect(out.find((o) => o.date === '2026-12-28')!.customPrice).toBe(940);
  });

  it('warns rather than silently unpricing a night when there is no fallback', () => {
    const noFallback = [{ ...MERGED[0], fixedNightPrice: null }];
    const r = compilePeriods(noFallback as never, opts);
    expect(r.overrides.map((o) => o.date)).toEqual(['2026-12-30', '2026-12-31']);
    expect(r.warnings.some((w) => w.message.includes('does not cover'))).toBe(true);
  });
});

describe('migrateToPeriods — a price CURVE round-trips as one period', () => {
  // The six live New Year overrides: one product, one reason, two prices.
  const NY = ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']
    .map((date, i) => ({
      id: `p-${date}-new-year`, propertyId: 'p', date,
      customPrice: i === 2 || i === 3 ? 2351 : 940,
      minimumStay: 3, flatRate: true, available: true, reason: 'New Year',
    }));

  it('produces ONE period, not three colliding ones', () => {
    const { periods } = migrateToPeriods('p', [], NY as never, {});
    const ny = periods.filter((x) => x.name === 'New Year');
    expect(ny).toHaveLength(1);
    expect(new Set(periods.map((x) => x.id)).size).toBe(periods.length); // no id collisions
  });

  it('keeps the party premium in a nightProfile rather than flattening it', () => {
    const { periods } = migrateToPeriods('p', [], NY as never, {});
    const ny = periods.find((x) => x.name === 'New Year')!;
    expect(ny.fixedNightPrice).toBe(940);
    expect(ny.nightProfile).toEqual([
      { date: '2026-12-30', price: 2351 },
      { date: '2026-12-31', price: 2351 },
    ]);
    expect(ny.startDate).toBe('2026-12-28');
    expect(ny.endDate).toBe('2027-01-02');
  });

  it('round-trips: migrate then compile reproduces every override exactly', () => {
    const { periods } = migrateToPeriods('p', [], NY as never, {});
    const back = compilePeriods(periods, { basePrice: 525, defaultMinimumStay: 2 }).overrides;
    expect(back.map((o) => ({ date: o.date, customPrice: o.customPrice, id: o.id })))
      .toEqual(NY.map((o) => ({ date: o.date, customPrice: o.customPrice, id: o.id })));
  });

  it('a constant-price run still yields no profile — unchanged behaviour', () => {
    const xmas = ['2026-12-24', '2026-12-25'].map((date) => ({
      id: `p-${date}-christmas`, propertyId: 'p', date, customPrice: 1051,
      minimumStay: 3, flatRate: true, available: true, reason: 'Christmas',
    }));
    const { periods } = migrateToPeriods('p', [], xmas as never, {});
    const c = periods.find((x) => x.name === 'Christmas')!;
    expect(c.fixedNightPrice).toBe(1051);
    expect(c.nightProfile).toBeUndefined();
  });
});
