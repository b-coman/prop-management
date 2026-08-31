/**
 * The real ladders, as recorded from the owner's own platform settings on 2026-09-01.
 * These fixtures are ground truth, not invention - the whole point of the comparison is that it
 * reflects what the platforms actually do rather than what captured prices seem to imply.
 */
import { compareLadders, ladderAdvice, discountAt, type LadderRung } from '../ladderCompare';

const AIRBNB: LadderRung[] = [
  { nightsThreshold: 4, discountPercentage: 10, label: 'Trip length, 4 nights' },
  { nightsThreshold: 5, discountPercentage: 15, label: 'Trip length, 5 nights' },
  { nightsThreshold: 7, discountPercentage: 20, label: 'Weekly' },
  { nightsThreshold: 28, discountPercentage: 35, label: 'Monthly' },
];
const BOOKING: LadderRung[] = [
  { nightsThreshold: 4, discountPercentage: 5, label: '4 day stay rate' },
  { nightsThreshold: 7, discountPercentage: 30, label: 'Weekly rate' },
  { nightsThreshold: 28, discountPercentage: 45, label: 'Monthly rate', nonRefundable: true },
];
const DIRECT: LadderRung[] = [
  { nightsThreshold: 3, discountPercentage: 10 },
  { nightsThreshold: 4, discountPercentage: 15 },
  { nightsThreshold: 7, discountPercentage: 25 },
  { nightsThreshold: 14, discountPercentage: 30 },
  { nightsThreshold: 28, discountPercentage: 35 },
];
const platforms = [{ channelId: 'airbnb', ladder: AIRBNB }, { channelId: 'booking.com', ladder: BOOKING }];

describe('discountAt', () => {
  it('takes the deepest rung at or below the stay length', () => {
    expect(discountAt(3, AIRBNB)).toBeNull();
    expect(discountAt(4, AIRBNB)?.discountPercentage).toBe(10);
    expect(discountAt(6, AIRBNB)?.discountPercentage).toBe(15);
    expect(discountAt(30, AIRBNB)?.discountPercentage).toBe(35);
  });
});

describe('compareLadders', () => {
  const rows = compareLadders(DIRECT, platforms);
  const at = (n: number) => rows.find((r) => r.nights === n)!;

  it('finds the 3-night giveaway: he discounts where neither platform does', () => {
    expect(at(3).directPct).toBe(10);
    expect(at(3).bestPlatformPct).toBe(0);
    expect(at(3).edgePp).toBe(10);
  });

  it('finds where Booking structurally undercuts him on week-long stays', () => {
    expect(at(7).bestPlatformPct).toBe(30);
    expect(at(7).bestPlatformId).toBe('booking.com');
    expect(at(7).directPct).toBe(25);
    expect(at(7).edgePp).toBe(-5);
  });

  it('never treats a non-refundable rate as the one to match', () => {
    // Booking's monthly is 45% but non-refundable, so Airbnb's 35% is the comparable best.
    expect(at(28).byChannel['booking.com'].pct).toBe(45);
    expect(at(28).byChannel['booking.com'].nonRefundable).toBe(true);
    expect(at(28).bestPlatformPct).toBe(35);
    expect(at(28).bestPlatformId).toBe('airbnb');
  });

  it('shows a rung where the ladders already agree', () => {
    expect(at(5).directPct).toBe(15);
    expect(at(5).bestPlatformPct).toBe(15);
    expect(at(5).edgePp).toBe(0);
  });
});

describe('ladderAdvice', () => {
  const advice = ladderAdvice(compareLadders(DIRECT, platforms));

  it('leads with the biggest mismatch', () => {
    expect(advice[0].nights).toBe(3);
    expect(advice[0].text).toContain('no platform discounts at all');
  });

  it('names the channel that undercuts him', () => {
    const seven = advice.find((a) => a.nights === 7)!;
    expect(seven.text).toContain('booking.com');
  });

  it('says nothing when the ladders already match', () => {
    expect(ladderAdvice(compareLadders(AIRBNB, [{ channelId: 'airbnb', ladder: AIRBNB }]))).toHaveLength(0);
  });
});
