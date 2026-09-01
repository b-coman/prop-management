/** @jest-environment node */

/**
 * What a position may and may not claim.
 *
 * Most of these pin a REFUSAL: below three quotes there is no band and no rank, the direct price is
 * never ranked, a comparable that did not quote is never dropped, and quality never enters the price.
 * Each of those is a place where the flattering answer is easy and wrong.
 */
import { buildPosition, REVIEW_FLOOR, CONFIDENCE, type CompetitorQuote } from '../position';

const NOW = new Date('2026-09-01T12:00:00Z');
const AT = '2026-09-01T10:00:00Z';

const q = (id: string, total: number | null, over: Partial<CompetitorQuote> = {}): CompetitorQuote => ({
  listingId: id, displayName: id, status: total === null ? 'unavailable' : 'captured',
  guestTotal: total, capturedAt: AT, rating: null, reviewCount: null, largestUnit: 6, ...over,
});

const base = {
  checkIn: '2026-10-24', checkOut: '2026-10-28', nights: 4, guests: 3,
  partyLabel: '2a+1c', channel: 'airbnb',
  ourChannelPrice: 2369, ourDirectPrice: 2283,
  outOfSet: [], now: NOW,
};

describe('the band and the rank', () => {
  it('ranks us among the comparables that actually quoted', () => {
    const p = buildPosition({ ...base, quotes: [q('a', 2438), q('b', 2702), q('c', 4594), q('d', 5705)] });
    expect(p.confidence).toBe('solid');
    expect(p.band).toEqual({ min: 2438, median: (2702 + 4594) / 2, max: 5705 });
    expect(p.rank).toEqual({ position: 1, of: 5 });
    expect(p.ladder[0].isUs).toBe(true);
  });

  it('puts us where we actually fall, not at the top by default', () => {
    const p = buildPosition({ ...base, ourChannelPrice: 4000,
      quotes: [q('a', 2438), q('b', 2702), q('c', 4594), q('d', 5705)] });
    expect(p.rank).toEqual({ position: 3, of: 5 });
  });
});

describe('it refuses to rank a thin sample', () => {
  it.each([0, 1, 2])('gives no band and no rank on %i quotes', (n) => {
    const quotes = Array.from({ length: n }, (_, i) => q(`x${i}`, 3000 + i));
    const p = buildPosition({ ...base, quotes });
    expect(p.confidence).toBe('none');
    expect(p.band).toBeNull();
    expect(p.rank).toBeNull();
    expect(p.notes.join(' ')).toMatch(/no band and no rank/);
  });

  it(`calls ${CONFIDENCE.indicative} quotes indicative and says so`, () => {
    const p = buildPosition({ ...base, quotes: [q('a', 2438), q('b', 2702), q('c', 4594)] });
    expect(p.confidence).toBe('indicative');
    expect(p.band).not.toBeNull();
    expect(p.notes.join(' ')).toMatch(/indicative, not settled/);
  });

  it('still reports the individual readings when it refuses to rank them', () => {
    const p = buildPosition({ ...base, quotes: [q('a', 2438)] });
    expect(p.ladder.map((r) => r.name)).toEqual(['US', 'a']);
  });
});

describe('the direct price is a reference, never a rank (C8)', () => {
  it('never places direct in the ladder, however cheap it is', () => {
    const p = buildPosition({ ...base, ourDirectPrice: 1,
      quotes: [q('a', 2438), q('b', 2702), q('c', 4594), q('d', 5705)] });
    expect(p.ladder.some((r) => r.total === 1)).toBe(false);
    expect(p.ourDirectPrice).toBe(1);
    expect(p.rank!.of).toBe(5);   // four comparables + our channel price, not direct
  });
});

describe('a comparable that did not quote is never dropped', () => {
  it('carries every silent listing with its reason', () => {
    const p = buildPosition({ ...base, quotes: [
      q('a', 2438),
      q('sold', null, { status: 'unavailable', reason: 'no availability for 24-28 Oct' }),
      q('small', null, { status: 'refused', reason: 'every available unit is capped below 3' }),
    ]});
    expect(p.silent.map((s) => s.status).sort()).toEqual(['refused', 'unavailable']);
    expect(p.silent.find((s) => s.status === 'refused')!.reason).toMatch(/capped below 3/);
    expect(p.sample).toMatchObject({ quoted: 1, asked: 3 });
  });

  it('says "not sellable", never "sold", on a single reading', () => {
    const p = buildPosition({ ...base, quotes: [
      q('a', 2438), q('b', 2702), q('c', 3000),
      q('sold', null, { status: 'unavailable', reason: 'no availability' }),
    ]});
    const note = p.notes.join(' ');
    expect(note).toMatch(/not sellable/);
    expect(note).not.toMatch(/\bsold out\b/);
    expect(note).toMatch(/evidence of selling only if an earlier reading had it priced/);
  });

  it('reports out-of-set comparables as a finding, not a gap', () => {
    const p = buildPosition({ ...base,
      quotes: [q('a', 2438), q('b', 2702), q('c', 3000)],
      outOfSet: [{ listingId: 'tiny', displayName: 'Tiny', fit: { kind: 'out-of-set', reason: 'no single unit takes 3' } }],
    });
    expect(p.outOfSet).toEqual([{ listingId: 'tiny', name: 'Tiny', why: 'no single unit takes 3' }]);
    expect(p.notes.join(' ')).toMatch(/competition you do not face/);
    // and it must NOT count against the sample
    expect(p.sample.asked).toBe(3);
  });
});

describe('quality sits beside price, and only above the review floor', () => {
  const cheaperBetter = (reviews: number) =>
    q('rival', 2000, { rating: 4.99, reviewCount: reviews });

  it('flags a cheaper comparable that outranks us on BOTH rating and reviews', () => {
    const p = buildPosition({ ...base, ourRating: 4.8, ourReviewCount: 50,
      quotes: [cheaperBetter(200), q('b', 2702), q('c', 4594)] });
    expect(p.flags.join(' ')).toMatch(/priced above rival/);
  });

  it(`stays silent below the ${REVIEW_FLOOR}-review floor — a 5.0 from a handful outranks nothing`, () => {
    const p = buildPosition({ ...base, ourRating: 4.8, ourReviewCount: 50,
      quotes: [cheaperBetter(3), q('b', 2702), q('c', 4594)] });
    expect(p.flags).toEqual([]);
  });

  it('does not flag a comparable that is dearer, however good', () => {
    const p = buildPosition({ ...base, ourRating: 4.8, ourReviewCount: 50,
      quotes: [q('rival', 9000, { rating: 5, reviewCount: 500 }), q('b', 2702), q('c', 4594)] });
    expect(p.flags).toEqual([]);
  });

  it('never folds rating into the price or the band', () => {
    const withQuality = buildPosition({ ...base, ourRating: 4.8, ourReviewCount: 50,
      quotes: [q('a', 2438, { rating: 5, reviewCount: 900 }), q('b', 2702), q('c', 4594), q('d', 5705)] });
    const without = buildPosition({ ...base,
      quotes: [q('a', 2438), q('b', 2702), q('c', 4594), q('d', 5705)] });
    expect(withQuality.band).toEqual(without.band);
    expect(withQuality.rank).toEqual(without.rank);
  });
});

describe('staleness is part of the reading', () => {
  it('reports the age of the oldest quote in the sample', () => {
    const p = buildPosition({ ...base, quotes: [
      q('a', 2438),
      q('b', 2702, { capturedAt: '2026-08-20T10:00:00Z' }),
      q('c', 4594), q('d', 5705),
    ]});
    expect(p.sample.oldestAgeDays).toBe(12);
  });
});

describe('a programme discount is part of the offer, not a measurement flaw', () => {
  // Owner, 2026-09-02: signed in with one account throughout, these ARE the prices that guest sees —
  // ours discounted because our property offers Genius, others not because theirs do not. Calling it
  // "not like-for-like" understated a real advantage. What survives is a note about WHO the ranking
  // is for, which adjusts nothing.
  const q3 = [q('a', 3000), q('b', 4000), q('c', 5000)];

  it('says who the ranking is for, as a NOTE and never as a defect', () => {
    const p = buildPosition({ ...base, channel: 'booking.com', ourProgramApplied: true, quotes: q3 });
    expect(p.notes.join(' ')).toMatch(/as a signed-in member sees it/);
    expect(p.notes.join(' ')).toMatch(/3 of 3 comparables' prices do not/);
    // and it is NOT a flag — it is not a fault
    expect(p.flags.join(' ')).not.toMatch(/signed-in|loyalty/);
  });

  it('stays silent when the whole field carries it too', () => {
    const p = buildPosition({ ...base, channel: 'booking.com', ourProgramApplied: true,
      quotes: q3.map((x) => ({ ...x, programApplied: true })) });
    expect(p.notes.join(' ')).not.toMatch(/signed-in member/);
  });

  it('stays silent when ours carries no programme discount', () => {
    const p = buildPosition({ ...base, channel: 'airbnb', ourProgramApplied: false, quotes: q3 });
    expect(p.notes.join(' ')).not.toMatch(/signed-in member/);
  });

  it('does NOT adjust the band or the rank — it only says who it is for', () => {
    const flagged = buildPosition({ ...base, ourProgramApplied: true, quotes: q3 });
    const plain = buildPosition({ ...base, ourProgramApplied: false, quotes: q3 });
    expect(flagged.band).toEqual(plain.band);
    expect(flagged.rank).toEqual(plain.rank);
  });
});
