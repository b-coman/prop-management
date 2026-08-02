/** @jest-environment node */

import { computeVerdict, computeCaveats } from '../adOutcomes';

describe('computeVerdict', () => {
  it('flags a rejected ad regardless of delivery', () => {
    expect(computeVerdict('active', 'REJECTED', { spend: 5, impressions: 100, clicks: 2 }, { bookings: 0 })).toBe('rejected');
  });
  it('is never-activated when a non-active campaign never delivered', () => {
    expect(computeVerdict('approved', undefined, { spend: 0, impressions: 0, clicks: 0 }, { bookings: 0 })).toBe('never-activated');
  });
  it('is no-delivery when an active campaign never delivered', () => {
    expect(computeVerdict('active', 'PENDING_REVIEW', { spend: 0, impressions: 0, clicks: 0 }, { bookings: 0 })).toBe('no-delivery');
  });
  it('is converted when a utm booking is attributed', () => {
    expect(computeVerdict('active', 'ACTIVE', { spend: 50, impressions: 5000, clicks: 100 }, { bookings: 1 })).toBe('converted');
  });
  it('is clicked-no-booking when it delivered clicks but no booking', () => {
    expect(computeVerdict('paused', 'ACTIVE', { spend: 50, impressions: 5000, clicks: 100 }, { bookings: 0 })).toBe('clicked-no-booking');
  });
});

describe('computeCaveats', () => {
  it('always carries the two attribution-honesty caveats', () => {
    const c = computeCaveats({ spend: 100, metaPurchases: 2, utmBookings: 1, source: 'opportunity-engine' });
    expect(c.some((x) => x.includes('first-party FLOOR'))).toBe(true);
    expect(c.some((x) => x.includes('Meta-MODELED'))).toBe(true);
    expect(c.some((x) => x.includes('meta-purchases≠utm-bookings'))).toBe(true); // 2 ≠ 1
  });
  it('flags a low-spend anecdote', () => {
    expect(computeCaveats({ spend: 30, metaPurchases: 0, utmBookings: 0, source: 'opportunity-engine' }).some((x) => x.includes('low-spend'))).toBe(true);
  });
  it('flags a manual compose with no framing metadata', () => {
    expect(computeCaveats({ spend: 100, metaPurchases: 0, utmBookings: 0, source: 'manual' }).some((x) => x.includes('manual compose'))).toBe(true);
  });
});
