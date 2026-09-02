/**
 * The comparable set: what a competitor listing IS, and which of the owner's parties it can host.
 *
 * THE UNIT OF CURATION IS A LISTING, NOT A PROPERTY. A house on Airbnb and the same house on
 * Booking.com are two records, because they compete in two separate contests in front of two
 * different audiences, at prices the owner sets separately (C8). `sameAs` links them for display and
 * for curation hygiene; nothing in this module reads it.
 *
 * THE COMPARABLE IS THE UNIT, NOT THE PROPERTY EITHER. The Cliff Village is not one competitor with
 * an asterisk — it is a 200 m² two-bedroom villa AND a three-bedroom deluxe AND a 300 m² four-bedroom,
 * each separately bookable, each a whole house with its own kitchen. So capacity is a TABLE, never a
 * scalar: "three rooms of two" is a fact a single number cannot carry, and the scalar version of this
 * module would have written off a property that comfortably hosts a party of four.
 *
 * Pure. No I/O, no clock (`now` is injected). Everything here is a fact about the listing or a
 * deterministic consequence of the owner's stated booking rules — never a price. Prices live in
 * `channelPriceObservations`; this module only decides whether a price is worth asking for.
 */
import type { ChannelId } from '@/lib/channels';
import type { Party } from '@/lib/parity/party';
import { partySize, childAges } from '@/lib/parity/party';

/**
 * One separately bookable unit type, as the listing's availability section states it.
 *
 * `count` is **INVENTORY** — how many units of this type the property has — not how many remain on a
 * given date. The two must not share a field: inventory is curation and changes when the owner builds
 * another cabin; remaining availability changes hourly and IS the absorption signal, so it belongs to
 * an observation with a date and a URL attached.
 *
 * In practice inventory is read as a LOWER BOUND: a probe shows the rows bookable on those dates, so
 * a property with four cabins and one sold shows three. That is fine — a lower bound never invents
 * capacity — but it means `count` may rise at a later verification and should never be treated as
 * exact. `null` means nobody has read it, which is different from zero and must never quietly become
 * one.
 */
export interface CompetitorUnit {
  label: string;
  /** From `Max persons: N` / `Max adults: N`, or counted from the bed configuration. Never from
   *  `Sleeps:` or `Recommended for`, which echo the search rather than describing the unit. */
  maxPersons: number;
  count: number | null;
  sqm?: number | null;
}

export type CompetitorPropertyType =
  | 'whole-house' | 'cabin' | 'villa' | 'apartment' | 'studio' | 'guesthouse' | 'other';

/** How much the hero photo can be trusted to belong to this listing. */
export type PhotoProvenance =
  /** The og:image path embeds the listing id (newer listings). Self-verifying. */
  | 'id-matched'
  /** A bare uuid path (older listings). Trusted only because it came from that page load. */
  | 'capture-context';

export interface CompetitorListing {
  /** Owner-assigned, stable, and embedded in every cell id — so it must never change. No `|`. */
  listingId: string;
  propertyId: string;
  displayName: string;

  /** The contest this listing competes in. One channel per record (C8). */
  channel: ChannelId;
  url: string;

  /** What the admin list shows: name, city, picture, link. */
  city: string;
  heroPhotoUrl: string | null;
  photoProvenance?: PhotoProvenance;

  /** The same physical house on the other channel. Owner-asserted. DISPLAY ONLY — never merged. */
  sameAs?: { listingId: string; assertedBy: string; basis: string };

  /**
   * Every separately bookable unit. Empty means capacity has not been read yet — which is the normal
   * state for a Booking listing after curation, because Booking states capacity only on a priced
   * probe (Airbnb states it on the listing page).
   */
  units: CompetitorUnit[];

  propertyType: CompetitorPropertyType;
  distanceKm: number | null;

  /** Quality, reported beside price and never folded into it. Its own date. */
  rating: number | null;
  reviewCount: number | null;
  qualityAsOf: string | null;

  /** The price-moving ones only: hot tub, sauna, pool, fireplace, yard. Not a feature dump. */
  amenities: string[];

  /**
   * WHY this competes, in the owner's own words. Re-read at every verification, and the only defence
   * against a set that silently rots into "houses near Comarnic".
   */
  substitutionBasis: string;

  /**
   * Who the listing will not take, as a standing policy rather than an availability fact.
   *
   * Booking states these on the page — *"Ooops! This is an adult-only property"*, *"Ooops! Only
   * children 12 years and older can stay here"* — and then still prints a price, which is the trap in
   * §24. Worse, the SEARCH simply omits such a property for a barred party, so the absence arrives
   * looking exactly like a sell-out: 44 rows across 13 windows were stored as `unavailable`, inflating
   * the share of the field that had supposedly sold and pushing windows toward a scarcity reading
   * they had not earned.
   *
   * A bar is not demand. Recording it here takes the listing out of the field for that party
   * altogether — no probe, no denominator, no false scarcity — and it is PER CHANNEL, because it
   * really is: both of these take families on Airbnb and refuse them on Booking.
   */
  partyPolicy?: {
    adultsOnly?: boolean;
    /** Children below this age are not accepted. */
    minChildAge?: number;
    /** Where the policy was read, verbatim, so it can be re-checked rather than believed. */
    source?: string;
  };

  active: boolean;
  retiredReason?: string;

  curatedBy: string;
  /** Null until a human has confirmed the record. The set AGES; an unverified entry is not a fact. */
  verifiedAt: string | null;
}

/** How this listing can accommodate a party, if at all. */
export type PartyFit =
  /** One unit takes the whole party. The ordinary case and the only one a family will accept. */
  | { kind: 'single'; units: CompetitorUnit[]; unitCount: 1; stockUnknown: boolean }
  /** Several units together take the party — allowed only under the splitting rule in `hostsParty`. */
  | { kind: 'combination'; units: CompetitorUnit[]; unitCount: number; stockUnknown: boolean }
  /**
   * The listing cannot serve this party the way this party books. A FINDING, not a gap (C4): it is
   * competition the owner does not face on this window.
   */
  | { kind: 'out-of-set'; reason: string }
  /** Capacity is not known yet, so nothing can be said. Never counted as a moat. */
  | { kind: 'unknown'; reason: string };

export const largestUnit = (l: Pick<CompetitorListing, 'units'>): number =>
  l.units.reduce((m, u) => Math.max(m, u.maxPersons), 0);

/** Total person-places on offer, treating unread stock as one unit — see `hostsParty`. */
export const totalCapacity = (l: Pick<CompetitorListing, 'units'>): number =>
  l.units.reduce((n, u) => n + u.maxPersons * (u.count ?? 1), 0);

export const unitCount = (l: Pick<CompetitorListing, 'units'>): number =>
  l.units.reduce((n, u) => n + (u.count ?? 1), 0);

/** More than one bookable unit changes how absorption reads: it sells out later and more rarely. */
export const isMultiUnit = (l: Pick<CompetitorListing, 'units'>): boolean => unitCount(l) > 1;

/** Below this age a child sleeps in the adults' unit; at or above it, a room of their own is fine. */
export const SEPARATE_ROOM_MIN_AGE = 7;

/**
 * Can this listing host this party, and in how many units?
 *
 * **The splitting rule is the owner's.** Stated 2026-09-01:
 *
 * > *"we are a group of 6 adults, we can share 2 or 3 units. If I'm with kids, is less likely to put
 * > small children in another unit."*
 *
 * and refined 2026-09-02, which is the rule now implemented:
 *
 * > *"a kid around 7 or older is acceptable in a second room for properties that sell these type of
 * > accommodation"*
 *
 * So it is AGE, not the presence of children, that decides. Every child under {@link
 * SEPARATE_ROOM_MIN_AGE} must be in a unit with an adult; older children and adults may be placed
 * anywhere. Ages come from the party's own configuration (`childAges`), never from an assumption —
 * the configured mix is 2a+1c with a ten-year-old, and 4a+2c with a ten- and a four-year-old, so the
 * first party CAN split and the second still needs a unit that holds an adult plus the four-year-old.
 *
 * The first reading of the older rule cost a real comparable: Casutele de la Poienita was recorded as
 * unable to host 2a+1c while Booking was selling it to exactly that party as two double rooms, so a
 * priced competitor sat outside the ladder.
 *
 * Feasibility with a combination is therefore two conditions, not one: everybody fits across the
 * available units, AND some unit is big enough for one adult plus every under-age child. Checking
 * only the total would house a four-year-old alone.
 *
 * The asymmetry that matters: when a party cannot be housed even by combining, that is `out-of-set` —
 * a real moat, because that family will not book there. But **unread capacity is `unknown`, never a
 * moat**: claiming "no competition here" on missing data is wrong in the flattering direction, and
 * the flattering direction is the one nobody catches.
 *
 * This decides FEASIBILITY only. What a combination COSTS is a question for observed prices, and it
 * takes the cheapest units rather than the fewest — a different ordering, deliberately elsewhere.
 */
export function hostsParty(
  listing: Pick<CompetitorListing, 'units'> & Pick<Partial<CompetitorListing>, 'partyPolicy'>,
  party: Party,
): PartyFit {
  const need = partySize(party);

  // A standing bar comes first: no amount of capacity makes a property that will not take children
  // a comparable for a family. Checked before capacity so it never reaches the scarcity denominator
  // — an adults-only listing absent from a family search is not a sold-out one.
  const policy = listing.partyPolicy;
  if (policy && party.children > 0) {
    if (policy.adultsOnly) {
      return { kind: 'out-of-set', reason: 'adults-only property — it will not take a party with children' };
    }
    if (policy.minChildAge != null) {
      const tooYoung = childAges(party).filter((age) => age < policy.minChildAge!);
      if (tooYoung.length) {
        return {
          kind: 'out-of-set',
          reason: `accepts children from ${policy.minChildAge} only, and this party includes ` +
                  `${tooYoung.length === 1 ? `a ${tooYoung[0]}-year-old` : `children aged ${tooYoung.join(' and ')}`}`,
        };
      }
    }
  }
  if (!listing.units.length) {
    return { kind: 'unknown', reason: 'capacity not read yet — Booking states it only on a priced probe' };
  }
  if (need < 1) return { kind: 'unknown', reason: 'empty party' };

  // Fewest units first: the smallest unit that still fits the whole party, so we do not "solve" a
  // family into the 10-person villa when a 6-person one would do.
  const fits = listing.units
    .filter((u) => u.maxPersons >= need && (u.count === null || u.count > 0))
    .sort((a, b) => a.maxPersons - b.maxPersons);
  if (fits.length) {
    return { kind: 'single', units: [fits[0]], unitCount: 1, stockUnknown: fits[0].count === null };
  }

  // Combine, largest first, so this answers "is it possible" in the fewest units.
  // Unread stock counts as exactly one unit — enough to not pretend the unit is absent, never enough
  // to invent inventory that may not exist. A sold-out unit is not in the pool at all, which is why
  // the anchor below is measured against what is BOOKABLE rather than against `largestUnit`.
  const pool = [...listing.units]
    .filter((u) => u.count === null || u.count > 0)
    .sort((a, b) => b.maxPersons - a.maxPersons);

  // Every child too young for a room of their own has to be with an adult, so one bookable unit must
  // hold at least that group. The biggest available unit is the best case: if even it is too small,
  // no arrangement of the rest can rescue it.
  const tooYoung = childAges(party).filter((age) => age < SEPARATE_ROOM_MIN_AGE).length;
  const anchorNeeds = tooYoung > 0 ? tooYoung + 1 : 1;
  const biggestAvailable = pool.length ? pool[0].maxPersons : 0;
  if (tooYoung > 0 && biggestAvailable < anchorNeeds) {
    return {
      kind: 'out-of-set',
      reason: `no single unit takes ${need} (largest is ${largestUnit(listing)}), and no bookable unit ` +
              `holds an adult plus ${tooYoung} child${tooYoung === 1 ? '' : 'ren'} under ` +
              `${SEPARATE_ROOM_MIN_AGE}, who cannot have a unit to themselves`,
    };
  }
  const taken: CompetitorUnit[] = [];
  let seats = 0;
  let stockUnknown = false;
  for (const u of pool) {
    const available = u.count ?? 1;
    if (u.count === null) stockUnknown = true;
    for (let i = 0; i < available && seats < need; i++) {
      taken.push(u);
      seats += u.maxPersons;
    }
    if (seats >= need) break;
  }
  if (seats >= need) {
    return { kind: 'combination', units: taken, unitCount: taken.length, stockUnknown };
  }
  return {
    kind: 'out-of-set',
    reason: `${need} people do not fit even across every available unit (${totalCapacity(listing)} places)`,
  };
}

/** The parties this listing competes for, and the ones it does not. Zero page loads — this is C4. */
export function fieldMembership(
  listing: Pick<CompetitorListing, 'units'>,
  parties: Party[],
): Array<{ party: Party; fit: PartyFit }> {
  return parties.map((party) => ({ party, fit: hostsParty(listing, party) }));
}

/** A listing worth probing for this party: it can host it, one way or another. */
export const isProbeworthy = (fit: PartyFit): boolean =>
  fit.kind === 'single' || fit.kind === 'combination' || fit.kind === 'unknown';

export const VERIFICATION_BUDGET_DAYS = 180;

/**
 * How stale the curation is. An entry nobody has re-checked is a hypothesis about a listing that may
 * have been remodelled, repriced, relisted or delisted — so the set ages rather than staying true.
 */
export function verificationAge(
  listing: Pick<CompetitorListing, 'verifiedAt'>,
  now: Date,
): { ageDays: number | null; stale: boolean; unverified: boolean } {
  if (!listing.verifiedAt) return { ageDays: null, stale: true, unverified: true };
  const ms = now.getTime() - Date.parse(listing.verifiedAt);
  if (!Number.isFinite(ms)) return { ageDays: null, stale: true, unverified: true };
  const ageDays = Math.floor(ms / 86_400_000);
  return { ageDays, stale: ageDays > VERIFICATION_BUDGET_DAYS, unverified: false };
}

/** Refuse a listingId that would corrupt a cell id. Same rule as `cellId`, checked at curation time. */
export function assertListingId(id: string): void {
  if (!id || id.includes('|')) {
    throw new Error(`listingId must be non-empty and free of "|" — got ${JSON.stringify(id)}`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error(
      `listingId "${id}" must be lowercase kebab-case — it is embedded in every cell id for the ` +
      `life of the record and can never be renamed without orphaning its history.`,
    );
  }
}

/**
 * Fields a curated entry must carry before it is worth anything. `substitutionBasis` is on this list
 * deliberately: a comparable nobody can explain is the thing C1 exists to prevent.
 */
export function validateListing(l: Partial<CompetitorListing>): string[] {
  const problems: string[] = [];
  if (!l.listingId) problems.push('listingId is required');
  else { try { assertListingId(l.listingId); } catch (e) { problems.push((e as Error).message); } }
  if (!l.propertyId) problems.push('propertyId is required — the set is per property, never global');
  if (!l.displayName?.trim()) problems.push('displayName is required (the admin list shows it)');
  if (!l.channel) problems.push('channel is required — a listing competes on exactly one');
  if (!l.url?.trim()) problems.push('url is required');
  if (!l.city?.trim()) problems.push('city is required (the admin list shows it)');
  if (!l.substitutionBasis?.trim()) {
    problems.push('substitutionBasis is required — a comparable nobody can explain rots the set');
  }
  if (l.sameAs && l.sameAs.listingId === l.listingId) problems.push('sameAs cannot point at itself');
  for (const u of l.units ?? []) {
    if (!(u.maxPersons > 0)) problems.push(`unit "${u.label}" needs a positive maxPersons`);
    if (u.count !== null && u.count !== undefined && u.count < 0) {
      problems.push(`unit "${u.label}" has a negative count`);
    }
  }
  return problems;
}
