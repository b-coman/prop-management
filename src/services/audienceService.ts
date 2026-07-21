/**
 * audienceService — the audience picker's brain.
 *
 * For a property it fetches EVERY candidate guest and annotates each with:
 *   - eligibility: whether the guest can be messaged and, if not, WHY
 *     (unsubscribed / no-contact / suppressed / frequency-cap / future-booking).
 *     These are the only automatic exclusions — they mirror executionGateway's
 *     gates (minus per-campaign dedup), reusing the SAME primitives so the picker
 *     and the actual send agree. The gateway remains authoritative at send time.
 *   - fit signals: language, repeat, last-stay recency + season, country, spend.
 *     These are ADVISORY — the operator sorts/filters on them. Nothing is ever
 *     excluded on a soft signal (e.g. a winter-stayer is a perfectly valid lead
 *     for a summer offer — they already like the property).
 *
 * It NEVER caps the audience — the operator picks freely; `perRunCap` is surfaced
 * as soft WhatsApp-volume guidance only.
 *
 * Plain server module (NOT 'use server') — exports types + async functions.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { Guest, ChannelType, LanguageCode, Season } from '@/types';
import { GROWTH_ENGINE_LIMITS } from '@/config/growth-engine';
import { parseFirestoreDate, seasonOf } from '@/lib/growth/date-utils';
import { resolveGuestLanguage } from '@/lib/growth/language';
import { isConsentBlocked } from '@/services/executionGateway';
import { resolveChannel, loadSuppressionSet, isGuestSuppressed } from '@/services/segmentService';

const logger = loggers.segment;

export type IneligibleReason =
  | 'unsubscribed'
  | 'no-contact'
  | 'suppressed'
  | 'frequency-cap'
  | 'active-future-booking';

export interface AudienceCandidate {
  guestId: string;
  name: string;
  language: LanguageCode;
  country?: string;
  channel: ChannelType | null;
  totalBookings: number;
  totalSpent: number;
  isRepeat: boolean;                 // fit signal — advisory only
  lastStayDate: string | null;       // ISO yyyy-mm-dd (advisory display)
  lastStaySeason: Season | null;     // fit signal — advisory only
  eligible: boolean;
  ineligibleReason?: IneligibleReason;
}

export interface AudienceResult {
  candidates: AudienceCandidate[];   // ALL candidates, eligible + not, annotated
  total: number;
  eligibleCount: number;
  perRunCap: number;                 // soft per-run guidance (WhatsApp volume safety)
}

/** All guests for the property (tiny dataset → in-memory annotation). */
async function fetchGuests(propertyId: string): Promise<Guest[]> {
  const db = await getAdminDb();
  const snap = await db.collection('guests').where('propertyIds', 'array-contains', propertyId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Guest));
}

/**
 * Booking ids for the property whose stay has NOT ended yet (checkout today or
 * later) and is not cancelled — the same "active future booking" definition the
 * gateway uses (#159). One query + in-memory filter (no composite index).
 */
async function futureBookingIds(propertyId: string, now: Date): Promise<Set<string>> {
  const db = await getAdminDb();
  const snap = await db.collection('bookings').where('propertyId', '==', propertyId).get();
  const startOfTodayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ids = new Set<string>();
  snap.docs.forEach((d) => {
    const b = d.data() as { status?: string; checkInDate?: unknown; checkOutDate?: unknown };
    if (b.status === 'cancelled') return;
    const end = parseFirestoreDate(b.checkOutDate) ?? parseFirestoreDate(b.checkInDate);
    if (end && end.getTime() >= startOfTodayUtc) ids.add(d.id);
  });
  return ids;
}

/** The ONLY automatic exclusions — mirrors the gateway's gates (minus dedup). */
function eligibilityOf(
  guest: Guest,
  channel: ChannelType | null,
  suppression: { phones: Set<string>; emails: Set<string> },
  futureIds: Set<string>,
  now: Date
): IneligibleReason | null {
  if (guest.unsubscribed) return 'unsubscribed'; // global opt-out (channel-independent)
  if (!channel) return 'no-contact';
  if (isConsentBlocked(guest, channel)) return 'unsubscribed'; // per-channel opt-out
  if (isGuestSuppressed(guest, suppression)) return 'suppressed';
  const last = parseFirestoreDate(guest.lastCampaignAt);
  if (last && (now.getTime() - last.getTime()) / 86400000 < GROWTH_ENGINE_LIMITS.frequencyCapDays) {
    return 'frequency-cap';
  }
  if ((guest.bookingIds || []).some((id) => futureIds.has(id))) return 'active-future-booking';
  return null;
}

/** Build the annotated candidate list for a property's audience picker. */
export async function buildAudience(propertyId: string, opts?: { now?: Date }): Promise<AudienceResult> {
  const now = opts?.now ?? new Date();
  const [guests, suppression, futureIds] = await Promise.all([
    fetchGuests(propertyId),
    loadSuppressionSet(),
    futureBookingIds(propertyId, now),
  ]);

  const candidates: AudienceCandidate[] = guests.map((g) => {
    const channel = resolveChannel(g);
    const reason = eligibilityOf(g, channel, suppression, futureIds, now);
    const stay = parseFirestoreDate(g.lastStayDate);
    return {
      guestId: g.id,
      name: [g.firstName, g.lastName].filter(Boolean).join(' ').trim() || '(no name)',
      language: resolveGuestLanguage(g),
      country: g.country,
      channel,
      totalBookings: g.totalBookings || 0,
      totalSpent: g.totalSpent || 0,
      isRepeat: (g.totalBookings || 0) > 1,
      lastStayDate: stay ? stay.toISOString().slice(0, 10) : null,
      lastStaySeason: stay ? seasonOf(stay) : null,
      eligible: reason === null,
      ineligibleReason: reason ?? undefined,
    };
  });

  const eligibleCount = candidates.filter((c) => c.eligible).length;
  logger.info('Built audience', { propertyId, total: candidates.length, eligibleCount });
  return { candidates, total: candidates.length, eligibleCount, perRunCap: GROWTH_ENGINE_LIMITS.perRunCap };
}
