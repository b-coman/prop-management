import { buildPeriodPositions, summarisePosition, NOISE_BAND } from '../pricingPosition';

const period = (over: Partial<Parameters<typeof buildPeriodPositions>[0][0]> = {}) => ({
  id: 'p1', name: 'Fall', startDate: '2026-10-01', endDate: '2026-10-05',
  tier: 'low', minStay: 2, fixedNightPrice: null, ...over,
});
const days = (avail: boolean[], price = 500) =>
  avail.map((a, i) => ({ date: `2026-10-0${i + 1}`, available: a, price, isWeekend: i >= 2 }));
const win = (over: any = {}) => ({
  checkIn: '2026-10-02', checkOut: '2026-10-04', nights: 2, guests: 3,
  verdict: 'losing', gapPct: 0.12, direct: 1400, bestChannel: 'airbnb', bestPrice: 1250,
  floor: 1000, targetPrice: 1125, oldestAgeDays: 3, ...over,
});

describe('a period takes its WORST window, because that is the one a guest finds', () => {
  it('a single bad window makes the period losing', () => {
    const [r] = buildPeriodPositions([period()], days([true, true, true, true]),
      [win({ gapPct: -0.20, verdict: 'healthy' }), win({ gapPct: 0.12 })]);
    expect(r.verdict).toBe('losing');
    expect(r.worstGapPct).toBeCloseTo(0.12, 3);
  });
});

describe("the owner's own 3% band is respected", () => {
  it('calls a sub-3% gap level, not losing — reporting +0.5% in red buries the +36% rows', () => {
    const [r] = buildPeriodPositions([period()], days([true, true, true, true]), [win({ gapPct: 0.005 })]);
    expect(r.verdict).toBe('level');
    expect(r.action).toMatch(/no reason to book with you/i);
  });
  it('still calls anything at or beyond the band losing', () => {
    const [r] = buildPeriodPositions([period()], days([true, true, true, true]), [win({ gapPct: NOISE_BAND })]);
    expect(r.verdict).toBe('losing');
  });
  it('treats a small NEGATIVE gap as level too — being 1% cheaper persuades nobody', () => {
    const [r] = buildPeriodPositions([period()], days([true, true, true, true]), [win({ gapPct: -0.01 })]);
    expect(r.verdict).toBe('level');
  });
});

describe('a period owns its endDate', () => {
  /**
   * The engine ends a range at 23:59:59 on `endDate` (isDateInRange) and the compiler iterates
   * start <= d <= end (datesInRange). The roll-up used `d < endDate`, so it dropped the LAST night of
   * every period out of the night count, the occupancy and the money - and those nights fell into no
   * coverage gap either, because coverage is computed inclusively, so they vanished from the screen.
   * On the live book that was 10 nights and 8,739 lei.
   */
  it('counts the final night of the range', () => {
    const [r] = buildPeriodPositions(
      [period({ startDate: '2026-10-01', endDate: '2026-10-04' })],
      days([true, true, true, true], 500),
      [win()],
    );
    expect(r.nights).toBe(4);
    expect(r.valueAtRisk).toBe(2000);
  });
});

describe('occupancy and money exposed', () => {
  it('counts open nights and prices them', () => {
    const [r] = buildPeriodPositions([period()], days([false, false, true, true], 500), [win()]);
    expect(r.booked).toBe(2);
    expect(r.openNights).toBe(2);
    expect(r.occupancyPct).toBe(50);
    expect(r.valueAtRisk).toBe(1000);
  });
  it('a fully booked period has nothing at risk however bad its parity', () => {
    const [r] = buildPeriodPositions([period()], days([false, false, false, false]), [win({ gapPct: 0.4 })]);
    expect(r.valueAtRisk).toBe(0);
    expect(r.verdict).toBe('losing');   // still true, just not costing anything right now
  });
});

describe('never measured is not the same as fine', () => {
  it('marks an unmeasured period and says how much is exposed', () => {
    const [r] = buildPeriodPositions([period()], days([true, true, true, true]), []);
    expect(r.verdict).toBe('unmeasured');
    expect(r.action).toMatch(/nobody has ever compared/i);
  });
  it('separates unmeasured money from losing money in the summary', () => {
    const rows = buildPeriodPositions(
      // Adjacent, NOT overlapping. `endDate` is inclusive - the same rule the engine's isDateInRange
      // and the compiler's datesInRange use - so a period ending 10-05 owns 10-05, and a neighbour
      // starting on that date would double-count it. Real periods never share a boundary day
      // (Fall ends 23 Oct, Vacanta Toamna starts 24 Oct), and the fixture now matches that.
      [period({ id: 'a', endDate: '2026-10-04' }),
       period({ id: 'b', startDate: '2026-10-05', endDate: '2026-10-08' })],
      [...days([true, true, true, true], 500),
       ...[0, 1, 2, 3].map((i) => ({ date: `2026-10-0${i + 5}`, available: true, price: 300, isWeekend: false }))],
      [win()],
    );
    const s = summarisePosition(rows);
    expect(s.valueAtRiskLosing).toBe(2000);
    expect(s.valueAtRiskUnmeasured).toBe(1200);
    expect(s.totalValueAtRisk).toBe(3200);
  });
});

describe('a period is judged on the balance of its stays, not only the worst', () => {
  /**
   * The live case that forced this. On 2026-09-01 Fall had 8 of 12 measured stays more than 10% too
   * CHEAP, 3 in band and 1 dearer - and the badge read "You cost more" off that one, next to a
   * recommendation to RAISE the price. The owner asked, reasonably, what was going on.
   */
  const many = (gaps: number[]) => gaps.map((g) => win({ gapPct: g, verdict: g > 0 ? 'losing' : 'healthy' }));

  it('calls a mostly-too-cheap period too low, even with one dearer stay', () => {
    const [r] = buildPeriodPositions([period()], days([true, true, true, true]),
      many([0.09, -0.15, -0.17, -0.19, -0.25, -0.14, -0.13]));
    expect(r.verdict).toBe('overshoot');
    expect(r.dearerCount).toBe(1);
    expect(r.tooCheapCount).toBe(6);
    expect(r.action).toMatch(/giving away more than you need/i);
  });

  it('still calls it losing when a third or more of the stays are dearer', () => {
    const [r] = buildPeriodPositions([period()], days([true, true, true, true]),
      many([0.09, 0.12, -0.15, -0.17, -0.19, -0.20]));
    expect(r.verdict).toBe('losing');
    expect(r.dearerCount).toBe(2);
  });

  it('reports the mix in the action, so one stay cannot speak for the period', () => {
    const [r] = buildPeriodPositions([period()], days([true, true, true, true]),
      many([0.09, 0.12, -0.15, -0.17, -0.19, -0.20]));
    expect(r.action).toMatch(/2 cost more than a platform and 4 are more than 10% under/i);
  });
});

/**
 * Attribution, using the case that exposed it.
 *
 * On 2026-09-01 the board reported "1 Decembrie: nobody has ever compared this period against the
 * platforms" while the store held a fully measured 27 Nov -> 2 Dec window: three channels, four
 * party sizes. The stay checks in on Late Fall's last day and sleeps four of its five nights in
 * 1 Decembrie, and the board assigned it on check-in alone.
 */
describe('a stay belongs to the period that prices most of its nights', () => {
  const lateFall = { id: 'lf', name: 'Late Fall', startDate: '2026-11-02', endDate: '2026-11-27',
    tier: 'low', minStay: 2, fixedNightPrice: null };
  const dec1 = { id: 'd1', name: '1 Decembrie', startDate: '2026-11-28', endDate: '2026-12-01',
    tier: 'high', minStay: 2, fixedNightPrice: null };
  const nights = (from: string, n: number, price = 620) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date(`${from}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i);
      return { date: d.toISOString().slice(0, 10), available: true, price, isWeekend: false };
    });
  // 27 Nov -> 2 Dec: one night in Late Fall, four in 1 Decembrie.
  const straddler = win({ checkIn: '2026-11-27', checkOut: '2026-12-02', nights: 5,
    gapPct: -0.14, verdict: 'overshoot' });

  it('gives the stay to the period holding four of its five nights', () => {
    const rows = buildPeriodPositions([lateFall, dec1], nights('2026-11-02', 30), [straddler]);
    expect(rows.find((r) => r.name === '1 Decembrie')!.measuredWindows).toBe(1);
    expect(rows.find((r) => r.name === '1 Decembrie')!.verdict).not.toBe('unmeasured');
  });

  it('stops crediting it to the period that prices one night of it', () => {
    const rows = buildPeriodPositions([lateFall, dec1], nights('2026-11-02', 30), [straddler]);
    const lf = rows.find((r) => r.name === 'Late Fall')!;
    expect(lf.measuredWindows).toBe(0);
    expect(lf.verdict).toBe('unmeasured');
  });

  it('never puts one stay in two periods', () => {
    const rows = buildPeriodPositions([lateFall, dec1], nights('2026-11-02', 30), [straddler]);
    expect(rows.reduce((s, r) => s + r.measuredWindows, 0)).toBe(1);
  });

  it('falls back to the check-in when the split is even, rather than losing the stay', () => {
    // 26 Nov -> 30 Nov, 2 nights each side. Neither holds a majority.
    const even = win({ checkIn: '2026-11-26', checkOut: '2026-11-30', nights: 4, gapPct: 0.05 });
    const rows = buildPeriodPositions([lateFall, dec1], nights('2026-11-02', 30), [even]);
    expect(rows.find((r) => r.name === 'Late Fall')!.measuredWindows).toBe(1);
    expect(rows.reduce((s, r) => s + r.measuredWindows, 0)).toBe(1);
  });

  it('leaves a stay that sits wholly inside one period exactly where it was', () => {
    const inside = win({ checkIn: '2026-11-10', checkOut: '2026-11-13', nights: 3, gapPct: 0.05 });
    const rows = buildPeriodPositions([lateFall, dec1], nights('2026-11-02', 30), [inside]);
    expect(rows.find((r) => r.name === 'Late Fall')!.measuredWindows).toBe(1);
    expect(rows.find((r) => r.name === '1 Decembrie')!.measuredWindows).toBe(0);
  });
});
