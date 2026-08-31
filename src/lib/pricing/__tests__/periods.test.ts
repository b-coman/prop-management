/** @jest-environment node */

import {
  compilePeriods, datesInRange, addDaysYmd, DEFAULT_TIER_MULTIPLIERS,
  type PricingPeriod,
} from '../periods';

const AT = '2026-08-07T00:00:00.000Z';

const period = (over: Partial<PricingPeriod> & { slug: string; startDate: string; endDate: string }): PricingPeriod => ({
  id: `p_${over.slug}`,
  propertyId: 'prahova-mountain-chalet',
  year: 2026,
  name: over.slug,
  tier: 'base',
  priority: 0,
  fixedNightPrice: null,
  minStay: 2,
  status: 'active',
  ...over,
});

describe('date helpers stay in UTC', () => {
  it('walks a range inclusively', () => {
    expect(datesInRange('2026-12-30', '2027-01-02'))
      .toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('crosses a leap day', () => {
    expect(addDaysYmd('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysYmd('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('returns nothing for a backwards range', () => {
    expect(datesInRange('2026-05-10', '2026-05-01')).toEqual([]);
  });
});

describe('compiling a simple period', () => {
  it('emits one season spanning the period, at the tier multiplier', () => {
    const r = compilePeriods([period({ slug: 'vara', startDate: '2026-06-20', endDate: '2026-08-31', tier: 'high' })], { compiledAt: AT });
    expect(r.seasons).toHaveLength(1);
    expect(r.seasons[0]).toMatchObject({
      startDate: '2026-06-20', endDate: '2026-08-31', priceMultiplier: 1.2,
      seasonType: 'high', minimumStay: 2, enabled: true,
    });
    expect(r.seasons[0].provenance).toEqual({ source: 'period-compiler', periodId: 'p_vara', compiledAt: AT });
    expect(r.warnings).toEqual([]);
  });

  it('ignores draft and archived periods entirely', () => {
    const r = compilePeriods([
      period({ slug: 'a', startDate: '2026-06-01', endDate: '2026-06-10', status: 'draft' }),
      period({ slug: 'b', startDate: '2026-07-01', endDate: '2026-07-10', status: 'archived' }),
    ], { compiledAt: AT });
    expect(r.seasons).toEqual([]);
    expect(r.coveredDates).toEqual([]);
  });

  it('reads the ladder from config rather than hardcoding it', () => {
    const custom = { ...DEFAULT_TIER_MULTIPLIERS, high: 1.45 };
    const r = compilePeriods([period({ slug: 'v', startDate: '2026-06-01', endDate: '2026-06-02', tier: 'high' })],
      { tierMultipliers: custom, compiledAt: AT });
    expect(r.seasons[0].priceMultiplier).toBe(1.45);
  });
});

/**
 * The reason the compiler exists. `findMatchingSeason` resolves overlaps by picking the HIGHEST
 * MULTIPLIER, which is not a decision anyone made — it just happens to be how the sort was written.
 * The compiler emits a flattened, non-overlapping set, so the engine is never handed two candidates.
 */
describe('overlap resolution — flattening is the point', () => {
  const base = period({ slug: 'vara', startDate: '2026-06-01', endDate: '2026-06-30', tier: 'high', priority: 0 });
  const feast = period({ slug: 'rusalii', startDate: '2026-06-10', endDate: '2026-06-12', tier: 'low', priority: 10 });

  it('splits the lower-priority period around the winner, leaving no overlap', () => {
    const r = compilePeriods([base, feast], { compiledAt: AT });
    const ranges = r.seasons.map((s) => [s.startDate, s.endDate, s.priceMultiplier]);
    expect(ranges).toEqual([
      ['2026-06-01', '2026-06-09', 1.2],
      ['2026-06-10', '2026-06-12', 0.9],
      ['2026-06-13', '2026-06-30', 1.2],
    ]);
  });

  it('lets priority win even when the multiplier is LOWER — the engine could not', () => {
    // The engine's sort would have picked vara (×1.2) for 10-12. Priority says rusalii (×0.9).
    const r = compilePeriods([base, feast], { compiledAt: AT });
    const june11 = r.seasons.find((s) => s.startDate <= '2026-06-11' && s.endDate >= '2026-06-11');
    expect(june11!.priceMultiplier).toBe(0.9);
  });

  it('never emits two seasons covering the same day', () => {
    const r = compilePeriods([
      base, feast,
      period({ slug: 'weekend', startDate: '2026-06-20', endDate: '2026-06-21', tier: 'max', priority: 5 }),
    ], { compiledAt: AT });
    const seen = new Set<string>();
    for (const s of r.seasons) {
      for (const d of datesInRange(s.startDate, s.endDate)) {
        expect(seen.has(d)).toBe(false);
        seen.add(d);
      }
    }
  });

  it('warns instead of silently guessing when priorities tie', () => {
    const r = compilePeriods([
      period({ slug: 'a', startDate: '2026-06-01', endDate: '2026-06-10', priority: 3 }),
      period({ slug: 'b', startDate: '2026-06-05', endDate: '2026-06-15', priority: 3 }),
    ], { compiledAt: AT });
    const w = r.warnings.find((x) => x.kind === 'overlap-same-priority');
    expect(w).toBeDefined();
    expect(w!.dates).toEqual(['2026-06-05', '2026-06-06', '2026-06-07', '2026-06-08', '2026-06-09', '2026-06-10']);
  });

  it('is deterministic across input order', () => {
    const a = compilePeriods([base, feast], { compiledAt: AT });
    const b = compilePeriods([feast, base], { compiledAt: AT });
    expect(b.seasons).toEqual(a.seasons);
  });
});

describe('hand-set prices compile to overrides, not seasons', () => {
  const xmas = period({
    slug: 'craciun', startDate: '2026-12-24', endDate: '2026-12-27',
    fixedNightPrice: 1175, minStay: 3, name: 'Christmas', flatRate: true,
  });

  it('emits one override per night with replace-everything semantics', () => {
    const r = compilePeriods([xmas], { compiledAt: AT });
    expect(r.seasons).toEqual([]);
    expect(r.overrides).toHaveLength(4);
    expect(r.overrides[0]).toMatchObject({
      date: '2026-12-24', customPrice: 1175, minimumStay: 3, flatRate: true, available: true, reason: 'Christmas',
    });
  });

  it('beats a tier period underneath it when priority says so', () => {
    const winter = period({ slug: 'iarna', startDate: '2026-12-20', endDate: '2026-12-31', tier: 'min', priority: 0 });
    const r = compilePeriods([winter, { ...xmas, priority: 10 }], { compiledAt: AT });
    expect(r.overrides.map((o) => o.date)).toEqual(['2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27']);
    // The season survives on either side, split around the fixed-price block.
    expect(r.seasons.map((s) => [s.startDate, s.endDate])).toEqual([
      ['2026-12-20', '2026-12-23'],
      ['2026-12-28', '2026-12-31'],
    ]);
  });
});

/**
 * `priceCalendars.days[].seasonId` and `.overrideId` store the SOURCE DOCUMENT ID. Reusing the legacy
 * ids is what makes `compile ∘ migrate` byte-identical rather than merely equivalent — without it,
 * every day of every calendar changes and the acceptance test proves nothing.
 */
describe('legacy ids are preserved so the identity proof means something', () => {
  it('reuses the original season id when the period is not split', () => {
    const r = compilePeriods([period({
      slug: 'vacanta-paste', startDate: '2026-04-10', endDate: '2026-04-20', tier: 'medium',
      legacySeasonId: 'prahova-mountain-chalet-2026-vacanta-paste', legacySeasonType: 'medium',
    })], { compiledAt: AT });
    expect(r.seasons[0].id).toBe('prahova-mountain-chalet-2026-vacanta-paste');
    expect(r.seasons[0].seasonType).toBe('medium');
  });

  it('reuses original override ids per date', () => {
    const r = compilePeriods([period({
      slug: 'craciun', startDate: '2026-12-24', endDate: '2026-12-25', fixedNightPrice: 1175, minStay: 3,
      legacyOverrideIdByDate: {
        '2026-12-24': 'prahova-mountain-chalet-2026-12-24-christmas',
        '2026-12-25': 'prahova-mountain-chalet-2026-12-25-christmas',
      },
    })], { compiledAt: AT });
    expect(r.overrides.map((o) => o.id)).toEqual([
      'prahova-mountain-chalet-2026-12-24-christmas',
      'prahova-mountain-chalet-2026-12-25-christmas',
    ]);
  });

  it('refuses to reuse one legacy id across a split, and says so loudly', () => {
    const r = compilePeriods([
      period({ slug: 'vara', startDate: '2026-06-01', endDate: '2026-06-30', tier: 'high', legacySeasonId: 'legacy-vara' }),
      period({ slug: 'feast', startDate: '2026-06-10', endDate: '2026-06-12', tier: 'max', priority: 10 }),
    ], { compiledAt: AT });
    expect(r.seasons.filter((s) => s.id === 'legacy-vara')).toHaveLength(0);
    expect(r.warnings.some((w) => w.kind === 'split-loses-legacy-id')).toBe(true);
  });
});

describe('bad input is reported, not swallowed', () => {
  it('skips and warns on a backwards range', () => {
    const r = compilePeriods([period({ slug: 'bad', startDate: '2026-06-10', endDate: '2026-06-01' })], { compiledAt: AT });
    expect(r.seasons).toEqual([]);
    expect(r.warnings[0].kind).toBe('invalid-range');
  });

  it('skips and warns on a tier with no configured multiplier', () => {
    const r = compilePeriods(
      [period({ slug: 'x', startDate: '2026-06-01', endDate: '2026-06-02', tier: 'max' })],
      { tierMultipliers: { ...DEFAULT_TIER_MULTIPLIERS, max: undefined as unknown as number }, compiledAt: AT },
    );
    expect(r.seasons).toEqual([]);
    expect(r.warnings[0].kind).toBe('unknown-tier');
  });
});

describe('an explicit weekday rate compiles to a season, not a flat override', () => {
  /**
   * The distinction that matters: a `fixedNightPrice` becomes a dateOverride, which REPLACES the
   * night's price and so flattens the weekend. A `weekdayRate` has to become a season multiplier so
   * the engine still compounds the weekend adjustment on top - that uplift is what tracks the
   * platforms, and losing it was the defect this lever exists to fix.
   */
  const base = {
    propertyId: 'p', year: 2026, priority: 0, status: 'active' as const,
    fixedNightPrice: null, minStay: 2,
  };

  it('emits a season whose multiplier is the rate over the base price', () => {
    const res = compilePeriods(
      [{ ...base, id: 'x', slug: 'fall', name: 'Fall', startDate: '2026-09-09', endDate: '2026-09-11',
         tier: 'low', weekdayRate: 405 }],
      { basePrice: 525, compiledAt: 'T' },
    );
    expect(res.overrides).toHaveLength(0);
    expect(res.seasons).toHaveLength(1);
    expect(res.seasons[0].priceMultiplier).toBeCloseTo(405 / 525);
  });

  it('still prefers a hand-set flat price when both are set', () => {
    const res = compilePeriods(
      [{ ...base, id: 'x', slug: 'nye', name: 'NYE', startDate: '2026-12-30', endDate: '2026-12-31',
         tier: 'base', weekdayRate: 405, fixedNightPrice: 2351 }],
      { basePrice: 525, compiledAt: 'T' },
    );
    expect(res.seasons).toHaveLength(0);
    expect(res.overrides).toHaveLength(2);
    expect(res.overrides[0].customPrice).toBe(2351);
  });

  it('refuses rather than repricing when there is no base price to divide by', () => {
    const res = compilePeriods(
      [{ ...base, id: 'x', slug: 'fall', name: 'Fall', startDate: '2026-09-09', endDate: '2026-09-11',
         tier: 'low', weekdayRate: 405 }],
      { basePrice: 0, compiledAt: 'T' },
    );
    expect(res.seasons).toHaveLength(0);
    expect(res.warnings.map((w) => w.kind)).toContain('unknown-tier');
  });

  it('falls back to the tier when no rate is set', () => {
    const res = compilePeriods(
      [{ ...base, id: 'x', slug: 'fall', name: 'Fall', startDate: '2026-09-09', endDate: '2026-09-11',
         tier: 'low' }],
      { basePrice: 525, compiledAt: 'T' },
    );
    expect(res.seasons[0].priceMultiplier).toBeCloseTo(0.9);
  });
});
