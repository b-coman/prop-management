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
  nightlyChargeToday, solveWeekdayNightlyForStayTotal, suggestLever,
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
