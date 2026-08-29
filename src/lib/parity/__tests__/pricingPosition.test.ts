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
    expect(r.action).toMatch(/no reason for a guest to prefer/i);
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
    expect(r.action).toMatch(/never measured/i);
  });
  it('separates unmeasured money from losing money in the summary', () => {
    const rows = buildPeriodPositions(
      [period({ id: 'a' }), period({ id: 'b', startDate: '2026-10-05', endDate: '2026-10-09' })],
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
