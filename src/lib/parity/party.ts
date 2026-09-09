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
  /**
   * This party's child ages, oldest first, overriding the property-wide `CHILD_AGES`.
   *
   * Needed because the shared list cannot express an INFANT. Booking hosts 0-2 free and charges for
   * 3-17 (confirmed from the owner's settings, 2026-09-09), while the direct engine charges the same
   * per-head fee whatever the age — so a family with a baby is the shape where direct is
   * structurally dearest, and the standard mix (ages 10 and 4) could never reveal it. A party that
   * states its own ages can.
   */
  childAges?: number[];
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
export const childAges = (p: Party): number[] =>
  (p.childAges ?? CHILD_AGES).slice(0, p.children);

export const partySize = (p: Party): number => p.adults + p.children;
export const partyLabel = (p: Party): string => {
  if (!p.children) return `${p.adults}a`;
  // Ages are part of the identity when they are not the default: "4a+1c" and "4a+1i" price
  // identically on our side and very differently on Booking's, and a label that hid the difference
  // would make two distinct measurements look like a repeat.
  const ages = childAges(p);
  const infants = ages.filter((a: number) => a <= INFANT_MAX_AGE).length;
  const kids = p.children - infants;
  return `${p.adults}a${kids ? `+${kids}c` : ''}${infants ? `+${infants}i` : ''}`;
};

/** The oldest age still counted an infant. Booking's own band is 0-2 and this mirrors it. */
export const INFANT_MAX_AGE = 2;

/** The party a stored cell refers to. Cells carry only a headcount, so the shape comes from the mix. */
export function partyForGuests(parties: Party[], guests: number): Party {
  return parties.find((p) => partySize(p) === guests)
    // Nothing in the mix matches — fall back to the old derivation, which is a guess and is the
    // behaviour this module exists to stop relying on.
    ?? { adults: Math.min(guests, 5), children: Math.max(0, guests - 5) };
}

/**
 * Two parties of the same SIZE are one cell, and that is a data-integrity problem, not a style one.
 *
 * `cellId` keys on `(property, checkIn, checkOut, guests, channel)` — the headcount, never the shape.
 * So `4 adults + 1 infant` and `5 adults` are the same cell: a fresh capture of one silently
 * supersedes the other, and the two price very differently on the OTAs (Booking charges for a fifth
 * adult and nothing for an infant) while pricing IDENTICALLY here, where only heads are counted.
 * Adding an infant party at 5 heads on 2026-09-09 would have overwritten 16 stored five-adult
 * readings and shown the overwrite as a large improvement.
 *
 * The real fix is for `cellId` to carry the shape; that changes every existing id and blanks the
 * store's history, so until it is done the mix must keep one party per headcount.
 */
function headcountClash(parties: Party[]): string | undefined {
  const seen = new Map<number, Party>();
  for (const p of parties) {
    const n = partySize(p);
    const prev = seen.get(n);
    if (prev) {
      return `compareParties has two parties of ${n} guests (${partyLabel(prev)} and ${partyLabel(p)}). ` +
        'Cells are keyed by headcount, so they share one cell and each capture overwrites the other. ' +
        'Give one of them a different size.';
    }
    seen.set(n, p);
  }
  return undefined;
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
    return {
      parties: c.compareParties,
      source: 'property.channelPricing.compareParties',
      warning: headcountClash(c.compareParties),
    };
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
  const partyAges = childAges(p.party);
  // Both platforms treat an under-2 as a different product from a child, and each says so its own
  // way: Airbnb has a separate `infants` parameter (free, not counted in `children`), Booking prices
  // by the age you send. Collapsing an infant into `children` asks for — and prices — a party that
  // is not the one travelling.
  const infants = partyAges.filter((a) => a <= INFANT_MAX_AGE).length;
  const kids = children - infants;
  if (channel === 'airbnb') {
    const id = listingUrl.match(/\/rooms\/(\d+)/)?.[1];
    if (!id) return null;
    return `https://www.airbnb.com/rooms/${id}?check_in=${p.checkIn}&check_out=${p.checkOut}` +
           `&adults=${adults}${kids ? `&children=${kids}` : ''}${infants ? `&infants=${infants}` : ''}`;
  }
  if (channel === 'booking.com') {
    const base = listingUrl.split('?')[0];
    const ages = childAges(p.party).map((a) => `&age=${a}`).join('');
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
