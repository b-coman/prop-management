/**
 * WHICH PARTIES TO PRICE, and why the shape matters rather than just the headcount.
 *
 * The owner's mix (2026-08-30): **2 adults + 1 child · 4 adults · 4 adults + 2 children.**
 *
 * Shape, not size, because the three sides price children differently and one of them does not know
 * they exist. The direct engine takes a single `guests` count and charges `extraGuestFee` per head
 * above `baseOccupancy`, so a child costs what an adult costs. Airbnb has a separate `children`
 * parameter. Booking prices by child AGE and needs one `age` per child.
 *
 * An earlier version DERIVED the split from a headcount (first 5 adults, the rest children). That
 * asked the platforms for a party this property cannot host — its cap is 5 adults plus 2 children —
 * so Booking refused (and the refusals were misread as gaps in his listing) while Airbnb answered for
 * 6 adults and the price went into the store as if it were his. 38 forward observations were wrong,
 * and they inflated Fall from +14.6% to +35.9%. Deriving it was the mistake; it is configuration.
 *
 * Pure. No I/O.
 */
export interface Party {
  adults: number;
  children: number;
}

export const DEFAULT_PARTIES: Party[] = [
  { adults: 2, children: 1 },
  { adults: 4, children: 0 },
  { adults: 4, children: 2 },
];

/**
 * Ages Booking is told, oldest first, trimmed to the party's child count. Taken from a real booking
 * on this property (children aged 4 and 10) rather than invented, because Booking's price depends on
 * them — an under-2 is often free and an under-6 discounted, so a guessed age is a guessed price.
 */
export const CHILD_AGES = [10, 4];

/**
 * The ages of THIS party's children, oldest first.
 *
 * A party carries a child COUNT, and Booking prices by age, so the ages come from `CHILD_AGES` in the
 * same order the capture URL uses them. Anything reasoning about what children can and cannot do —
 * such as whether one is old enough for a room of their own — must read them from here rather than
 * assume, so a change to the configured ages moves every such judgement with it.
 */
export const childAges = (p: Party): number[] => CHILD_AGES.slice(0, p.children);

export const partySize = (p: Party): number => p.adults + p.children;
export const partyLabel = (p: Party): string => `${p.adults}a${p.children ? `+${p.children}c` : ''}`;

/** The party a stored cell refers to. Cells carry only a headcount, so the shape comes from the mix. */
export function partyForGuests(parties: Party[], guests: number): Party {
  return parties.find((p) => partySize(p) === guests)
    // Nothing in the mix matches — fall back to the old derivation, which is a guess and is the
    // behaviour this module exists to stop relying on.
    ?? { adults: Math.min(guests, 5), children: Math.max(0, guests - 5) };
}

export interface PartyMix {
  parties: Party[];
  source: string;
  warning?: string;
}

/**
 * Read the configured mix. Accepts the older `compareOccupancies` headcount form so existing config
 * still loads, but says plainly that a bare number cannot express a shape and is being guessed at.
 */
export function partiesFor(cfg: unknown): PartyMix {
  const c = cfg as { compareParties?: Party[]; compareOccupancies?: number[] } | undefined;
  if (c?.compareParties?.length) {
    return { parties: c.compareParties, source: 'property.channelPricing.compareParties' };
  }
  if (c?.compareOccupancies?.length) {
    return {
      parties: c.compareOccupancies.map((n) => partyForGuests([], n)),
      source: 'property.channelPricing.compareOccupancies (legacy headcounts)',
      warning: 'compareOccupancies carries only a headcount, so the adult/child split is a guess. ' +
               'Set compareParties to state the real shapes.',
    };
  }
  return { parties: DEFAULT_PARTIES, source: 'built-in default mix' };
}

/** The capture URL for one party on one channel. The ONLY place a probe becomes a web address. */
export function buildCaptureUrl(
  channel: string,
  listingUrl: string | undefined,
  p: { checkIn: string; checkOut: string; party: Party },
): string | null {
  if (!listingUrl) return null;
  const { adults, children } = p.party;
  if (channel === 'airbnb') {
    const id = listingUrl.match(/\/rooms\/(\d+)/)?.[1];
    if (!id) return null;
    return `https://www.airbnb.com/rooms/${id}?check_in=${p.checkIn}&check_out=${p.checkOut}` +
           `&adults=${adults}${children ? `&children=${children}` : ''}`;
  }
  if (channel === 'booking.com') {
    const base = listingUrl.split('?')[0];
    const ages = CHILD_AGES.slice(0, children).map((a) => `&age=${a}`).join('');
    return `${base}?checkin=${p.checkIn}&checkout=${p.checkOut}&group_adults=${adults}` +
           `&group_children=${children}${ages}&no_rooms=1&selected_currency=RON`;
  }
  if (channel === 'vrbo') {
    const base = listingUrl.split('?')[0];
    return `${base}?arrival=${p.checkIn}&departure=${p.checkOut}&adults=${adults}` +
           `${children ? `&children=${children}` : ''}`;
  }
  return null;
}
