/**
 * The one closed vocabulary for distribution channels.
 *
 * THE PROBLEM THIS SOLVES: the same channel was spelled four different ways in four places —
 * `icalFeeds.name` ("Travelminit"), `bookings.source` ("travelmint", a typo), `channelPricing.channels[].channel`
 * and `channelPriceObservations.channel`. Nothing could be joined across them without a guess, so every
 * consumer either hardcoded its own list or silently dropped rows it did not recognise.
 *
 * These are NOT competitors. They are the owner's own listings of the owner's own property, priced by
 * the owner, on which the owner pays commission. `direct` is one channel among them — the one with no
 * commission — not a separate category.
 *
 * WHY `booking.com` AND NOT `booking`: because that is what production already says — 143 bookings,
 * 17 parity observations, the iCal feed and the persisted `channelPricing` all use `booking.com`.
 * `parityWorklist.cellId()` embeds the channel id, so renaming the canonical form would orphan every
 * observation already captured. The vocabulary follows the data; the data does not get rewritten to
 * flatter the vocabulary.
 */

import type { ChannelEconomics, DirectEconomics } from '@/lib/growth/parityMath';

// Re-exported so `@/lib/channels` is the one import for channel types. These are parityMath's own
// definitions, passed through — never a second copy. One definition of what a commission is.
export type { ChannelEconomics, DirectEconomics };

/** Every channel this property is (or has been) distributed on. Order is display order. */
export const CHANNEL_IDS = ['direct', 'airbnb', 'booking.com', 'vrbo', 'travelminit'] as const;

export type ChannelId = (typeof CHANNEL_IDS)[number];

/** `direct` is a channel, but it is the only one that charges no commission. */
export const OTA_CHANNEL_IDS = CHANNEL_IDS.filter((c) => c !== 'direct') as Exclude<ChannelId, 'direct'>[];

export function isChannelId(value: unknown): value is ChannelId {
  return typeof value === 'string' && (CHANNEL_IDS as readonly string[]).includes(value);
}

export function isOtaChannel(id: ChannelId): boolean {
  return id !== 'direct';
}

/**
 * Every spelling seen in production, plus the obvious near-misses.
 *
 * `travelmint` is a genuine typo in a live booking document (one row, missing the second `i`). It is
 * listed because normalising must not silently drop real revenue history — the booking happened, and
 * the misspelling is not the guest's fault.
 *
 * The `website-*` forms matter for a subtler reason: a direct booking is created as `website-pending`
 * and only promoted to `direct` once payment succeeds. Without these aliases the direct channel would
 * quietly split in two, and every "how much do we sell direct?" answer would be wrong by the number of
 * bookings currently mid-checkout.
 */
const ALIASES: Record<string, ChannelId> = {
  // direct
  'direct': 'direct',
  'website': 'direct',
  'website-pending': 'direct',
  'website-hold': 'direct',
  'own': 'direct',
  'own-website': 'direct',
  'rentalspot': 'direct',
  // airbnb
  'airbnb': 'airbnb',
  'airbnb.com': 'airbnb',
  'air bnb': 'airbnb',
  'abb': 'airbnb',
  // booking.com
  'booking.com': 'booking.com',
  'booking': 'booking.com',
  'bookingcom': 'booking.com',
  'booking com': 'booking.com',
  'bdc': 'booking.com',
  // vrbo
  'vrbo': 'vrbo',
  'vrbo.com': 'vrbo',
  'homeaway': 'vrbo',
  // travelminit
  'travelminit': 'travelminit',
  'travelminit.ro': 'travelminit',
  'travelmint': 'travelminit', // live typo in bookings.source
  'travel minit': 'travelminit',
};

/**
 * Map any recorded spelling to the canonical id.
 *
 * Returns `null` rather than guessing. An unknown channel is a fact worth surfacing — it usually means
 * a new listing exists that nothing else in the system knows about — and quietly bucketing it into
 * `direct` would corrupt the commission maths that depends on this answer.
 */
export function normalizeChannel(raw: unknown): ChannelId | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase().replace(/[_]+/g, ' ');
  return ALIASES[key] ?? ALIASES[key.replace(/\s+/g, '')] ?? null;
}

/** Human label for admin surfaces. */
export const CHANNEL_LABELS: Record<ChannelId, string> = {
  'direct': 'Direct (own website)',
  'airbnb': 'Airbnb',
  'booking.com': 'Booking.com',
  'vrbo': 'VRBO',
  'travelminit': 'Travelminit',
};

/**
 * How a channel's guest-facing price is rounded after gross-up. The owner's spreadsheet rounds to the
 * nearest 5 lei, and rounds the VRBO weekday leg up — so this is a per-channel setting, not a constant.
 */
export interface ChannelRounding {
  /** Round to the nearest multiple of this. 5 = nearest 5 lei. 0/undefined = no rounding. */
  nearest: number;
  mode: 'nearest' | 'up' | 'down';
}

/**
 * `channels/{propertyId}_{channelId}` — the per-property, per-channel configuration.
 *
 * `economics` is parityMath's OWN exported type, imported rather than redefined, so there is exactly
 * one definition of what a commission is.
 */
export interface ChannelConfig {
  propertyId: string;
  channelId: ChannelId;
  displayName: string;
  active: boolean;
  /** Why an inactive channel is inactive — e.g. "delisted 2026-08, documents pending". */
  inactiveReason?: string;
  /** Commission and guest-fee model. Absent for `direct`. */
  economics?: ChannelEconomics;
  /** What taking a direct booking costs. Only on `direct`. */
  directEconomics?: DirectEconomics;
  /**
   * Deliberate margin beyond the structural net-parity factor. This is the field that makes the
   * owner's spreadsheet legible: Booking's ×1.33 is not one number but commission + Genius + margin,
   * and only the last of those is a decision.
   */
  extraAdjustmentPct?: number;
  /** How much cheaper direct should look to the guest. Only on `direct`. */
  targetDirectDiscountPct?: number;
  currency: string;
  /**
   * Manual FX, for channels quoted in another currency (VRBO lists in USD). Never auto-fetched —
   * a silently-updating rate would change prices nobody decided to change. Staleness is flagged instead.
   */
  fx?: { rate: number; asOf: string; source: string } | null;
  cleaningFee?: number;
  /**
   * What this channel discounts a longer stay by, as the owner has it configured ON that channel.
   *
   * A FETCHED FACT, read off the platform's own settings screen and recorded here, never inferred
   * from captured prices. It decides whether a single direct nightly rate can track the channel at
   * all: if the two ladders differ, the direct-versus-platform gap moves with stay length on its own
   * and no rate can hold every length inside the band. Inferring it from captures was tried and was
   * wrong - it mixed channels, party sizes and promotions together.
   *
   * Rate plans that are a DIFFERENT PRODUCT are not comparable and are flagged rather than matched:
   * Booking's monthly rate is non-refundable, which a flexible direct booking is not.
   */
  lengthOfStayDiscounts?: Array<{
    nightsThreshold: number;
    discountPercentage: number;
    /** The plan's name on the platform, so a reader can find it. */
    label?: string;
    /** True when this rate is a different product from a flexible direct booking. */
    nonRefundable?: boolean;
  }>;
  /**
   * Standing campaigns that stack ON TOP of the rate plans (Booking's Getaway/Early Booker/Last
   * Minute, Airbnb's last-minute and early-bird). Recorded for explanation only: the captured price
   * already includes whatever was live at capture time, so nothing here feeds a verdict.
   */
  standingDeals?: Array<{ label: string; discountPercentage: number; condition?: string }>;
  /**
   * When this channel's discounts last changed, and from which stay length.
   *
   * A price captured before that date, for a stay long enough to hit the changed rung, was measured
   * against a product that no longer exists. That is the same failure as the parser that banked a
   * three-adult rate for a family of six: a number that looks like evidence and is not. Recording the
   * change lets the board say so instead of quietly pricing against it.
   */
  discountsChangedAt?: { date: string; fromNights: number; note?: string };
  /**
   * A standing discount a qualifying guest receives that no capture can see - Airbnb's top-rated
   * guests discount was the only one. 0 means none, and 0 is meaningfully different from absent:
   * absent falls back to the built-in estimate, 0 says the owner turned it off.
   */
  standingGuestDiscountPct?: number;
  rounding?: ChannelRounding;
  listingUrl?: string;
  /** Links this channel to the iCal feed that syncs its bookings, when one exists. */
  icalFeedId?: string;
  updatedAt?: unknown;
  updatedBy?: string;
}

/** Firestore document id. Dots are legal in ids, so `booking.com` needs no escaping. */
export function channelDocId(propertyId: string, channelId: ChannelId): string {
  return `${propertyId}_${channelId}`;
}
