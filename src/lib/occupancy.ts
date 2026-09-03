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
export function formatGuestCount(adults: number, children: number, language: Language): string {
  if (language === 'ro') {
    const parts: string[] = [];
    if (adults === 1) {
      parts.push('1 adult');
    } else {
      parts.push(`${adults} adulti`);
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
 * "4 oaspeti" — a headcount with no claim about its composition.
 *
 * 73 of the 175 stored bookings carry no `numberOfChildren`, and that is an unknown rather than a
 * zero. This is what an unknown split renders as. Diacritic-free for the same reason as above.
 */
export function formatHeadcount(total: number, language: Language): string {
  if (language === 'ro') {
    return total === 1 ? '1 oaspete' : `${total} oaspeti`;
  }
  return `${total} guest${total !== 1 ? 's' : ''}`;
}

/**
 * How a booking's party reads, choosing honestly between the two renderers above.
 *
 * `children == null` means the split was never recorded, so `total` is all that can be said.
 */
export function describeGuests(
  booking: { numberOfAdults?: number | null; numberOfChildren?: number | null; numberOfGuests?: number | null },
  language: Language
): string {
  const { numberOfAdults, numberOfChildren, numberOfGuests } = booking;

  if (numberOfAdults != null && numberOfChildren != null) {
    return formatGuestCount(numberOfAdults, numberOfChildren, language);
  }

  const total = numberOfGuests ?? numberOfAdults ?? 0;
  return formatHeadcount(total, language);
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

/** The same thing as one string, for anywhere that cannot style the two halves separately. */
export function capacityLabel(limits: OccupancyLimits, language: Language): string | null {
  const parts = capacityParts(limits, language);
  if (!parts) return null;
  return [parts.primary, parts.qualifier].filter(Boolean).join(' ');
}
