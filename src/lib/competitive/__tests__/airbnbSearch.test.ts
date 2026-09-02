/** @jest-environment node */

/**
 * The Airbnb search instrument, tested against card text copied off the live page (24-28 Oct 2026,
 * Comarnic) rather than invented - the two price forms, the href echo and the missing-rating case all
 * came from real cards, and a fixture that does not resemble the page would test nothing.
 *
 * Most of these pin a REFUSAL. The important one is the last group: an absent listing is a listing to
 * PROBE, never a listing to record as unavailable.
 */
import {
  parseAirbnbCard, verifyAirbnbBatch, matchAirbnbToSet, roomIdOf, IN_PAGE_AIRBNB_COLLECTOR,
  parserSnippet, type RawAirbnbCard,
} from '../airbnbSearch';
import type { CompetitorListing } from '../set';

const HREF = (over = '') =>
  `https://www.airbnb.com/rooms/43265214?adults=2&check_in=2026-10-24&check_out=2026-10-28&children=1${over}`;

const raw = (over: Partial<RawAirbnbCard> = {}): RawAirbnbCard => ({
  roomId: '43265214',
  name: 'Mountain Family Chalet, 1000 sqm private yard',
  title: 'Chalet in Comarnic',
  href: HREF(),
  // Booking and Airbnb both write a non-breaking space next to the currency.
  priceText: 'L 2,595 RON   | L 2,369 RON total | Show price breakdown | Extended stay discount',
  text: 'Chalet in Comarnic\n3 bedrooms\n6 beds\n1 bath\n4.93 out of 5 average rating, 85 reviews\n4.93 (85)',
  ...over,
});

const listing = (id: string, name: string): CompetitorListing => ({
  listingId: id, displayName: name, channel: 'airbnb',
  url: `https://www.airbnb.com/rooms/${id}`, city: 'Comarnic', units: [],
  substitutionBasis: 'x', active: true, curatedBy: 'owner', verifiedAt: null,
} as unknown as CompetitorListing);

describe('a card carries a stay total, not a nightly rate', () => {
  it('reads the DISCOUNTED total, the one labelled "total"', () => {
    const c = parseAirbnbCard(raw());
    expect(c.price).toBe(2369);        // not 2,595
    expect(c.listPrice).toBe(2595);
  });

  it('reads an undiscounted card, which prints one figure and no strike-through', () => {
    const c = parseAirbnbCard(raw({ priceText: 'L 4,684 RON total | Show price breakdown' }));
    expect(c.price).toBe(4684);
    expect(c.listPrice).toBeNull();
  });

  it('does not invent a list price when both figures are the same', () => {
    const c = parseAirbnbCard(raw({ priceText: 'L 2,369 RON | L 2,369 RON total' }));
    expect(c.listPrice).toBeNull();
  });

  it('takes rating and review count, and survives a listing that has neither', () => {
    const c = parseAirbnbCard(raw());
    expect(c.rating).toBe(4.93);
    expect(c.reviewCount).toBe(85);
    const fresh = parseAirbnbCard(raw({ text: 'Chalet in Comarnic\n2 bedrooms\n3 beds\nNew' }));
    expect(fresh.rating).toBeNull();
    expect(fresh.reviewCount).toBeNull();
    expect(fresh.beds).toBe(3);
    expect(fresh.bedrooms).toBe(2);
  });
});

describe('the echo lives in the card\'s own link', () => {
  it('reads dates and party from the href, not from the page URL', () => {
    const c = parseAirbnbCard(raw());
    expect(c.echo).toEqual({ checkIn: '2026-10-24', checkOut: '2026-10-28', adults: 2, children: 1 });
  });

  it('treats a missing children parameter as zero, because Airbnb omits it', () => {
    const c = parseAirbnbCard(raw({ href: 'https://www.airbnb.com/rooms/1?adults=4&check_in=2026-10-24&check_out=2026-10-28' }));
    expect(c.echo.children).toBe(0);
    expect(c.echo.adults).toBe(4);
  });

  it('reports an unparseable href as unknown rather than as agreement', () => {
    const c = parseAirbnbCard(raw({ href: 'not a url at all ::::' }));
    expect(c.echo.adults).toBeNull();
    expect(c.echo.children).toBeNull();
  });
});

describe('one card disagreeing refuses the whole page', () => {
  const probe = { checkIn: '2026-10-24', checkOut: '2026-10-28', adults: 2, children: 1 };

  it('accepts a page whose cards all echo the probe', () => {
    const batch = verifyAirbnbBatch([parseAirbnbCard(raw()), parseAirbnbCard(raw({ roomId: '2' }))], probe);
    expect(batch.ok).toBe(true);
    expect(batch.cards).toHaveLength(2);
  });

  it('DROPS a card echoing other dates, and keeps the page - Airbnb mixes alternatives in', () => {
    // Measured: a 24-29 Dec search returned AVA Chalet echoing 26-29 Dec at 3,630, beside two more
    // echoing 24-28, among 36 correct cards. Banking it would have stored a 3-night price as a
    // 5-night one; refusing all 39 would have thrown away a good page over Airbnb's own suggestions.
    const alt = parseAirbnbCard(raw({ roomId: '9', href: HREF().replace('2026-10-28', '2026-10-27') }));
    const batch = verifyAirbnbBatch([parseAirbnbCard(raw()), parseAirbnbCard(raw({ roomId: '2' })), alt], probe);
    expect(batch.ok).toBe(true);
    expect(batch.cards.map((c) => c.roomId)).toEqual(['43265214', '2']);   // the alternative is gone
    expect(batch.mismatched.map((m) => m.roomId)).toEqual(['9']);
    expect(batch.problem).toMatch(/alternatives rather than the stay that was asked for/);
  });

  it('refuses when the mismatched outnumber the matched - that is another search, not a suggestion', () => {
    const alt = (id: string) => parseAirbnbCard(raw({ roomId: id, href: HREF().replace('2026-10-28', '2026-10-27') }));
    const batch = verifyAirbnbBatch([parseAirbnbCard(raw()), alt('8'), alt('9')], probe);
    expect(batch.ok).toBe(false);
    expect(batch.cards).toHaveLength(0);
    expect(batch.problem).toMatch(/the render is about another search/);
  });

  it('a listing seen only on a dropped card is NOT present - it falls to the probe list', () => {
    const setById = [{ ...listing('x', 'Only On An Alternative'), url: 'https://www.airbnb.com/rooms/9' }] as CompetitorListing[];
    const alt = parseAirbnbCard(raw({ roomId: '9', href: HREF().replace('2026-10-28', '2026-10-27') }));
    const batch = verifyAirbnbBatch([parseAirbnbCard(raw()), parseAirbnbCard(raw({ roomId: '2' })), alt], probe);
    const field = matchAirbnbToSet(batch.cards, setById);
    expect(field.curated).toHaveLength(0);
    expect(field.toProbe.map((l) => l.displayName)).toEqual(['Only On An Alternative']);
  });

  it('refuses a page that rendered cards but no totals', () => {
    const empty = parseAirbnbCard(raw({ priceText: 'Show price breakdown' }));
    expect(verifyAirbnbBatch([empty], probe).ok).toBe(false);
  });

  it('refuses an empty page rather than reporting a field of nobody', () => {
    expect(verifyAirbnbBatch([], probe).problem).toMatch(/did not render/);
  });
});

describe('matching joins by room id, and an absence is a PROBE, not a verdict', () => {
  const set = [listing('ava', 'AVA Chalet with Jacuzzi'), listing('tiny', 'Adorable 2 Bedroom Tiny Home')];
  // The set's URLs are /rooms/ava and /rooms/tiny, so give the cards ids that match.
  const setById = [
    { ...set[0], url: 'https://www.airbnb.com/rooms/111' },
    { ...set[1], url: 'https://www.airbnb.com/rooms/222' },
  ] as CompetitorListing[];

  it('pairs a card with its listing by id and hands the rest back as candidates', () => {
    const field = matchAirbnbToSet(
      [parseAirbnbCard(raw({ roomId: '111' })), parseAirbnbCard(raw({ roomId: '999' }))],
      setById);
    expect(field.curated.map((c) => c.listing.displayName)).toEqual(['AVA Chalet with Jacuzzi']);
    expect(field.candidates.map((c) => c.roomId)).toEqual(['999']);
  });

  it('returns a missing curated listing as something to PROBE, never as unavailable', () => {
    // This is the whole difference from the Booking collector. Airbnb paginates 18 at a time over 15
    // pages, so "not on the pages we read" and "not on sale" are the same shape from here. The owner
    // is right that it is usually the second - every absentee on the first run had a real cause - but
    // usually is not always, and one detail load settles it.
    const field = matchAirbnbToSet([parseAirbnbCard(raw({ roomId: '111' }))], setById);
    expect(field.toProbe.map((l) => l.displayName)).toEqual(['Adorable 2 Bedroom Tiny Home']);
    // and nothing anywhere in the result carries a status
    expect(JSON.stringify(field)).not.toMatch(/unavailable|not-sellable/);
  });

  it('separates our own card out, so it is a cross-check and never a comparable', () => {
    const field = matchAirbnbToSet(
      [parseAirbnbCard(raw({ roomId: '43265214' })), parseAirbnbCard(raw({ roomId: '111' }))],
      setById, '43265214');
    expect(field.ours?.price).toBe(2369);
    expect(field.candidates).toHaveLength(0);
    expect(field.curated).toHaveLength(1);
  });

  it('roomIdOf pulls the join key out of a stored URL', () => {
    expect(roomIdOf('https://www.airbnb.com/rooms/27595549?x=1')).toBe('27595549');
    expect(roomIdOf('https://www.booking.com/hotel/ro/vila-luna.html')).toBeNull();
  });
});

describe('the in-page collector', () => {
  it('collects raw strings only, leaving every judgement to the tested parser', () => {
    // The two-implementation trap: whatever this returns must be parsed by parseAirbnbCard, so the
    // collector must not contain a price regex of its own to drift away from it.
    expect(IN_PAGE_AIRBNB_COLLECTOR).toMatch(/itemListElement/);
    expect(IN_PAGE_AIRBNB_COLLECTOR).toMatch(/price-availability-row/);
    expect(IN_PAGE_AIRBNB_COLLECTOR).not.toMatch(/RON/);
  });
});

describe('the parser shipped INTO the page is the same parser', () => {
  // Everywhere else in this system a page-side parser is a second implementation held in step by an
  // agreement test. Here there is only one: the snippet is the compiled source of parseAirbnbCard,
  // with shims for the two things the bundle would have supplied. This test cannot catch drift -
  // there is none to catch - but it does catch the shims going stale when esbuild changes its
  // output, which would otherwise show up as a silent parse failure on a live page.
  const inPage = new Function(`${parserSnippet()}; return parseAirbnbCard;`)() as typeof parseAirbnbCard;

  it.each([
    ['a discounted card', raw()],
    ['an undiscounted card', raw({ priceText: 'L 4,684 RON total' })],
    ['a card with no reviews', raw({ text: 'Chalet in Comarnic\n2 bedrooms\n3 beds\nNew' })],
    ['a card with an unusable href', raw({ href: '::::' })],
  ])('agrees with the module on %s', (_label, fixture) => {
    expect(inPage(fixture)).toEqual(parseAirbnbCard(fixture));
  });

  it('carries no module reference that would throw in a page', () => {
    const snippet = parserSnippet();
    expect(snippet).not.toMatch(/\brequire\(|\bimport\s/);
    // The namespace name differs per toolchain, so the reference must be gone entirely rather than
    // shimmed under whichever name today's compiler happened to choose.
    expect(snippet).not.toMatch(/[A-Za-z_$][\w$]*\.norm\b/);
  });
});
