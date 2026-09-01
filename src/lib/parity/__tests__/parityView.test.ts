/**
 * The view model decides what the owner sees, so its job is to be conservative in exactly the places
 * where being wrong costs money: the Airbnb correction, partial coverage, and staleness.
 */
import { buildParityWindow, summarise, STANDING_GUEST_DISCOUNT, type ParityViewOptions } from '../parityView';

const OPTS: ParityViewOptions = {
  now: new Date('2026-08-29T12:00:00Z'),
  freshnessDays: 42,
  targetDiscountPct: 0.10,
  direct: { paymentCostPct: 0.029 },
  economics: {
    airbnb: { channel: 'airbnb', commissionPct: 0.18755 },
    'booking.com': { channel: 'booking.com', commissionPct: 0.23 },
  },
  channelsInScope: ['direct', 'airbnb', 'booking.com'],
};
const fresh = '2026-08-29T09:00:00Z';

const win = (obs: any[]) => buildParityWindow(
  { checkIn: '2026-10-24', checkOut: '2026-10-28', nights: 4, guests: 3, observations: obs }, OPTS);

describe('the Airbnb correction is applied, and declared', () => {
  it('compares against the corrected price, not the captured one', () => {
    const v = win([
      { channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh },
      { channel: 'airbnb', status: 'captured', guestTotal: 2369, capturedAt: fresh },
      { channel: 'booking.com', status: 'captured', guestTotal: 2965, capturedAt: fresh },
    ]);
    const abb = v.cells.find((c) => c.channel === 'airbnb')!;
    expect(abb.captured).toBe(2369);
    expect(abb.effective).toBe(Math.round(2369 * (1 - STANDING_GUEST_DISCOUNT.airbnb)));
    expect(abb.corrected).toBe(true);
    expect(v.best!.channel).toBe('airbnb');
  });

  it('turns a window that LOOKS healthy into the losing one it is', () => {
    // Captured: direct 2281 vs airbnb 2369 reads as direct 3.7% cheaper. Corrected, direct is dearer.
    const v = win([
      { channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh },
      { channel: 'airbnb', status: 'captured', guestTotal: 2369, capturedAt: fresh },
      { channel: 'booking.com', status: 'captured', guestTotal: 2965, capturedAt: fresh },
    ]);
    expect(v.gapPct!).toBeGreaterThan(0);
    expect(v.verdict).toBe('losing');
  });

  it('says out loud that the correction was applied', () => {
    const v = win([
      { channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh },
      { channel: 'airbnb', status: 'captured', guestTotal: 2369, capturedAt: fresh },
      { channel: 'booking.com', status: 'captured', guestTotal: 2965, capturedAt: fresh },
    ]);
    expect(v.warnings.join(' ')).toMatch(/standing guest discount/i);
  });
});

describe('a verdict is never given on a subset', () => {
  it('reads partial when a channel was never captured', () => {
    const v = win([
      { channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh },
      { channel: 'airbnb', status: 'captured', guestTotal: 2369, capturedAt: fresh },
    ]);
    expect(v.verdict).toBe('partial');
  });

  it('does NOT read partial when the missing channel refused — that is an answer', () => {
    const v = win([
      { channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh },
      { channel: 'airbnb', status: 'refused', guestTotal: null, reason: '4-night minimum', capturedAt: fresh },
      { channel: 'booking.com', status: 'captured', guestTotal: 2965, capturedAt: fresh },
    ]);
    expect(v.verdict).not.toBe('partial');
    expect(v.warnings.join(' ')).toMatch(/will not sell/);
  });

  it('reads unknown when nothing usable exists', () => {
    const v = win([{ channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh }]);
    expect(v.verdict).toBe('unknown');
    expect(v.best).toBeNull();
  });
});

describe('stale readings do not masquerade as current', () => {
  it('excludes a reading past the freshness budget and marks the row', () => {
    const old = '2026-06-01T09:00:00Z';   // ~89 days
    const v = win([
      { channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh },
      { channel: 'airbnb', status: 'captured', guestTotal: 2369, capturedAt: old },
      { channel: 'booking.com', status: 'captured', guestTotal: 2965, capturedAt: fresh },
    ]);
    const abb = v.cells.find((c) => c.channel === 'airbnb')!;
    expect(abb.stale).toBe(true);
    expect(v.best!.channel).toBe('booking.com');    // the stale Airbnb price is not used
    expect(v.verdict).toBe('partial');
  });
});

describe('the floor and the target are what the owner acts on', () => {
  const v = win([
    { channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh },
    { channel: 'airbnb', status: 'captured', guestTotal: 2369, capturedAt: fresh },
    { channel: 'booking.com', status: 'captured', guestTotal: 2965, capturedAt: fresh },
  ]);

  it('never recommends a price below the floor', () => {
    expect(v.targetPrice!).toBeGreaterThanOrEqual(v.floor!);
  });

  it('the floor is below the current direct price when there is room to cut', () => {
    expect(v.floor!).toBeLessThan(v.direct!);
  });

  it('reports the per-booking consequence of moving to target', () => {
    expect(v.upliftAtTarget).not.toBeNull();
    expect(v.upliftAtTarget!).toBeLessThan(0);   // moving DOWN to win the booking costs margin per booking
  });

  it('flags a non-refundable OTA plan as a different product', () => {
    const nr = win([
      { channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh },
      { channel: 'airbnb', status: 'captured', guestTotal: 2369, capturedAt: fresh },
      { channel: 'booking.com', status: 'captured', guestTotal: 2965, ratePlan: 'non-refundable', capturedAt: fresh },
    ]);
    expect(nr.warnings.join(' ')).toMatch(/NON-REFUNDABLE/);
  });
});

describe('summarise', () => {
  it('counts every verdict and does not invent a total uplift', () => {
    const a = win([
      { channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh },
      { channel: 'airbnb', status: 'captured', guestTotal: 2369, capturedAt: fresh },
      { channel: 'booking.com', status: 'captured', guestTotal: 2965, capturedAt: fresh },
    ]);
    const b = win([{ channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh }]);
    const s = summarise([a, b]);
    expect(s.total).toBe(2);
    expect(s.losing + s.thin + s.healthy + s.overshoot + s.partial + s.unknown).toBe(2);
    // Per-booking uplift is per booking; summing it across windows would invent revenue.
    expect(s.totalUpliftAtTarget).toBe(0);
  });
});

/**
 * A reading can be a day old and still be fiction. The board judged freshness purely by age, so on
 * 2026-09-01 - the day the owner moved Booking's weekly discount, reactivated and raised its 4-day
 * rate and set a 4-night minimum - six readings taken the previous afternoon counted as current.
 * `parity-audit` could already see they were superseded; the screen could not, and the two views of
 * the same store disagreed.
 */
describe('a reading that predates the owner\'s own settings change', () => {
  const CHANGED: ParityViewOptions = {
    ...OPTS,
    settingsChanges: {
      'booking.com': { date: '2026-08-29', fromNights: 4, note: 'Weekly 30%->25%; 4-day rate raised' },
    },
  };
  const w = (obs: any[], nights = 4) => buildParityWindow(
    { checkIn: '2026-10-24', checkOut: '2026-10-28', nights, guests: 3, observations: obs }, CHANGED);

  const yesterday = '2026-08-28T16:00:00Z';

  it('is set aside even though it reads as zero days old', () => {
    const v = w([
      { channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh },
      { channel: 'booking.com', status: 'captured', guestTotal: 2965, capturedAt: yesterday },
    ]);
    const bk = v.cells.find((c) => c.channel === 'booking.com')!;
    expect(bk.ageDays).toBe(0);   // 20 hours ago: as fresh as the age test can measure
    expect(bk.stale).toBe(true);
    // It must not become the price the board steers by.
    expect(v.best?.channel).not.toBe('booking.com');
  });

  it('says WHY, so the reader knows to re-probe rather than to wait for it to age out', () => {
    const v = w([
      { channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh },
      { channel: 'booking.com', status: 'captured', guestTotal: 2965, capturedAt: yesterday },
    ]);
    expect(v.warnings.some((x) => /predates your own change of 2026-08-29/.test(x))).toBe(true);
  });

  it('leaves shorter stays alone, because the change did not reach them', () => {
    // The 4-day rate and the weekly bite from 4 nights up. A 2-night reading is untouched by it.
    const v = buildParityWindow(
      { checkIn: '2026-10-24', checkOut: '2026-10-26', nights: 2, guests: 3, observations: [
        { channel: 'direct', status: 'captured', guestTotal: 1100, capturedAt: fresh },
        { channel: 'booking.com', status: 'captured', guestTotal: 1400, capturedAt: yesterday },
      ] }, CHANGED);
    const bk = v.cells.find((c) => c.channel === 'booking.com')!;
    expect(bk.stale).toBe(false);
    expect(bk.effective).toBe(1400);
  });

  it('does not touch a channel with no recorded change', () => {
    const v = w([
      { channel: 'direct', status: 'captured', guestTotal: 2281, capturedAt: fresh },
      { channel: 'airbnb', status: 'captured', guestTotal: 2369, capturedAt: yesterday },
    ]);
    expect(v.cells.find((c) => c.channel === 'airbnb')!.stale).toBe(false);
  });
});
