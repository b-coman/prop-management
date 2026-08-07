/** @jest-environment node */

import {
  CHANNEL_IDS, OTA_CHANNEL_IDS, normalizeChannel, isChannelId, isOtaChannel, channelDocId,
  CHANNEL_LABELS, type ChannelId,
} from '../channels';

describe('the vocabulary itself', () => {
  it('has no duplicates', () => {
    expect(new Set(CHANNEL_IDS).size).toBe(CHANNEL_IDS.length);
  });

  it('labels every id', () => {
    CHANNEL_IDS.forEach((id) => expect(CHANNEL_LABELS[id]).toBeTruthy());
  });

  it('treats every channel except direct as an OTA', () => {
    expect(OTA_CHANNEL_IDS).not.toContain('direct');
    expect(OTA_CHANNEL_IDS.length).toBe(CHANNEL_IDS.length - 1);
    expect(isOtaChannel('direct')).toBe(false);
    expect(isOtaChannel('airbnb')).toBe(true);
  });
});

/**
 * These are not invented cases. Every string here was read out of production on 2026-08-07, and the
 * counts are the real document counts. If normalisation drops one of these, real revenue history
 * disappears from whatever is being totalled.
 */
describe('the spellings that actually exist in production', () => {
  const LIVE = [
    // bookings.source (293 docs)
    { raw: 'booking.com', from: 'bookings.source ×143', expect: 'booking.com' },
    { raw: 'airbnb', from: 'bookings.source ×114', expect: 'airbnb' },
    { raw: 'direct', from: 'bookings.source ×33', expect: 'direct' },
    { raw: 'vrbo', from: 'bookings.source ×2', expect: 'vrbo' },
    { raw: 'travelmint', from: 'bookings.source ×1 — TYPO, missing an i', expect: 'travelminit' },
    // icalFeeds.name (7 docs)
    { raw: 'Travelminit', from: 'icalFeeds.name — capitalised', expect: 'travelminit' },
    // channelPricing.channels[].channel + channelPriceObservations.channel
    { raw: 'booking.com', from: 'channelPriceObservations ×17', expect: 'booking.com' },
  ] as const;

  LIVE.forEach(({ raw, from, expect: want }) => {
    it(`${JSON.stringify(raw)} → ${want}  (${from})`, () => {
      expect(normalizeChannel(raw)).toBe(want);
    });
  });
});

describe('provisional direct bookings do not split the direct channel', () => {
  // A direct booking is website-pending until payment succeeds. If these normalised to anything else
  // — or to null — every "how much do we sell direct?" answer would be short by the in-flight ones.
  it.each(['website-pending', 'website-hold', 'website', 'own-website', 'rentalspot'])(
    '%s → direct',
    (raw) => expect(normalizeChannel(raw)).toBe('direct'),
  );
});

describe('normalisation is forgiving about shape, strict about identity', () => {
  it.each([
    ['AIRBNB', 'airbnb'],
    ['  Booking.com  ', 'booking.com'],
    ['Booking', 'booking.com'],
    ['BOOKING_COM', 'booking.com'],
    ['booking com', 'booking.com'],
    ['Air BnB', 'airbnb'],
    ['HomeAway', 'vrbo'],
    ['VRBO.com', 'vrbo'],
  ])('%s → %s', (raw, want) => {
    expect(normalizeChannel(raw)).toBe(want);
  });

  // Returning null is the point: an unrecognised channel usually means a listing exists that nothing
  // else in the system knows about. Bucketing it into `direct` would corrupt the commission maths.
  it.each([
    ['expedia', 'a real OTA, but not one this property lists on'],
    ['', 'empty'],
    ['   ', 'whitespace'],
    ['unknown-channel', 'anything else'],
  ])('%s → null (%s)', (raw) => {
    expect(normalizeChannel(raw)).toBeNull();
  });

  it.each([[null], [undefined], [42], [{}], [['airbnb']]])('rejects non-strings: %p', (raw) => {
    expect(normalizeChannel(raw)).toBeNull();
  });

  it('is idempotent — every canonical id normalises to itself', () => {
    CHANNEL_IDS.forEach((id) => expect(normalizeChannel(id)).toBe(id));
  });
});

describe('isChannelId', () => {
  it('accepts canonical ids only, not aliases', () => {
    expect(isChannelId('booking.com')).toBe(true);
    expect(isChannelId('booking')).toBe(false); // an alias is not an id
    expect(isChannelId('nonsense')).toBe(false);
    expect(isChannelId(undefined)).toBe(false);
  });
});

describe('channelDocId', () => {
  it('builds a stable id, dots and all', () => {
    expect(channelDocId('prahova-mountain-chalet', 'booking.com'))
      .toBe('prahova-mountain-chalet_booking.com');
  });

  it('never produces a Firestore-illegal id', () => {
    CHANNEL_IDS.forEach((id: ChannelId) => {
      const docId = channelDocId('prahova-mountain-chalet', id);
      expect(docId).not.toContain('/');       // the only character Firestore forbids
      expect(docId).not.toMatch(/^\.\.?$/);   // "." and ".." are reserved
      expect(docId.length).toBeLessThan(1500);
    });
  });
});
