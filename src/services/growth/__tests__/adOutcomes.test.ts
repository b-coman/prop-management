/** @jest-environment node */

import { computeVerdict, computeCaveats, utmIdsForCampaign } from '../adOutcomes';

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

describe('utmIdsForCampaign', () => {
  it('is just the doc id when the ads carry nothing foreign', () => {
    expect(utmIdsForCampaign('abc', [])).toEqual(['abc']);
    expect(utmIdsForCampaign('abc', undefined)).toEqual(['abc']);
  });

  it('includes the id an Ads-Manager duplicate actually carries', () => {
    // The live case: spend on meta_120252194647430114, clicks tagged OU3kBSXI2FkiJxxp7vkr.
    expect(utmIdsForCampaign('meta_120252194647430114', ['OU3kBSXI2FkiJxxp7vkr']))
      .toEqual(['meta_120252194647430114', 'OU3kBSXI2FkiJxxp7vkr']);
  });

  it('never repeats the doc id, so the Firestore `in` clause stays valid', () => {
    expect(utmIdsForCampaign('abc', ['abc', 'abc'])).toEqual(['abc']);
  });

  it('drops blanks rather than querying for an empty campaign', () => {
    expect(utmIdsForCampaign('abc', ['', '   '])).toEqual(['abc']);
  });

  it('caps at Firestore\'s 30-value `in` limit', () => {
    const many = Array.from({ length: 40 }, (_, i) => `id${i}`);
    expect(utmIdsForCampaign('abc', many)).toHaveLength(30);
  });
});
