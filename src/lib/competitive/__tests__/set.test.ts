/** @jest-environment node */

/**
 * The set logic, tested against the REAL measured comparables (docs §12-14) rather than invented
 * shapes — because every subtlety here came from one of them, and a fixture that does not resemble
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

const P_2A1C: Party = { adults: 2, children: 1 };   // 3
const P_4A: Party = { adults: 4, children: 0 };     // 4
const P_4A2C: Party = { adults: 4, children: 2 };   // 6

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

describe('a party with children needs ONE unit (the owner\'s rule)', () => {
  it('places a family of six in the smallest unit that fits, not the biggest', () => {
    const fit = hostsParty(CLIFF, P_4A2C);
    expect(fit.kind).toBe('single');
    if (fit.kind === 'single') expect(fit.units[0].label).toBe('Two-Bedroom Villa'); // 6, not the 10
  });

  it('marks a family of six OUT-OF-SET at a park whose largest unit takes four', () => {
    const fit = hostsParty(CASUTELE_DIN, P_4A2C);
    expect(fit.kind).toBe('out-of-set');
    if (fit.kind === 'out-of-set') expect(fit.reason).toMatch(/does not split/);
  });

  it('marks 2+1 out-of-set at a listing whose rooms take two, even though three rooms exist', () => {
    // Six person-places on site, and still no room a family of three will take.
    const fit = hostsParty(CASUTELE_DE_LA, P_2A1C);
    expect(fit.kind).toBe('out-of-set');
    expect(totalCapacity(CASUTELE_DE_LA)).toBeGreaterThan(3);
  });

  it('lets the 21 m² studio host 2+1 — it sleeps three in one unit', () => {
    expect(hostsParty(MOODYSUN, P_2A1C).kind).toBe('single');
  });
});

describe('an adults-only party may combine units', () => {
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

  it('respects stock — two rooms of two cannot seat six when only two remain', () => {
    const scarce = { units: [u('Double Room', 2, 2)] };
    expect(hostsParty(scarce, { adults: 6, children: 0 }).kind).toBe('out-of-set');
    const plenty = { units: [u('Double Room', 2, 3)] };
    expect(hostsParty(plenty, { adults: 6, children: 0 }).kind).toBe('combination');
  });

  it('never combines for a party with children, even when the seats exist', () => {
    // Same listing, same seat count, different answer — this IS the owner's rule.
    expect(hostsParty(CASUTELE_DE_LA, { adults: 4, children: 0 }).kind).toBe('combination');
    expect(hostsParty(CASUTELE_DE_LA, { adults: 2, children: 2 }).kind).toBe('out-of-set');
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

  it('still counts as probeworthy — the missing data is the reason TO probe', () => {
    expect(isProbeworthy(hostsParty({ units: [] }, P_4A2C))).toBe(true);
    expect(isProbeworthy(hostsParty(CASUTELE_DIN, P_4A2C))).toBe(false); // genuinely out of set
  });

  it('treats a sold-out unit as unavailable rather than absent', () => {
    expect(hostsParty({ units: [u('Villa', 8, 0)] }, P_4A).kind).toBe('out-of-set');
  });
});

describe('the field changes size with the party (C4)', () => {
  it('reproduces the measured Booking field', () => {
    // Six of the eight active Booking comparables — Villa The Frame (8) and AVA Chalet (6) are
    // omitted here because both host every party, so they add nothing to this test.
    const set = [CLIFF, VILA_LUNA, AYDA, CASUTELE_DIN, MOODYSUN, CASUTELE_DE_LA];
    const canHost = (p: Party) =>
      set.filter((l) => ['single', 'combination'].includes(hostsParty(l, p).kind)).length;
    expect(canHost(P_2A1C)).toBe(5);   // all but Casutele de la Poienita (rooms take two)
    expect(canHost(P_4A)).toBe(5);     // all but MoodySun (studio takes three)
    expect(canHost(P_4A2C)).toBe(2);   // only Cliff's 6-person villa and Vila Luna
  });

  it('MoodySun is in for 2+1 and out for four adults; Casutele de la is the reverse', () => {
    expect(hostsParty(MOODYSUN, P_2A1C).kind).toBe('single');
    expect(hostsParty(MOODYSUN, P_4A).kind).toBe('out-of-set');
    expect(hostsParty(CASUTELE_DE_LA, P_2A1C).kind).toBe('out-of-set');
    expect(hostsParty(CASUTELE_DE_LA, P_4A).kind).toBe('combination');
  });

  it('fieldMembership answers for every party in one call', () => {
    const rows = fieldMembership(CASUTELE_DIN, [P_2A1C, P_4A, P_4A2C]);
    expect(rows.map((r) => r.fit.kind)).toEqual(['single', 'single', 'out-of-set']);
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

  it('requires substitutionBasis — the field C1 exists for', () => {
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
