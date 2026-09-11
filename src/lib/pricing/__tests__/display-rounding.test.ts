/**
 * The invariant is one line long and it is the whole point: the displayed lines sum to the
 * displayed total, in every currency, for every stay.
 *
 * The real case that started this: a 3-night stay priced 2267.4 + 200 = 2467.4 RON, shown in euros,
 * where the drawer read 455 + 40 with a total of 496.
 */
import { reconcileRoundedAmounts } from '../display-rounding';

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

describe('reconcileRoundedAmounts', () => {
  it('makes the real euro case add up', () => {
    // 2267.4 RON accommodation + 200 RON cleaning at ~4.97 RON/EUR.
    const accommodation = 2267.4 / 4.97;
    const cleaning = 200 / 4.97;
    const total = 2467.4 / 4.97;

    const lines = reconcileRoundedAmounts([accommodation, cleaning], total);
    expect(sum(lines)).toBe(Math.round(total));
  });

  it('leaves RON alone, where the figures already reconciled', () => {
    // No adjustment should be invented when none is needed.
    expect(reconcileRoundedAmounts([2267.4, 200], 2467.4)).toEqual([2267, 200]);
    expect(sum([2267, 200])).toBe(Math.round(2467.4));
  });

  it('holds across a long stay billed night by night', () => {
    // The desktop panel renders one line per night, so the drift compounds. Fourteen nights at a
    // rate that does not divide cleanly, plus two fees.
    const nights = Array.from({ length: 14 }, () => 823.7 / 4.97);
    const fees = [200 / 4.97, 75 / 4.97];
    const total = (823.7 * 14 + 200 + 75) / 4.97;

    const lines = reconcileRoundedAmounts([...nights, ...fees], total);
    expect(sum(lines)).toBe(Math.round(total));
    expect(lines).toHaveLength(16);
  });

  it('keeps every line within one unit of its true value', () => {
    // The reason for largest-remainder rather than dumping the residual on the biggest line.
    const amounts = [100.6, 100.6, 100.6, 100.6, 100.6];
    const lines = reconcileRoundedAmounts(amounts, 503);
    lines.forEach((v, i) => expect(Math.abs(v - amounts[i])).toBeLessThan(1));
    expect(sum(lines)).toBe(503);
  });

  it('handles a discount as a negative line', () => {
    const lines = reconcileRoundedAmounts([455.4, 40.2, -49.6], 446);
    expect(sum(lines)).toBe(446);
    expect(lines[2]).toBeLessThan(0);
  });

  it('absorbs a residual when the total is larger than the lines shown', () => {
    // A caller that does not display every component still gets lines that reconcile.
    const lines = reconcileRoundedAmounts([100.2, 50.3], 160);
    expect(sum(lines)).toBe(160);
  });

  it('absorbs a negative residual too', () => {
    const lines = reconcileRoundedAmounts([100.2, 50.3], 140);
    expect(sum(lines)).toBe(140);
  });

  it('is deterministic for equal remainders', () => {
    const a = reconcileRoundedAmounts([10.5, 10.5, 10.5], 32);
    const b = reconcileRoundedAmounts([10.5, 10.5, 10.5], 32);
    expect(a).toEqual(b);
    expect(sum(a)).toBe(32);
  });

  it('handles a single line', () => {
    expect(reconcileRoundedAmounts([496.4], 496.4)).toEqual([496]);
  });

  it('returns nothing for no lines', () => {
    expect(reconcileRoundedAmounts([], 0)).toEqual([]);
  });

  it('holds over many random breakdowns', () => {
    // The invariant should not depend on the numbers I happened to think of.
    for (let n = 0; n < 300; n++) {
      const count = 1 + (n % 8);
      const amounts = Array.from({ length: count }, (_, i) => ((n * 37 + i * 13) % 900) + 0.37 * i);
      const total = sum(amounts);
      expect(sum(reconcileRoundedAmounts(amounts, total))).toBe(Math.round(total));
    }
  });
});
