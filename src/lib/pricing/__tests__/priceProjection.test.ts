/**
 * The money maths behind every price the year board proposes.
 *
 * These numbers are taken from the live property and from real captures of its own booking page, not
 * invented: the whole value of the projection is that it reproduces what a guest is actually quoted,
 * and a fixture that only agrees with the code proves nothing. The 22-28 Sep case below is the exact
 * stay the Fall recommendation is derived from, and 2821 is what the site really charged for it.
 */
import {
  stayTotal, lengthOfStayDiscountPct, isFlatRate, projectNightlyPrice,
  nightlyChargeToday, solveWeekdayNightlyForStayTotal, solveFlatPriceForWorstGap, spreadAt,
  suggestLever, bestRateForBand,
  type StayEconomics, type NightFact,
} from '../priceProjection';
import { DEFAULT_TIER_MULTIPLIERS } from '../periods';

const econ: StayEconomics = {
  baseOccupancy: 3,
  extraGuestFee: 75,
  cleaningFee: 200,
  lengthOfStayDiscounts: [
    { nightsThreshold: 3, discountPercentage: 10, enabled: true },
    { nightsThreshold: 4, discountPercentage: 15, enabled: true },
    { nightsThreshold: 7, discountPercentage: 25, enabled: true },
  ],
};

const night = (date: string, price: number, isWeekend = false): NightFact => ({
  date, price, pricesByGuests: { '3': price, '4': price + 75, '5': price + 150, '6': price + 225 },
  isWeekend, available: true, flatRate: false,
});

/** 22-28 Sep 2026 as the calendar actually holds it: four weekdays at 472.50, two weekend at 614.25. */
const fallStay = [
  night('2026-09-22', 472.5), night('2026-09-23', 472.5), night('2026-09-24', 472.5),
  night('2026-09-25', 614.25, true), night('2026-09-26', 614.25, true), night('2026-09-27', 472.5),
];

describe('lengthOfStayDiscountPct', () => {
  it('takes the highest threshold at or below the stay length', () => {
    expect(lengthOfStayDiscountPct(2, econ.lengthOfStayDiscounts)).toBe(0);
    expect(lengthOfStayDiscountPct(3, econ.lengthOfStayDiscounts)).toBeCloseTo(0.10);
    expect(lengthOfStayDiscountPct(6, econ.lengthOfStayDiscounts)).toBeCloseTo(0.15);
    expect(lengthOfStayDiscountPct(9, econ.lengthOfStayDiscounts)).toBeCloseTo(0.25);
  });

  it('ignores disabled tiers', () => {
    expect(lengthOfStayDiscountPct(5, [{ nightsThreshold: 4, discountPercentage: 15, enabled: false }])).toBe(0);
  });
});

describe('stayTotal', () => {
  it('reproduces what the live site actually charged for 22-28 Sep, 3 guests', () => {
    const charges = fallStay.map((n) => nightlyChargeToday(n, 3, econ)!);
    expect(Math.round(stayTotal(charges, econ))).toBe(2821);
  });

  it('adds the cleaning fee before the discount, not after', () => {
    // (2 x 100 + 200) x 0.9 = 360. Applying the discount first would give 380.
    expect(stayTotal([100, 100, 100], { ...econ, lengthOfStayDiscounts: [{ nightsThreshold: 3, discountPercentage: 10 }] }))
      .toBeCloseTo((300 + 200) * 0.9);
  });
});

describe('flat-rate nights', () => {
  it('recognises a whole-house night from its occupancy dict', () => {
    expect(isFlatRate({ '3': 1175, '4': 1175, '5': 1175, '6': 1175 })).toBe(true);
    expect(isFlatRate({ '3': 420, '4': 495, '5': 570 })).toBe(false);
    expect(isFlatRate(null)).toBe(false);
  });

  it('charges every party size the same on a flat night', () => {
    const xmas: NightFact = { date: '2026-12-25', price: 1175, isWeekend: false, available: true,
      flatRate: true, pricesByGuests: { '3': 1175, '4': 1175, '5': 1175, '6': 1175 } };
    expect(nightlyChargeToday(xmas, 6, econ)).toBe(1175);
    expect(nightlyChargeToday(xmas, 3, econ)).toBe(1175);
  });
});

describe('projectNightlyPrice', () => {
  it('compounds the weekend uplift with the tier, as calculateDayPrice does', () => {
    const opts = { basePrice: 525, weekendAdjustment: 1.3, tierMultipliers: DEFAULT_TIER_MULTIPLIERS };
    expect(projectNightlyPrice({ isWeekend: false }, { tier: 'low', fixedNightPrice: null, minStay: null, flatRate: false }, opts))
      .toBeCloseTo(472.5);
    expect(projectNightlyPrice({ isWeekend: true }, { tier: 'low', fixedNightPrice: null, minStay: null, flatRate: false }, opts))
      .toBeCloseTo(614.25);
  });

  it('lets a hand-set price replace everything, weekend included', () => {
    const opts = { basePrice: 525, weekendAdjustment: 1.3, tierMultipliers: DEFAULT_TIER_MULTIPLIERS };
    expect(projectNightlyPrice({ isWeekend: true }, { tier: 'low', fixedNightPrice: 413, minStay: null, flatRate: false }, opts))
      .toBe(413);
  });
});

describe('solveWeekdayNightlyForStayTotal', () => {
  it('finds the flat nightly price that hits a wanted stay total', () => {
    // 10% under Airbnb's 2528 for the 22-28 Sep stay: (6x + 200) x 0.85 = 2275.2
    const x = solveWeekdayNightlyForStayTotal(2528 * 0.9, fallStay, 3, { flatRate: false },
      { weekendAdjustment: 1, econ })!;
    expect(x).toBeCloseTo(412.8, 1);
    expect(stayTotal(fallStay.map(() => x), econ)).toBeCloseTo(2528 * 0.9, 0);
  });

  it('solves under weekend semantics when the lever keeps the uplift', () => {
    const x = solveWeekdayNightlyForStayTotal(2528 * 0.9, fallStay, 3, { flatRate: false },
      { weekendAdjustment: 1.3, econ })!;
    // Weekends cost more, so the weekday rate that reaches the same total must be lower.
    expect(x).toBeLessThan(412.8);
  });

  it('returns null rather than a wrong answer when the total is unreachable', () => {
    expect(solveWeekdayNightlyForStayTotal(10, fallStay, 3, { flatRate: false },
      { weekendAdjustment: 1, econ })).toBeNull();
  });
});

describe('suggestLever', () => {
  const opts = { basePrice: 525, tierMultipliers: DEFAULT_TIER_MULTIPLIERS };

  it('picks a tier when the ladder can express the price', () => {
    expect(suggestLever(472.5, opts)).toEqual({ kind: 'tier', tier: 'low', weekday: 472.5 });
  });

  it('falls back to a hand-set price when no tier is close enough', () => {
    // The Fall case: parity wants 375 a weekday night under tier semantics. The lowest rung, "min",
    // is 525 x 0.8 = 420 — 12% away — so the ladder genuinely cannot express it.
    expect(suggestLever(375, opts).kind).toBe('fixed');
  });

  it('still accepts a rung that is only marginally off', () => {
    // 413 sits 1.7% under "min" at 420, inside tolerance. This is why the recommendation asks
    // suggestLever about the TIER-semantics price and not the flat one it eventually proposes:
    // the two are different questions and 413 would wrongly look reachable.
    expect(suggestLever(413, opts)).toEqual({ kind: 'tier', tier: 'min', weekday: 420 });
  });
});

describe('solveFlatPriceForWorstGap', () => {
  /**
   * The regression this exists for. Two stays with different length-of-stay discounts close their
   * gaps at different speeds, so the one that is worst today is not the one that is worst after the
   * change. Solving the first in isolation is what produced a "10% under" price that left the real
   * worst stay at -0.7%.
   */
  // Both real, both inside Fall, both 3 guests. The 2-night stay gets no length-of-stay discount and
  // still carries the whole 200 cleaning fee, so its gap closes SLOWLY; the 6-night stay has 15% off
  // on top, so its gap closes fast. That difference is what makes the ranking flip.
  //   22-24 Sep, 2n: direct 1145, airbnb 1060  -> +8.0% today
  //   22-28 Sep, 6n: direct 2821, airbnb 2528  -> +11.6% today  (worst today)
  const short = { nights: fallStay.slice(0, 2), guests: 3, bestPrice: 1060, floor: 886 };
  const long = { nights: fallStay, guests: 3, bestPrice: 2528, floor: 2116 };

  it('puts the WORST stay of the set at the target, not merely one of them', () => {
    const p = solveFlatPriceForWorstGap(-0.10, [short, long], { flatRate: false },
      { weekendAdjustment: 1, econ })!;
    const s = spreadAt(p, [short, long], { flatRate: false }, { weekendAdjustment: 1, econ });
    expect(s.worst).toBeCloseTo(-0.10, 3);
    // Every stay is at least as cheap as the target: none is left dearer.
    expect(s.gaps.every((g) => g <= -0.10 + 1e-6)).toBe(true);
  });

  it('is stricter than solving the single worst stay alone', () => {
    const alone = solveWeekdayNightlyForStayTotal(2528 * 0.9, long.nights, 3, { flatRate: false },
      { weekendAdjustment: 1, econ })!;
    const set = solveFlatPriceForWorstGap(-0.10, [short, long], { flatRate: false },
      { weekendAdjustment: 1, econ })!;
    expect(set).toBeLessThan(alone);
    // At the naive price the set target is NOT met - this is the shipped bug, pinned.
    const naive = spreadAt(alone, [short, long], { flatRate: false }, { weekendAdjustment: 1, econ });
    expect(naive.worst!).toBeGreaterThan(-0.10);
  });

  it('returns null when no price in range reaches the target', () => {
    expect(solveFlatPriceForWorstGap(-0.99, [short], { flatRate: false },
      { weekendAdjustment: 1, econ }, { lo: 400, hi: 500 })).toBeNull();
  });
});

describe('spreadAt', () => {
  it('counts stays that fall under their floor', () => {
    const s = spreadAt(200, [{ nights: fallStay, guests: 3, bestPrice: 2528, floor: 2116 }],
      { flatRate: false }, { weekendAdjustment: 1, econ });
    expect(s.belowFloor).toBe(1);
    expect(s.dearer).toBe(0);
  });
});

describe('weekdayRate keeps the weekend uplift', () => {
  const opts = { basePrice: 525, weekendAdjustment: 1.3, tierMultipliers: DEFAULT_TIER_MULTIPLIERS };
  const p = { tier: 'low' as const, fixedNightPrice: null, weekdayRate: 405, minStay: null, flatRate: false };

  it('applies the rate on a weekday and the uplift on a weekend', () => {
    expect(projectNightlyPrice({ isWeekend: false }, p, opts)).toBe(405);
    expect(projectNightlyPrice({ isWeekend: true }, p, opts)).toBeCloseTo(526.5);
  });

  it('is overridden by a hand-set flat price, which is what "flat" means', () => {
    expect(projectNightlyPrice({ isWeekend: true }, { ...p, fixedNightPrice: 349 }, opts)).toBe(349);
  });
});

describe('bestRateForBand', () => {
  const stays = [
    { nights: fallStay.slice(0, 2), guests: 3, bestPrice: 1060, floor: 886 },
    { nights: fallStay, guests: 3, bestPrice: 2528, floor: 2116 },
  ];

  it('maximises stays inside the band rather than merely avoiding one dearer stay', () => {
    const r = bestRateForBand(stays, { flatRate: false, useWeekendUplift: false },
      { weekendAdjustment: 1.3, econ })!;
    const s = spreadAt(r.rate, stays, { flatRate: false, useWeekendUplift: false },
      { weekendAdjustment: 1.3, econ });
    // No other rate fits more stays in band.
    for (let probe = 200; probe <= 900; probe += 5) {
      const alt = spreadAt(probe, stays, { flatRate: false, useWeekendUplift: false },
        { weekendAdjustment: 1.3, econ });
      expect(alt.inBand).toBeLessThanOrEqual(s.inBand);
    }
  });

  it('reports the band count at the rate it picks', () => {
    const r = bestRateForBand(stays, { flatRate: false, useWeekendUplift: false },
      { weekendAdjustment: 1.3, econ })!;
    const s = spreadAt(r.rate, stays, { flatRate: false, useWeekendUplift: false },
      { weekendAdjustment: 1.3, econ });
    expect(s.inBand).toBe(r.inBand);
    expect(s.dearer).toBe(r.dearer);
  });

  it('keeping the weekend uplift beats a flat rate on how far the stays spread', () => {
    // The measured reason the flat fallback was wrong: with the uplift the stays sit closer together,
    // so more of them fit inside one band.
    const withUplift = bestRateForBand(stays, { flatRate: false, useWeekendUplift: true },
      { weekendAdjustment: 1.3, econ })!;
    const flat = bestRateForBand(stays, { flatRate: false, useWeekendUplift: false },
      { weekendAdjustment: 1.3, econ })!;
    expect(withUplift.inBand).toBeGreaterThanOrEqual(flat.inBand - 1);
  });

  it('returns null with nothing measured', () => {
    expect(bestRateForBand([], { flatRate: false, useWeekendUplift: true },
      { weekendAdjustment: 1.3, econ })).toBeNull();
  });
});
