/** @jest-environment node */

/**
 * The set logic, tested against the REAL measured comparables (docs §12-14) rather than invented
 * shapes - because every subtlety here came from one of them, and a fixture that does not resemble
 * the market would test nothing that has ever gone wrong.
 */
import {
  hostsParty, fieldMembership, isProbeworthy, largestUnit, totalCapacity, unitCount, isMultiUnit,
  verificationAge, assertListingId, validateListing, VERIFICATION_BUDGET_DAYS,
  type CompetitorUnit, type CompetitorListing,
} from '../set';
import type { Party } from '@/lib/parity/party';

const u = (label: string, maxPersons: number, count: number | null = 1): CompetitorUnit =>
  ({ label, maxPersons, count });

// Measured 2026-09-01, 24-28 Oct probe.
const CLIFF = { units: [u('One-Bedroom Villa', 4), u('Two-Bedroom Villa', 6), u('Deluxe Villa', 10)] };
const VILA_LUNA = { units: [u('Four-Bedroom House', 11)] };
const CASUTELE_DIN = { units: [u('Two-Bedroom Chalet', 4), u('One-Bedroom Chalet', 3, 2)] };
const CASUTELE_DE_LA = { units: [u('Double Room', 2, 3)] };
const MOODYSUN = { units: [u('Studio', 3)] };
const AYDA = { units: [u('Two-Bedroom Chalet', 5)] };

// The configured ages are CHILD_AGES = [10, 4], oldest first, so 2a+1c travels with a ten-year-old
// (old enough for a room of their own) and 4a+2c adds a four-year-old (not).
const P_2A1C: Party = { adults: 2, children: 1 };   // 3, child 10
const P_4A: Party = { adults: 4, children: 0 };     // 4
const P_4A2C: Party = { adults: 4, children: 2 };   // 6, children 10 and 4

describe('capacity is a table, not a scalar', () => {
  it('reads the largest single unit, not the total', () => {
    expect(largestUnit(CASUTELE_DIN)).toBe(4);       // not 3+3+4
    expect(totalCapacity(CASUTELE_DIN)).toBe(10);
    expect(largestUnit(CASUTELE_DE_LA)).toBe(2);     // three rooms of two
    expect(totalCapacity(CASUTELE_DE_LA)).toBe(6);
  });

  it('knows a park from a house', () => {
    expect(isMultiUnit(CLIFF)).toBe(true);
    expect(unitCount(CASUTELE_DE_LA)).toBe(3);
    expect(isMultiUnit(VILA_LUNA)).toBe(false);
  });
});

describe('how a party splits is decided by child AGE (the owner\'s rule)', () => {
  it('places a family of six in the smallest unit that fits, not the biggest', () => {
    const fit = hostsParty(CLIFF, P_4A2C);
    expect(fit.kind).toBe('single');
    if (fit.kind === 'single') expect(fit.units[0].label).toBe('Two-Bedroom Villa'); // 6, not the 10
  });

  it('houses a family of six across two chalets - the four-year-old rides with the adults', () => {
    // Largest unit takes four, so nobody fits in one. The 4-person chalet anchors an adult and the
    // four-year-old; the rest go next door. Under the pre-2026-09-02 rule this was out-of-set.
    const fit = hostsParty(CASUTELE_DIN, P_4A2C);
    expect(fit.kind).toBe('combination');
    if (fit.kind === 'combination') expect(fit.unitCount).toBe(2);
  });

  it('lets 2+1 take two double rooms - a ten-year-old may have their own', () => {
    // The case that exposed the old rule: Booking sells Casutele de la Poienita to exactly this party
    // as two double rooms, while the set recorded it as unable to host them at all.
    const fit = hostsParty(CASUTELE_DE_LA, P_2A1C);
    expect(fit.kind).toBe('combination');
    if (fit.kind === 'combination') expect(fit.unitCount).toBe(2);
  });

  it('refuses when no bookable unit holds an adult beside the under-age child', () => {
    // Single rooms only: the four-year-old would be alone. Seats exist; the arrangement does not.
    const singles = { units: [u('Single Room', 1, 8)] };
    const fit = hostsParty(singles, P_4A2C);
    expect(fit.kind).toBe('out-of-set');
    if (fit.kind === 'out-of-set') expect(fit.reason).toMatch(/adult plus 1 child under 7/);
    expect(totalCapacity(singles)).toBeGreaterThan(6);   // capacity was never the problem
    // Four adults in the same rooms is fine - the constraint is the child, not the room size.
    expect(hostsParty(singles, P_4A).kind).toBe('combination');
  });

  it('lets the 21 m² studio host 2+1 - it sleeps three in one unit', () => {
    expect(hostsParty(MOODYSUN, P_2A1C).kind).toBe('single');
  });
});

describe('combining units', () => {
  it('houses four adults across two of the three double rooms', () => {
    const fit = hostsParty(CASUTELE_DE_LA, P_4A);
    expect(fit.kind).toBe('combination');
    if (fit.kind === 'combination') {
      expect(fit.unitCount).toBe(2);
      expect(fit.stockUnknown).toBe(false);
    }
  });

  it('prefers a single unit when one exists, rather than combining for its own sake', () => {
    expect(hostsParty(CASUTELE_DIN, P_4A).kind).toBe('single');
  });

  it('respects stock - two rooms of two cannot seat six when only two remain', () => {
    const scarce = { units: [u('Double Room', 2, 2)] };
    expect(hostsParty(scarce, { adults: 6, children: 0 }).kind).toBe('out-of-set');
    const plenty = { units: [u('Double Room', 2, 3)] };
    expect(hostsParty(plenty, { adults: 6, children: 0 }).kind).toBe('combination');
  });

  it('combines for a party with children too, now that age decides it', () => {
    // Same listing, same seat count. Both combine: the four-year-old in 2a+2c shares a double room
    // with an adult, which is the arrangement the owner said he would accept.
    expect(hostsParty(CASUTELE_DE_LA, { adults: 4, children: 0 }).kind).toBe('combination');
    expect(hostsParty(CASUTELE_DE_LA, { adults: 2, children: 2 }).kind).toBe('combination');
  });

  it('flags unread stock rather than inventing inventory', () => {
    const unread = { units: [u('Double Room', 2, null)] };
    const fit = hostsParty(unread, P_4A);
    // One unit of two, stock unknown: cannot seat four without pretending a second room exists.
    expect(fit.kind).toBe('out-of-set');
    const twoTypes = { units: [u('A', 2, null), u('B', 2, null)] };
    const fit2 = hostsParty(twoTypes, P_4A);
    expect(fit2.kind).toBe('combination');
    if (fit2.kind === 'combination') expect(fit2.stockUnknown).toBe(true);
  });
});

describe('unread capacity is UNKNOWN, never a moat', () => {
  it('returns unknown for a listing whose units have not been read', () => {
    const fit = hostsParty({ units: [] }, P_4A2C);
    expect(fit.kind).toBe('unknown');
    if (fit.kind === 'unknown') expect(fit.reason).toMatch(/priced probe/);
  });

  it('still counts as probeworthy - the missing data is the reason TO probe', () => {
    expect(isProbeworthy(hostsParty({ units: [] }, P_4A2C))).toBe(true);
    expect(isProbeworthy(hostsParty(MOODYSUN, P_4A2C))).toBe(false); // a 3-person studio, genuinely out
  });

  it('treats a sold-out unit as unavailable rather than absent', () => {
    expect(hostsParty({ units: [u('Villa', 8, 0)] }, P_4A).kind).toBe('out-of-set');
  });
});

describe('the field changes size with the party (C4)', () => {
  it('reproduces the measured Booking field', () => {
    // Six of the eight active Booking comparables - Villa The Frame (8) and AVA Chalet (6) are
    // omitted here because both host every party, so they add nothing to this test.
    const set = [CLIFF, VILA_LUNA, AYDA, CASUTELE_DIN, MOODYSUN, CASUTELE_DE_LA];
    const canHost = (p: Party) =>
      set.filter((l) => ['single', 'combination'].includes(hostsParty(l, p).kind)).length;
    expect(canHost(P_2A1C)).toBe(6);   // all of them, once two double rooms count for a 2+1
    expect(canHost(P_4A)).toBe(5);     // all but MoodySun (studio takes three)
    // Cliff's 6-person villa, Vila Luna, and the two multi-unit sites that can seat six across rooms.
    // Ayda (5 places) and MoodySun (3) simply do not have the seats.
    expect(canHost(P_4A2C)).toBe(4);
  });

  it('MoodySun takes 2+1 in one unit and cannot take four adults at all', () => {
    expect(hostsParty(MOODYSUN, P_2A1C).kind).toBe('single');
    expect(hostsParty(MOODYSUN, P_4A).kind).toBe('out-of-set');   // 3 places, no second unit
    // Casutele de la reaches both parties, but only ever across rooms.
    expect(hostsParty(CASUTELE_DE_LA, P_2A1C).kind).toBe('combination');
    expect(hostsParty(CASUTELE_DE_LA, P_4A).kind).toBe('combination');
  });

  it('fieldMembership answers for every party in one call', () => {
    const rows = fieldMembership(CASUTELE_DIN, [P_2A1C, P_4A, P_4A2C]);
    expect(rows.map((r) => r.fit.kind)).toEqual(['single', 'single', 'combination']);
  });
});

describe('the set ages (C1)', () => {
  const NOW = new Date('2026-09-01T12:00:00Z');
  it('treats a never-verified entry as unverified and stale', () => {
    expect(verificationAge({ verifiedAt: null }, NOW)).toEqual({ ageDays: null, stale: true, unverified: true });
  });
  it('goes stale past the budget', () => {
    const fresh = new Date(NOW.getTime() - 10 * 86_400_000).toISOString();
    const old = new Date(NOW.getTime() - (VERIFICATION_BUDGET_DAYS + 1) * 86_400_000).toISOString();
    expect(verificationAge({ verifiedAt: fresh }, NOW).stale).toBe(false);
    expect(verificationAge({ verifiedAt: old }, NOW).stale).toBe(true);
  });
});

describe('listingId is permanent, so it is checked at curation time', () => {
  it.each(['vila-luna', 'the-cliff-village', 'ava-chalet-bk'])('accepts %s', (id) => {
    expect(() => assertListingId(id)).not.toThrow();
  });
  it.each(['', 'a|b', 'Vila Luna', 'Vila_Luna', '-leading', 'UPPER'])('refuses %p', (id) => {
    expect(() => assertListingId(id)).toThrow();
  });
});

describe('validateListing', () => {
  const ok: Partial<CompetitorListing> = {
    listingId: 'vila-luna', propertyId: 'prahova-mountain-chalet', displayName: 'Vila Luna',
    channel: 'booking.com', url: 'https://example.com', city: 'Comarnic',
    substitutionBasis: 'whole house of our size in our town', units: [u('House', 11)],
  };
  it('passes a complete entry', () => expect(validateListing(ok)).toEqual([]));

  it('requires substitutionBasis - the field C1 exists for', () => {
    expect(validateListing({ ...ok, substitutionBasis: '  ' }))
      .toEqual([expect.stringContaining('substitutionBasis')]);
  });

  it('names every missing field at once rather than one per attempt', () => {
    expect(validateListing({}).length).toBeGreaterThanOrEqual(6);
  });

  it('rejects a self-referential sameAs', () => {
    expect(validateListing({ ...ok, sameAs: { listingId: 'vila-luna', assertedBy: 'o', basis: 'x' } }))
      .toEqual([expect.stringContaining('itself')]);
  });

  it('rejects a unit with no capacity', () => {
    expect(validateListing({ ...ok, units: [u('bad', 0)] }))
      .toEqual([expect.stringContaining('maxPersons')]);
  });
});

describe('a standing party bar is not a sell-out', () => {
  // Both measured on Booking, twice, on two different windows: Villa The Frame prints "Ooops! This is
  // an adult-only property" and AVA Chalet "Ooops! Only children 12 years and older can stay here" -
  // while still showing a price. The SEARCH just omits them, so 44 rows across 13 windows had been
  // stored as `unavailable`, inflating the share of the field that had supposedly sold.
  const ADULTS_ONLY = { units: [u('Villa', 8)], partyPolicy: { adultsOnly: true } };
  const OVER_12 = { units: [u('Villa', 6)], partyPolicy: { minChildAge: 12 } };

  it('takes an adults-only property out of the field for any party with children', () => {
    const fit = hostsParty(ADULTS_ONLY, P_2A1C);
    expect(fit.kind).toBe('out-of-set');
    if (fit.kind === 'out-of-set') expect(fit.reason).toMatch(/adults-only/);
  });

  it('still counts it for an adults-only party - the bar is about children, not size', () => {
    expect(hostsParty(ADULTS_ONLY, P_4A).kind).toBe('single');
  });

  it('applies a minimum child age against the ACTUAL ages, not the count', () => {
    // CHILD_AGES is [10, 4]: a 2a+1c party brings a ten-year-old, which a 12+ rule bars.
    const fit = hostsParty(OVER_12, P_2A1C);
    expect(fit.kind).toBe('out-of-set');
    if (fit.kind === 'out-of-set') expect(fit.reason).toMatch(/from 12 only.*10-year-old/);
    expect(hostsParty(OVER_12, P_4A).kind).toBe('single');
  });

  it('lets a party through when every child clears the bar', () => {
    expect(hostsParty({ units: [u('Villa', 6)], partyPolicy: { minChildAge: 8 } }, P_2A1C).kind).toBe('single');
  });

  it('changes nothing for a listing with no policy recorded', () => {
    expect(hostsParty({ units: [u('Villa', 8)] }, P_2A1C).kind).toBe('single');
  });

  it('is checked BEFORE capacity, so a bar never reaches the scarcity denominator', () => {
    // A huge adults-only villa is out of set for a family - not "too small", and not "nothing left".
    const fit = hostsParty({ units: [u('Villa', 20)], partyPolicy: { adultsOnly: true } }, P_4A2C);
    expect(fit.kind).toBe('out-of-set');
    if (fit.kind === 'out-of-set') expect(fit.reason).not.toMatch(/do not fit|no single unit/);
  });
});
