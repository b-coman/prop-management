import { parseMinStay, readMinStay, compareMinStay } from '../minStay';

describe('parseMinStay — every phrasing the channels actually use', () => {
  const cases: Array<[string, number | null]> = [
    ['Minimum stay is 4 nights', 4],                                        // Airbnb, live 2026-08-31
    ['You need to stay 3+ nights to book your selected dates', 3],          // Booking, live 2026-08-31
    ['4-night minimum', 4],
    ['minimum of 5 nights', 5],
    ['min. stay 3 nights', 3],
    ['Airbnb min stay 4 nights', 4],
    ['no availability for these dates', null],
    ['', null],
  ];
  it.each(cases)('%s -> %s', (text, expected) => {
    expect(parseMinStay(text)).toBe(expected);
  });

  it('rejects an implausible number rather than trusting it', () => {
    expect(parseMinStay('minimum of 400 nights')).toBeNull();
  });
});

describe('readMinStay', () => {
  it('takes the LONGEST stated requirement, because the constraint varies inside a range', () => {
    const r = readMinStay([
      { channel: 'airbnb', status: 'refused', nights: 2, reason: 'Minimum stay is 3 nights' },
      { channel: 'airbnb', status: 'refused', nights: 3, reason: 'Minimum stay is 4 nights' },
    ]);
    expect(r.required).toBe(4);
  });

  it('records the shortest stay actually sold as an upper bound', () => {
    const r = readMinStay([
      { channel: 'booking.com', status: 'captured', nights: 5 },
      { channel: 'booking.com', status: 'captured', nights: 3 },
    ]);
    expect(r).toEqual({ required: null, soldAt: 3 });
  });
});

describe('compareMinStay', () => {
  it('flags a platform that refuses a stay we would sell', () => {
    // Vacanta Toamna, live: direct sells 2 nights, Airbnb refuses under 4.
    expect(compareMinStay(2, { required: 4, soldAt: null })).toBe('channel-stricter');
  });

  it('flags a platform selling shorter than our own minimum, even with nothing stated', () => {
    expect(compareMinStay(3, { required: null, soldAt: 2 })).toBe('channel-looser');
  });

  it('says aligned only when the numbers match', () => {
    expect(compareMinStay(3, { required: 3, soldAt: null })).toBe('aligned');
  });

  it('does not guess when the channel never revealed a requirement', () => {
    expect(compareMinStay(2, { required: null, soldAt: 5 })).toBe('unknown');
    expect(compareMinStay(null, { required: 4, soldAt: null })).toBe('unknown');
  });
});
