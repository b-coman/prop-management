/** @jest-environment node */

/**
 * The identity parser, and the contract that the two implementations agree.
 *
 * Fixtures are lifted from the LIVE pages read on 2026-09-01, including the exact shapes that fooled
 * a regex pass: the village of villas read as one villa, the four-bedroom house read as eleven
 * bedrooms, and the `Sleeps:` line that says whatever you asked it.
 */
import {
  parseIdentity, reconcile, countBeds, norm, IN_PAGE_VERIFIER,
  type VerifyChannel, type Identity,
} from '../verify';

// eslint-disable-next-line @typescript-eslint/no-implied-eval
const inPageIdentity = new Function(`${IN_PAGE_VERIFIER}; return __identity;`)() as
  (channel: string, text: string) => Identity;

const pad = ' '.repeat(300);
const NBSP = ' ';

/** Vila Luna, 24-28 Oct, searched 8 adults. `Sleeps:` echoes the SEARCH; `Max persons` is the fact. */
const VILA_LUNA_8A = `
Vila Luna, Strada X 12, 105700 Comarnic, Romania
Scored 10
10
Rated exceptional
Exceptional
57 reviews
Select an accommodation type and how many you want to reserve.
Accommodation Type
Price for 4 nights
Four-Bedroom House
Recommended for 8 adults
Sleeps: 8 adults
Bedroom 1: 1 single bed  and 1 large double bed
Bedroom 2: 1 double bed
Bedroom 3: 1 double bed
Bedroom 4: 1 large double bed
Living room: 1 sofa bed
Living room: 1 sofa bed
Bathrooms:2
Entire holiday home
200 m²
Max persons: 11
4,180${NBSP}lei
Price 4,180${NBSP}lei
We have 1 left
${pad}`;

/** The same unit, searched 4 adults + 2 children. Every stable field must match the above. */
const VILA_LUNA_4A2C = VILA_LUNA_8A
  .replace('Recommended for 8 adults', 'Recommended for 4 adults, 2 children')
  .replace('Sleeps: 8 adults', 'Sleeps: 4 adults , 2 children');

/** The Cliff Village: three separately bookable villas, plus per-occupancy rate rows to be grouped. */
const CLIFF = `
The Cliff Village, 315 Strada Poiana, 105700 Comarnic, Romania
Scored 10
10
Rated exceptional
Exceptional
68 reviews
Select an accommodation type and how many you want to reserve.
One-Bedroom Villa
Bedroom 1: 1 large double bed
Entire villa
80 m²
Max persons: 2
Price 4,480${NBSP}lei
Max persons: 4
Price 5,320${NBSP}lei
Two-Bedroom Villa
Bedroom 1: 1 extra-large double bed
Bedroom 2: 1 extra-large double bed
Living room: 1 sofa bed
Entire villa
200 m²
Max persons: 6
Price 7,600${NBSP}lei
Deluxe Villa
Bedroom 1: 1 large double bed
Bedroom 2: 1 large double bed
Bedroom 3: 1 large double bed
Entire villa
300 m²
Max persons: 10
Price 13,300${NBSP}lei
${pad}`;

/** Villa The Frame: a single-unit page with NO capacity marker anywhere. Beds are the only source. */
const FRAME = `
Villa The Frame, Comarnic, Romania
Scored 9.7
9.7
Rated wonderful
Wonderful
21 reviews
Select an accommodation type and how many you want to reserve.
Superior Villa
 We have 1 left
Sleeps: 2 adults
Bedroom 1: 1 large double bed
Bedroom 2: 1 large double bed
Bedroom 3: 1 large double bed
Bedroom 4: 1 large double bed
Entire villa
195 m²
Original price 5,887${NBSP}lei Current price 4,752${NBSP}lei
${pad}`;

const MOODYSUN_SOLD_OUT = `
MoodySun Studio, remote tiny home, Comarnic, Romania
Availability
We Price Match
We have no availability here between Sat 24 Oct 2026 and Wed 28 Oct 2026
Select different dates to see more availability
${pad}`;

const AIRBNB_AVA = `
Entire villa in Comarnic, Romania
6 guests · 2 bedrooms · 3 beds · 2 baths
4.93
28 reviews
Guest favourite
${pad}`;

const FIXTURES: Array<{ name: string; channel: VerifyChannel; text: string }> = [
  { name: 'vila luna, 8 adults', channel: 'booking.com', text: VILA_LUNA_8A },
  { name: 'vila luna, 4a+2c', channel: 'booking.com', text: VILA_LUNA_4A2C },
  { name: 'cliff village, three villas', channel: 'booking.com', text: CLIFF },
  { name: 'villa the frame, no capacity marker', channel: 'booking.com', text: FRAME },
  { name: 'moodysun, sold out', channel: 'booking.com', text: MOODYSUN_SOLD_OUT },
  { name: 'airbnb ava chalet', channel: 'airbnb', text: AIRBNB_AVA },
  { name: 'empty page', channel: 'booking.com', text: '' },
  { name: 'bot check', channel: 'booking.com', text: `Are you a robot? Please verify you are human. ${pad}` },
];

describe('capacity comes from Max persons, never from Sleeps', () => {
  it('reads Vila Luna as 11 even when the search says 8', () => {
    const id = parseIdentity('booking.com', VILA_LUNA_8A);
    expect(id.units).toEqual([
      { label: 'Four-Bedroom House', maxPersons: 11, count: 1, sqm: 200 },
    ]);
    expect(id.echo.sleeps).toMatch(/8 adults/);   // captured only as evidence
  });

  it('reads the SAME 11 when the search says 4 adults + 2 children', () => {
    expect(parseIdentity('booking.com', VILA_LUNA_4A2C).units[0].maxPersons).toBe(11);
  });

  it('counts the bed configuration to the same 11, independently', () => {
    // 1 single + 1 large double (3), 1 double (2), 1 double (2), 1 large double (2), 2 sofa (2) = 11
    expect(parseIdentity('booking.com', VILA_LUNA_8A).bedsTotal).toBe(11);
  });
});

describe('rows are (unit x occupancy x rate plan), not units', () => {
  it('groups The Cliff Village into three villas, not five rows', () => {
    const id = parseIdentity('booking.com', CLIFF);
    expect(id.units.map((u) => [u.label, u.maxPersons, u.sqm])).toEqual([
      ['One-Bedroom Villa', 4, 80],
      ['Two-Bedroom Villa', 6, 200],
      ['Deluxe Villa', 10, 300],
    ]);
  });

  it('takes the MAX capacity under one name, not the first or the cheapest row', () => {
    // The One-Bedroom Villa renders "Max persons: 2" and "Max persons: 4" for the same unit.
    expect(parseIdentity('booking.com', CLIFF).units[0].maxPersons).toBe(4);
  });
});

describe('a page with no capacity marker falls back to beds', () => {
  it('reads Villa The Frame as 8 from four large doubles', () => {
    const id = parseIdentity('booking.com', FRAME);
    expect(id.state).toBe('ok');
    expect(id.units).toEqual([{ label: 'Superior Villa', maxPersons: 8, count: 1, sqm: 195 }]);
  });

  it('refuses rather than guessing when there is neither a marker nor a bed', () => {
    const bare = `Somewhere, Romania\nSelect a room type\nNice place\nEntire villa\n${pad}`;
    expect(parseIdentity('booking.com', bare).state).toBe('no-capacity');
  });
});

describe('non-price outcomes are states, not failures', () => {
  it('reads a sold-out window as no-availability', () => {
    expect(parseIdentity('booking.com', MOODYSUN_SOLD_OUT).state).toBe('no-availability');
  });
  it('reads a bot check as a bot check', () => {
    expect(parseIdentity('booking.com', `verify you are human ${pad}`).state).toBe('bot-check');
  });
  it('reads an empty page as not-loaded', () => {
    expect(parseIdentity('booking.com', '').state).toBe('not-loaded');
  });
});

describe('airbnb states capacity as a property attribute', () => {
  it('reads the header line', () => {
    const id = parseIdentity('airbnb', AIRBNB_AVA);
    expect(id.units).toEqual([{ label: 'Entire listing', maxPersons: 6, count: 1, sqm: null }]);
    expect(id.rating).toBe(4.93);
    expect(id.reviewCount).toBe(28);
    expect(id.city).toBe('Comarnic');
  });
});

describe('the location sub-score is not the property score', () => {
  it('ignores "rated 9.7/10" and takes the Scored/Rated/reviews block', () => {
    const withLocation = VILA_LUNA_8A.replace(
      'Scored 10', 'Excellent location — rated 9.7/10!(score from 67 reviews)\nScored 10');
    const id = parseIdentity('booking.com', withLocation);
    expect(id.rating).toBe(10);
    expect(id.reviewCount).toBe(57);
  });
});

describe('non-breaking spaces', () => {
  it('normalises them before matching', () => {
    expect(norm(`4,180${NBSP}lei`)).toBe('4,180 lei');
  });
  it('counts beds regardless', () => {
    expect(countBeds(`Bedroom 1: 1 large${NBSP}double bed`.replace(NBSP, ' '))).toBe(2);
  });
});

describe('reconcile — the two-occupancy self-check', () => {
  const at = (occupancy: number, text: string) =>
    ({ occupancy, identity: parseIdentity('booking.com', text) });

  it('keeps capacity that did not move, and proves the echo did', () => {
    const r = reconcile({ a: at(8, VILA_LUNA_8A), b: at(6, VILA_LUNA_4A2C) });
    expect(r.ok).toBe(true);
    expect(r.stable.units[0].maxPersons).toBe(11);
    expect(r.moved).toEqual([]);
    expect(r.problem).toBeUndefined();
  });

  it('REFUSES when both reads used the same occupancy — an unrun check must not pass', () => {
    const r = reconcile({ a: at(8, VILA_LUNA_8A), b: at(8, VILA_LUNA_8A) });
    expect(r.ok).toBe(false);
    expect(r.problem).toMatch(/only means something when the two searches differ/);
  });

  it('discards capacity that MOVED between reads, and says why', () => {
    const drifted = VILA_LUNA_8A.replace('Max persons: 11', 'Max persons: 6');
    const r = reconcile({ a: at(8, VILA_LUNA_8A), b: at(6, drifted) });
    expect(r.ok).toBe(false);
    expect(r.moved).toContain('units');
    expect(r.problem).toMatch(/search echo, not a fact/);
  });

  it('will not reconcile a read that did not load', () => {
    const r = reconcile({ a: at(8, VILA_LUNA_8A), b: at(6, MOODYSUN_SOLD_OUT) });
    expect(r.ok).toBe(false);
    expect(r.problem).toMatch(/no-availability/);
  });

  it('flags a check that proves less than it looks, when the echo did not move', () => {
    const r = reconcile({ a: at(8, VILA_LUNA_8A), b: at(6, VILA_LUNA_8A) });
    expect(r.problem).toMatch(/did not move/);
  });
});

describe('the in-page copy agrees with the Node parser on every fixture', () => {
  // The whole reason this test exists: there must be two implementations, and a drifted pair is worse
  // than either alone because the tested one stays green while the running one reads your data wrong.
  it.each(FIXTURES)('$name', ({ channel, text }) => {
    expect(inPageIdentity(channel, text)).toEqual(parseIdentity(channel, text));
  });

  it('pins capacity to a NUMBER, not merely to each other', () => {
    // Two parsers that both read nothing agree perfectly. Only a pinned value catches that.
    expect(inPageIdentity('booking.com', VILA_LUNA_8A).units[0].maxPersons).toBe(11);
    expect(inPageIdentity('booking.com', CLIFF).units).toHaveLength(3);
    expect(inPageIdentity('booking.com', FRAME).units[0].maxPersons).toBe(8);
    expect(inPageIdentity('airbnb', AIRBNB_AVA).units[0].maxPersons).toBe(6);
  });
});
