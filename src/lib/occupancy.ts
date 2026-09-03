/**
 * occupancy — who may stay, and how a party is described.
 *
 * The property's real rule is a TOTAL WITH AN ADULT CAP, not two independent caps:
 *
 *     1 <= adults <= maxAdults
 *     adults + children <= maxGuests
 *
 * For Prahova that is `1..5` adults and 7 people, so 5+2 and 4+3 are both valid and children are
 * bounded only by what the total leaves. An earlier model stored `maxChildren: 2` and rendered
 * "5 adulti + 2 copii" as though the pair were the only configuration, which UNDERSTATED capacity to
 * exactly the family parties most likely to fill the house. There is deliberately no `maxChildren`
 * here — it cannot be expressed as a constant without excluding a legal party.
 *
 * The `adults >= 1` floor exists so children cannot book alone, and that is its ONLY purpose. A
 * two-adult minimum was considered and declined: it would reject solo travellers, and they pay the
 * base rate anyway since anything at or below base occupancy costs the same.
 *
 * Pure. No I/O, no framework, no property fetch — callers pass the limits they already hold.
 */

export interface Party {
  adults: number;
  children: number;
}

/** The limits as a property states them. `maxAdults` is optional: not every property caps adults. */
export interface OccupancyLimits {
  maxGuests: number;
  maxAdults?: number | null;
}

export type PartyRejection =
  /** Children cannot book without an adult. */
  | 'no_adult'
  /** More adults than the place can sleep as adults, even though the headcount may fit. */
  | 'too_many_adults'
  /** The headcount exceeds the property ceiling. */
  | 'too_many_guests'
  /** Not a whole, non-negative party — a malformed request rather than a refused one. */
  | 'malformed';

export type PartyCheck = { ok: true } | { ok: false; reason: PartyRejection };

/**
 * Checked in the order a person would notice the problem: is this a party at all, are there too many
 * adults, does the headcount fit. `too_many_adults` is reported before `too_many_guests` because it
 * is the more specific and more surprising refusal — 6 adults fits the ceiling of 7 and is still
 * refused, and a message about the total would not explain why.
 */
export function validateParty(party: Party, limits: OccupancyLimits): PartyCheck {
  const { adults, children } = party;

  if (
    !Number.isInteger(adults) || !Number.isInteger(children) ||
    adults < 0 || children < 0
  ) {
    return { ok: false, reason: 'malformed' };
  }

  if (adults < 1) return { ok: false, reason: 'no_adult' };

  if (limits.maxAdults != null && adults > limits.maxAdults) {
    return { ok: false, reason: 'too_many_adults' };
  }

  if (adults + children > limits.maxGuests) {
    return { ok: false, reason: 'too_many_guests' };
  }

  return { ok: true };
}

/**
 * The largest number of children that may accompany this many adults.
 *
 * This is what a guest selector binds its second control to, and it is why `maxChildren` is not a
 * stored field: the answer moves as the adult count moves.
 */
export function maxChildrenFor(adults: number, limits: OccupancyLimits): number {
  return Math.max(0, limits.maxGuests - Math.max(0, adults));
}

/** The largest number of adults this property accepts, whichever limit binds first. */
export function maxAdultsFor(limits: OccupancyLimits): number {
  return Math.min(limits.maxGuests, limits.maxAdults ?? limits.maxGuests);
}

/**
 * Resolve a bare headcount into a legal party.
 *
 * Needed wherever a total arrives without a composition: a `?guests=7` link, a session stored before
 * the split existed, or a suggested stay tapped on the entry panel. Seven people cannot be seven
 * adults here, so the headcount the visitor asked for is preserved and the overflow becomes children
 * — 7 resolves to 5 + 2 rather than being refused or silently reduced.
 */
export function splitHeadcount(total: number, limits: OccupancyLimits): Party {
  const capped = Math.min(Math.max(1, Math.floor(total) || 1), limits.maxGuests);
  const adults = Math.min(capped, maxAdultsFor(limits));
  return { adults, children: capped - adults };
}

/**
 * Pull a party back inside the rules, adults first.
 *
 * The guest selector needs this because the two controls are coupled: raising adults to 5 when 3
 * children are already chosen would make 8 people. Children give way, because the adult count is the
 * one the visitor just touched.
 */
export function clampParty(party: Party, limits: OccupancyLimits): Party {
  const adults = Math.min(Math.max(1, party.adults), maxAdultsFor(limits));
  return { adults, children: Math.min(Math.max(0, party.children), maxChildrenFor(adults, limits)) };
}

// ============================================================================
// Describing a party
// ============================================================================

export type Language = 'ro' | 'en';

/**
 * Narrow a loose language string to the two this module renders.
 *
 * Call sites carry `lang` as a plain `string` (the landing renderer, the email service, the booking
 * UI). Doing the ternary at each of them invites one of them to drift; doing it here fixes the
 * fallback in one place: anything that is not Romanian renders as English.
 */
export const asLanguage = (lang: string | null | undefined): Language => (lang === 'ro' ? 'ro' : 'en');

/**
 * "3 adulti, 1 copil" — moved verbatim from `housekeepingService` so email, admin and the booking UI
 * describe a party the same way.
 *
 * NOTE ON DIACRITICS, do not "fix" this: this string goes to WhatsApp and is deliberately written
 * WITHOUT Romanian diacritics. `capacityLabel` below is web copy and deliberately keeps them. The two
 * differ on purpose.
 *
 * Only for a party whose split is actually KNOWN. When it is not, use `formatHeadcount` — rendering
 * an absent split as "0 copii" states something nobody established.
 */
export function formatGuestCount(
  adults: number,
  children: number,
  language: Language,
  opts: { diacritics?: boolean } = {}
): string {
  if (language === 'ro') {
    const parts: string[] = [];
    if (adults === 1) {
      parts.push('1 adult');
    } else {
      // The ONLY word here that carries a diacritic. Default off for WhatsApp; email turns it on,
      // because the rest of the Romanian email copy is written with diacritics and a bare "adulti"
      // in the middle of it reads like a typo.
      parts.push(`${adults} ${opts.diacritics ? 'adulți' : 'adulti'}`);
    }
    if (children > 0) {
      if (children === 1) {
        parts.push('1 copil');
      } else {
        parts.push(`${children} copii`);
      }
    }
    return parts.join(', ');
  }

  const parts: string[] = [];
  parts.push(`${adults} adult${adults !== 1 ? 's' : ''}`);
  if (children > 0) {
    parts.push(`${children} child${children !== 1 ? 'ren' : ''}`);
  }
  return parts.join(', ');
}

/**
 * The property's capacity as a guest-facing phrase: "pana la 7 persoane (max. 5 adulti)".
 *
 * Web copy, so diacritics are correct here — see the note on `formatGuestCount`.
 *
 * The adult cap is stated only when it actually BINDS (`maxAdults < maxGuests`). A property whose
 * adult cap equals its ceiling has no constraint worth a parenthesis, and printing one there is noise
 * for every property that is not this chalet.
 */
export function capacityParts(
  limits: OccupancyLimits,
  language: Language
): { primary: string; qualifier: string | null } | null {
  const { maxGuests, maxAdults } = limits;
  const ro = language === 'ro';

  if (maxGuests) {
    const primary = ro ? `până la ${maxGuests} persoane` : `up to ${maxGuests} guests`;
    const binds = maxAdults != null && maxAdults < maxGuests;
    return {
      primary,
      qualifier: binds
        ? (ro ? `(max. ${maxAdults} adulți)` : `(max. ${maxAdults} adults)`)
        : null,
    };
  }

  if (maxAdults != null) {
    return {
      primary: ro ? `până la ${maxAdults} adulți` : `up to ${maxAdults} adults`,
      qualifier: null,
    };
  }

  return null;
}


// ============================================================================
// Unknown is not zero
// ============================================================================

/**
 * Did this booking's party include children? `null` when nobody ever recorded it.
 *
 * This exists because the same mistake was made independently in two places: `(numberOfChildren ?? 0)
 * > 0` reads a MISSING composition as a recorded zero. 73 of 175 stored bookings have no value — they
 * predate the field or came from a channel that never sent it — and coalescing them to 0 turned
 * "we never asked" into "there were no children", which then travelled into an analyst statistic and
 * into the grounded facts a copywriter may assert. Naming the semantic is what stops it happening a
 * third time.
 */
export function hadChildren(booking: { numberOfChildren?: number | null }): boolean | null {
  return booking.numberOfChildren != null ? booking.numberOfChildren > 0 : null;
}

/**
 * The share of a set of bookings whose party included children, over the ones that actually SAY.
 *
 * Returns the sample alongside the figure: a percentage computed on 97 of 170 bookings is a different
 * claim from one computed on all 170, and a reader given only the number cannot tell which it holds.
 */
export function childrenShare(
  bookings: Array<{ numberOfChildren?: number | null }>
): { pct: number | null; knownOf: number; ofTotal: number } {
  const known = bookings.filter(b => b.numberOfChildren != null);
  if (!known.length) return { pct: null, knownOf: 0, ofTotal: bookings.length };
  const withKids = known.filter(b => (b.numberOfChildren as number) > 0).length;
  return {
    pct: Math.round((withKids / known.length) * 100),
    knownOf: known.length,
    ofTotal: bookings.length,
  };
}
