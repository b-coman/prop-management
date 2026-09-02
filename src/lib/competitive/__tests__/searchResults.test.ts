/** @jest-environment node */

/**
 * The search-page instrument. Fixtures are the real card shapes read on 2026-09-02, including the
 * two forms a price takes and the exact wording each card uses to echo the search back.
 */
import {
  parseSearchCard, verifySearchBatch, matchToSet, slugOf, norm, IN_PAGE_SEARCH_COLLECTOR,
} from '../searchResults';
import type { CompetitorListing } from '../set';

const NBSP = ' ';

/** Discounted card — 11 of 25 on the live page looked like this. */
const OURS = `Mountain Family Chalet on Prahova Valley - 1000 sqm private yard
Opens in new window
Managed by a private host
ComarnicShow on map
1.4 km from centre
Scored 9.4
9.4
Superb
27 reviews
Entire holiday home • 3 bedrooms • 1 living room • 2 bathrooms • 1 kitchen • 145 m²
5 beds (1 single, 1 double, 2 bunk beds, 1 large double)
Free cancellation
2 nights, 2 adults, 2 children
1,640${NBSP}lei1,491${NBSP}lei
Original price 1,640${NBSP}lei. Current price 1,491${NBSP}lei.
Includes taxes and charges`;

/** Undiscounted card — the other 14. A pair-only parser misses all of these. */
const LUNA = `Vila Luna
Opens in new window
ComarnicShow on map
1.5 km from centre
Scored 10
10
Exceptional
57 reviews
Entire holiday home • 4 bedrooms • 200 m²
7 beds (1 single, 2 doubles, 2 sofa beds, 2 large doubles)
Free cancellation
No prepayment needed – pay at the property
2 nights, 2 adults, 2 children
1,980${NBSP}lei
Price 1,980${NBSP}lei
Includes taxes and charges`;

const listing = (id: string, slug: string): CompetitorListing => ({
  listingId: id, propertyId: 'p', displayName: id, channel: 'booking.com',
  url: `https://www.booking.com/hotel/ro/${slug}.en-gb.html`,
  city: 'Comarnic', heroPhotoUrl: null, units: [], propertyType: 'whole-house',
  distanceKm: null, rating: null, reviewCount: null, qualityAsOf: null, amenities: [],
  substitutionBasis: 'x', active: true, curatedBy: 'o', verifiedAt: null,
});

describe('both price forms, because a pair-only parser misses more than half', () => {
  it('reads a discounted card as current + list', () => {
    const c = parseSearchCard('mountain-family-chalet', 'Mountain Family Chalet', OURS);
    expect(c.price).toBe(1491);
    expect(c.listPrice).toBe(1640);
  });

  it('reads an UNdiscounted card, where the only price is "Price N lei"', () => {
    const c = parseSearchCard('vila-luna-comarnic', 'Vila Luna', LUNA);
    expect(c.price).toBe(1980);
    expect(c.listPrice).toBeNull();
  });

  it('handles the non-breaking space Booking puts before the currency', () => {
    expect(norm(`1,980${NBSP}lei`)).toBe('1,980 lei');
  });
});

describe('the card carries its own echo, next to its own price', () => {
  it('reads nights, adults and children from the card', () => {
    expect(parseSearchCard('x', 'x', OURS).echo).toEqual({ nights: 2, adults: 2, children: 2 });
  });

  it('reads an adults-only card as zero children rather than unknown', () => {
    const t = OURS.replace('2 nights, 2 adults, 2 children', '3 nights, 4 adults');
    expect(parseSearchCard('x', 'x', t).echo).toEqual({ nights: 3, adults: 4, children: 0 });
  });
});

describe('the whole batch is accepted or refused together', () => {
  const good = [parseSearchCard('a', 'A', OURS), parseSearchCard('b', 'B', LUNA)];

  it('accepts a page where every card echoes the probe', () => {
    const r = verifySearchBatch(good, { nights: 2, adults: 2, children: 2 });
    expect(r.ok).toBe(true);
    expect(r.cards).toHaveLength(2);
  });

  it('REFUSES the whole page when one card disagrees — a mid-update render', () => {
    const stale = parseSearchCard('c', 'C', OURS.replace('2 nights, 2 adults, 2 children', '4 nights, 2 adults, 2 children'));
    const r = verifySearchBatch([...good, stale], { nights: 2, adults: 2, children: 2 });
    expect(r.ok).toBe(false);
    expect(r.cards).toEqual([]);          // nothing partially banked
    expect(r.mismatched.map((m) => m.slug)).toEqual(['c']);
    expect(r.problem).toMatch(/mid-update/);
  });

  it('refuses an empty page rather than reporting an empty field', () => {
    const r = verifySearchBatch([], { nights: 2, adults: 2, children: 2 });
    expect(r.ok).toBe(false);
    expect(r.problem).toMatch(/did not render|layout changed/);
  });
});

describe('matching is by SLUG, never by display name', () => {
  // Booking's slug and title disagree often enough to matter: "Casa Drumetului" lives at
  // vila-drumetului-comarnic, "Cabana Talea Residence" at vila-talea-residence.
  it('extracts the slug from a stored listing url', () => {
    expect(slugOf('https://www.booking.com/hotel/ro/vila-luna-comarnic.en-gb.html')).toBe('vila-luna-comarnic');
    expect(slugOf('https://www.airbnb.com/rooms/123')).toBeNull();
  });

  it('splits a page into curated and candidates', () => {
    const cards = [parseSearchCard('vila-luna-comarnic', 'Vila Luna', LUNA),
                   parseSearchCard('some-newcomer', 'Some Newcomer', LUNA)];
    const m = matchToSet(cards, [listing('vila-luna', 'vila-luna-comarnic')]);
    expect(m.curated.map((c) => c.listing.listingId)).toEqual(['vila-luna']);
    expect(m.candidates.map((c) => c.slug)).toEqual(['some-newcomer']);
  });

  it('matches a card whose TITLE differs from its slug', () => {
    const cards = [parseSearchCard('vila-drumetului-comarnic', 'Casa Drumetului', LUNA)];
    const m = matchToSet(cards, [listing('drumetului', 'vila-drumetului-comarnic')]);
    expect(m.curated).toHaveLength(1);
    expect(m.candidates).toHaveLength(0);
  });

  it('reports curated listings the search did NOT return — an absence is a finding', () => {
    const m = matchToSet([parseSearchCard('vila-luna-comarnic', 'Vila Luna', LUNA)],
      [listing('vila-luna', 'vila-luna-comarnic'), listing('missing-one', 'ava-chalet-comarnic')]);
    expect(m.absent.map((l) => l.listingId)).toEqual(['missing-one']);
  });

  it('ignores listings on another channel', () => {
    const ab = { ...listing('ab', 'x'), channel: 'airbnb' as const, url: 'https://www.airbnb.com/rooms/1' };
    const m = matchToSet([parseSearchCard('vila-luna-comarnic', 'Vila Luna', LUNA)],
      [listing('vila-luna', 'vila-luna-comarnic'), ab]);
    expect(m.absent).toEqual([]);
  });
});

describe('the in-page collector', () => {
  it('warns, in its own source, that the list is virtualised', () => {
    // The single mechanic most likely to be forgotten: 25 cards at the top, 6 after scrolling.
    expect(IN_PAGE_SEARCH_COLLECTOR).toMatch(/property-card/);
    expect(IN_PAGE_SEARCH_COLLECTOR).toMatch(/hotel/);
  });
});
