/**
 * segmentService — evaluate a declarative SegmentDefinition against the
 * `guests` collection and preview the resulting audience.
 *
 * Plain server module (NOT `'use server'`) so it can export pure helpers and
 * types alongside async functions. The dataset is tiny (~150 guests), so we
 * narrow by propertyId in Firestore and apply the rest of the predicate
 * in-memory — no composite indexes required.
 *
 * See plans/growth-engine.md §6.2.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { Guest, SegmentDefinition, ChannelType, Season } from '@/types';
import { parseFirestoreDate, seasonOf, monthsBetween } from '@/lib/growth/date-utils';
import { normalizeCountryCode } from '@/lib/country-utils';
import { normalizePhone } from '@/lib/sanitize';
import { resolveGuestLanguage } from '@/lib/growth/language';

const logger = loggers.segment;

/**
 * The channel a guest is reachable on, WhatsApp-first (phone), then email.
 * Pure — safe to call anywhere. Reflects the §0.1 reality: phones, not emails.
 */
export function resolveChannel(
  guest: Pick<Guest, 'normalizedPhone' | 'phone' | 'email'>
): ChannelType | null {
  if (guest.normalizedPhone || guest.phone) return 'whatsapp';
  if (guest.email) return 'email';
  return null;
}

/**
 * Pure predicate: does a guest match a segment definition as of `now`?
 * Kept side-effect-free so it is exhaustively unit-testable without Firestore.
 */
export function matchesDefinition(
  guest: Guest,
  def: SegmentDefinition,
  now: Date = new Date()
): boolean {
  // Exclude unsubscribed unless explicitly opted out of that exclusion.
  if (def.excludeUnsubscribed !== false && guest.unsubscribed) return false;

  if (def.propertyId && !(guest.propertyIds || []).includes(def.propertyId)) return false;

  const bookings = guest.totalBookings || 0;
  if (typeof def.minTotalBookings === 'number' && bookings < def.minTotalBookings) return false;
  if (typeof def.maxTotalBookings === 'number' && bookings > def.maxTotalBookings) return false;

  if (typeof def.minTotalSpent === 'number' && (guest.totalSpent || 0) < def.minTotalSpent) {
    return false;
  }

  // Normalize the stored country (may be an ISO code, a name like "Romania", or
  // un-normalized) to an ISO code before comparing — otherwise "Romania" wouldn't
  // match countryIn:['RO'] and the RO/foreign axis silently breaks (H3).
  const countryCode = guest.country ? normalizeCountryCode(guest.country) : undefined;
  if (def.countryIn && def.countryIn.length > 0) {
    if (!countryCode || !def.countryIn.includes(countryCode)) return false;
  }
  if (def.countryNotIn && def.countryNotIn.length > 0) {
    // Unknown country isn't classifiable as "not in X" — exclude, don't treat
    // unknown as foreign (M3).
    if (!countryCode) return false;
    if (def.countryNotIn.includes(countryCode)) return false;
  }

  if (def.tagsInclude && def.tagsInclude.length > 0) {
    const tags = guest.tags || [];
    if (!def.tagsInclude.some((t) => tags.includes(t))) return false;
  }

  if (def.hasChannel) {
    const hasPhone = !!(guest.normalizedPhone || guest.phone);
    if ((def.hasChannel === 'whatsapp' || def.hasChannel === 'sms') && !hasPhone) return false;
    if (def.hasChannel === 'email' && !guest.email) return false;
  }

  if (def.lastStaySeason && def.lastStaySeason.length > 0) {
    const d = parseFirestoreDate(guest.lastStayDate);
    if (!d || !def.lastStaySeason.includes(seasonOf(d))) return false;
  }

  if (def.monthsSinceLastBooking) {
    const d = parseFirestoreDate(guest.lastBookingDate);
    if (!d) return false;
    const months = monthsBetween(d, now);
    const { min, max } = def.monthsSinceLastBooking;
    if (typeof min === 'number' && months < min) return false;
    if (typeof max === 'number' && months > max) return false;
  }

  if (def.monthsSinceLastStay) {
    const d = parseFirestoreDate(guest.lastStayDate);
    if (!d) return false;
    const months = monthsBetween(d, now);
    const { min, max } = def.monthsSinceLastStay;
    if (typeof min === 'number' && months < min) return false;
    if (typeof max === 'number' && months > max) return false;
  }

  return true;
}

/** Fetch candidate guests, narrowing by propertyId in Firestore when set. */
async function fetchCandidates(def: SegmentDefinition): Promise<Guest[]> {
  const db = await getAdminDb();
  const base = db.collection('guests');
  const snap = def.propertyId
    ? await base.where('propertyIds', 'array-contains', def.propertyId).get()
    : await base.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Guest));
}

/** Resolve a segment definition to the matching guest records. */
export async function evaluateSegment(
  def: SegmentDefinition,
  now: Date = new Date()
): Promise<Guest[]> {
  const candidates = await fetchCandidates(def);
  return candidates.filter((g) => matchesDefinition(g, def, now));
}

export interface AudiencePreview {
  count: number;                            // total guests matching the segment
  reachable: number;                        // reachable by a channel AND not suppressed
  suppressed: number;                       // matched + reachable but on the suppression list
  byChannel: Record<'whatsapp' | 'email' | 'none', number>;
  byLanguage: { ro: number; en: number };   // among reachable guests
  sample: Array<{ id: string; name: string; channel: ChannelType | null; country?: string }>;
}

/** Load the suppression list once into sets for an honest preview (small collection). */
async function loadSuppressionSet(): Promise<{ phones: Set<string>; emails: Set<string> }> {
  const db = await getAdminDb();
  const snap = await db.collection('suppressionList').get();
  const phones = new Set<string>();
  const emails = new Set<string>();
  snap.docs.forEach((d) => {
    const x = d.data() as { normalizedPhone?: string; email?: string };
    if (x.normalizedPhone) phones.add(x.normalizedPhone);
    if (x.email) emails.add(String(x.email).toLowerCase().trim());
  });
  return { phones, emails };
}

function isGuestSuppressed(guest: Guest, sets: { phones: Set<string>; emails: Set<string> }): boolean {
  const phone = guest.normalizedPhone || (guest.phone ? normalizePhone(guest.phone) : undefined);
  if (phone && sets.phones.has(phone)) return true;
  if (guest.email && sets.emails.has(guest.email.toLowerCase().trim())) return true;
  return false;
}

/** Count + channel breakdown + a small sample for a segment definition. */
export async function previewAudience(
  def: SegmentDefinition,
  now: Date = new Date()
): Promise<AudiencePreview> {
  const guests = await evaluateSegment(def, now);
  const suppression = await loadSuppressionSet();
  // resolveChannel only ever yields whatsapp | email | null (no sms today).
  const byChannel = { whatsapp: 0, email: 0, none: 0 };
  const byLanguage = { ro: 0, en: 0 };
  let reachable = 0;
  let suppressed = 0;
  for (const g of guests) {
    const ch = resolveChannel(g);
    if (ch === 'whatsapp') byChannel.whatsapp++;
    else if (ch === 'email') byChannel.email++;
    else byChannel.none++;
    if (ch) {
      // Among channel-reachable guests, subtract the suppressed and split the
      // rest by effective language — an honest "who will actually get this" (M2/M3).
      if (isGuestSuppressed(g, suppression)) {
        suppressed++;
      } else {
        reachable++;
        if (resolveGuestLanguage(g) === 'ro') byLanguage.ro++;
        else byLanguage.en++;
      }
    }
  }
  const sample = guests.slice(0, 10).map((g) => ({
    id: g.id,
    name: [g.firstName, g.lastName].filter(Boolean).join(' ').trim(),
    channel: resolveChannel(g),
    country: g.country,
  }));
  logger.info('Previewed audience', { count: guests.length, reachable, suppressed, byChannel, byLanguage });
  return { count: guests.length, reachable, suppressed, byChannel, byLanguage, sample };
}

/** Reusable segment builders (the §6.2 catalogue). */
export const PREDEFINED_SEGMENTS = {
  lastStayedInSeason: (season: Season, propertyId?: string): SegmentDefinition => ({
    lastStaySeason: [season],
    propertyId,
  }),
  noBookingInMonths: (min: number, propertyId?: string): SegmentDefinition => ({
    monthsSinceLastBooking: { min },
    propertyId,
  }),
  repeatGuests: (propertyId?: string): SegmentDefinition => ({
    minTotalBookings: 2,
    propertyId,
  }),
  romanian: (propertyId?: string): SegmentDefinition => ({ countryIn: ['RO'], propertyId }),
  foreign: (propertyId?: string): SegmentDefinition => ({ countryNotIn: ['RO'], propertyId }),
  highValue: (minTotalSpent: number, propertyId?: string): SegmentDefinition => ({
    minTotalSpent,
    propertyId,
  }),
  whatsappReachable: (propertyId?: string): SegmentDefinition => ({
    hasChannel: 'whatsapp',
    propertyId,
  }),
};
