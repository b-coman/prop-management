/**
 * Turning a verified Booking search page into rows for the one write path.
 *
 * Extracted so `comp-search` (one window, interactive) and `comp-run` (a whole batch, unattended
 * after the browser step) cannot drift. The alternative was a second copy of the row shape in the
 * batch runner, which is exactly the trap the protocol warns about — and a drifted copy here would be
 * invisible, because both scripts would keep reporting success while writing different provenance.
 *
 * PURE. Cards and a party in, plain row objects out. No I/O, no clock.
 */
import type { SearchCard } from './searchResults';
import type { CompetitorListing } from './set';
import type { Party } from '@/lib/parity/party';

export interface CaptureRow {
  competitorListingId: string;
  channel: 'booking.com';
  checkIn: string;
  checkOut: string;
  guests: number;
  status: 'captured' | 'unavailable';
  guestTotal?: number | null;
  listTotal?: number | null;
  promoActive?: boolean;
  ratePlan?: 'flexible';
  reason?: string;
  party: Party;
  url: string;
  sessionState: string;
  session?: { loggedIn: boolean; program: 'genius' | null; currency: string };
}

export interface RowsInput {
  curated: Array<{ card: SearchCard; listing: CompetitorListing }>;
  /** Curated listings the search did not return. On Booking that IS a finding — see below. */
  absent: CompetitorListing[];
  checkIn: string;
  checkOut: string;
  nights: number;
  party: Party;
  url: string;
}

export function bookingRows(input: RowsInput): CaptureRow[] {
  const { curated, absent, checkIn, checkOut, nights, party, url } = input;
  const guests = party.adults + party.children;
  const echo = `${nights}n, ${party.adults}a+${party.children}c`;

  return [
    ...curated.map(({ card, listing }): CaptureRow => ({
      competitorListingId: listing.listingId, channel: 'booking.com',
      checkIn, checkOut, guests,
      status: 'captured', guestTotal: card.price, listTotal: card.listPrice,
      promoActive: card.listPrice !== null, ratePlan: 'flexible',
      party, url,
      sessionState: `Booking SEARCH results, signed in, RON. One page load for the whole field, so ` +
                    `every price here was read under identical conditions. Card echo: ${echo}.`,
      // `programApplied` is deliberately ABSENT: a search card shows a struck-through price for a
      // Genius discount and for an ordinary promotion alike, and never says which. Unmeasured, not
      // false — `promoActive` records that SOMETHING was discounted, which is what we can see.
      session: { loggedIn: true, program: 'genius', currency: 'RON' },
    })),
    // An absence from a Booking search is a FINDING, unlike on Airbnb: one page holds the town, so a
    // missing property has been excluded rather than out-ranked. Tested at `no_rooms=3` as well as
    // `no_rooms=1` (§34.1) — Booking composes multi-room offers either way, so a park's absence is
    // just as real as a house's.
    ...absent.map((l): CaptureRow => ({
      competitorListingId: l.listingId, channel: 'booking.com',
      checkIn, checkOut, guests,
      status: 'unavailable', party, url,
      reason: `not returned by the Booking search for this party — either no availability or the ` +
              `property does not accept this party. The search is the authority on that; its detail ` +
              `page may still print a price (see docs §24.2).`,
      sessionState: 'Booking SEARCH results, signed in, RON — absence from the result set.',
    })),
  ];
}

/**
 * A card that is being offered as SEVERAL units rather than one.
 *
 * Booking writes `2×` beside a room name when it composes an offer from more than one unit, and the
 * card then reports the beds of the whole composition. Reading that as a single large unit is how
 * TETRA Plus 569 — two houses of three — got recorded as one house of six (§34.1). Any capacity
 * inferred from a search must check this first: the search proves the property can house the party,
 * never in how many pieces.
 */
export function looksComposed(cardText: string): boolean {
  return /\b\d+\s*×/.test(cardText);
}
