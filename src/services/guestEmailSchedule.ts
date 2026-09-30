/**
 * The guest email schedule: every scheduled message to a guest, declared in one table.
 *
 * WHY THIS EXISTS. There were three cron routes sweeping bookings on a timer, each with its own
 * copy of the same skeleton - fetch bookings, work out how long since some date, skip the ones
 * already handled, send, stamp a field. They had drifted:
 *
 *   - two measured elapsed UTC hours, one compared Bucharest day strings, so the same "2 days
 *     after checkout" meant different things and moved with DST;
 *   - `parseFirestoreDate` existed three times under two names;
 *   - the no-email skip existed in one and was missing from another, so every OTA import logged
 *     a failed send;
 *   - the OTA exclusion keyed on `imported`, which does not mean what it sounds like: 68 OTA
 *     bookings have `imported: false` and 27 direct bookings have `imported: true`. The rule
 *     "OTA guests are contacted through the OTA" was holding only because OTA imports happen to
 *     arrive without an email address.
 *
 * So the schedule is data, and the sweep that runs it is one piece of code. Adding a message
 * means adding a row here, not another route with another copy of the skeleton.
 *
 * WHY NOT A QUEUE. The booking IS the queue and the stamp field is the cursor. A queue collection
 * would need a drainer and its own failure modes for a handful of emails a day, and would still
 * need exactly this stamp to stay idempotent. See `guestEmailSweep.ts` for what that buys.
 */
import type { Firestore } from 'firebase-admin/firestore';

/** Anchor: which of the booking's own dates a stage counts from. */
export type StageAnchor = 'checkInDate' | 'checkOutDate';

/**
 * Transactional messages concern a stay the guest has already paid for; marketing messages ask
 * for something. The distinction is not cosmetic - it decides what happens when the unsubscribe
 * lookup fails, and whether the footer carries an opt-out link at all.
 */
export type StageKind = 'transactional' | 'marketing';

/** Who a stage is allowed to write to. */
export type StageAudience =
  /** Only bookings we took ourselves. OTA guests are contacted through the OTA's own platform. */
  | 'direct-only'
  /** Any booking with an email. Nothing uses this yet; it exists so 'direct-only' reads as a choice. */
  | 'any';

export interface StageContext {
  bookingId: string;
  booking: Record<string, any>;
  db: Firestore;
}

export interface StageSendResult {
  success: boolean;
  error?: string;
  messageId?: string;
  /** Extra fields to write alongside the stamp, e.g. the coupon code that was issued. */
  alsoStamp?: Record<string, unknown>;
}

export interface GuestEmailStage {
  id: string;
  anchor: StageAnchor;
  /**
   * Bucharest calendar-day offsets from the anchor on which this stage may fire. More than one
   * offset on purpose: the cron runs daily, so a second offset is the catch-up for a run lost to
   * a deploy or an outage. A single-offset stage would be silently skipped by one missed run.
   */
  offsets: readonly number[];
  /** Booking statuses this stage applies to. */
  statuses: readonly string[];
  /** Field stamped on the booking after a successful send. Also the idempotency key. */
  stamp: string;
  kind: StageKind;
  audience: StageAudience;
  /** Returns a reason to skip, or null to proceed. Runs last - it may hit Firestore. */
  precondition?: (ctx: StageContext) => Promise<string | null>;
  send: (ctx: StageContext) => Promise<StageSendResult>;
}

/**
 * Where a booking came from.
 *
 * `source` is the field that actually records this. `imported` records whether a row arrived via
 * the importer, which is a different question and disagrees with `source` on 95 of 317 bookings.
 */
const OTA_SOURCES = new Set(['airbnb', 'booking.com', 'vrbo', 'expedia', 'travelmint', 'tripadvisor']);
const DIRECT_SOURCES = new Set(['direct']);

export type SourceClass = 'direct' | 'ota' | 'unknown';

/**
 * An unrecognised source classifies as 'unknown' and is NOT treated as direct. A new OTA
 * integration landing without this list being updated should fail towards silence, not towards
 * emailing guests we promised to reach through their platform. The sweep counts unknowns in its
 * result so a dry run shows them rather than hiding them.
 *
 * This is safe for real direct bookings because of the booking state machine: a web booking is
 * created as 'website-pending' / 'website-hold' and `bookingService` promotes it to 'direct' when
 * payment succeeds. So an unpromoted booking is one nobody paid for. 'simulation' and
 * 'test-button' also land here, and must never receive guest mail.
 */
export function classifySource(source: unknown): SourceClass {
  const s = String(source ?? '').trim().toLowerCase();
  if (DIRECT_SOURCES.has(s)) return 'direct';
  if (OTA_SOURCES.has(s)) return 'ota';
  return 'unknown';
}

export function audienceAllows(audience: StageAudience, source: unknown): boolean {
  if (audience === 'any') return true;
  return classifySource(source) === 'direct';
}

/** Is `offset` one of the days this stage fires on? */
export function stageFiresAt(stage: GuestEmailStage, offset: number): boolean {
  return stage.offsets.includes(offset);
}

// ---------------------------------------------------------------------------------------------
// The schedule.
// ---------------------------------------------------------------------------------------------

/** Day before check-in, with arrival-day catch-up. The only transactional stage here. */
export const PRE_ARRIVAL: GuestEmailStage = {
  id: 'pre-arrival',
  anchor: 'checkInDate',
  // -1 is the day before, which is the intent. 0 is the catch-up: a guest who missed yesterday's
  // run still gets their arrival details on the morning they travel, and the copy drops "mâine".
  offsets: [-1, 0],
  statuses: ['confirmed'],
  stamp: 'preArrivalSentAt',
  kind: 'transactional',
  audience: 'direct-only',
  send: async ({ bookingId }) => {
    const { sendPreArrivalEmail } = await import('@/services/emailService');
    return sendPreArrivalEmail(bookingId);
  },
};

/** Two days after checkout - home, unpacked, the stay still fresh. */
export const REVIEW_REQUEST: GuestEmailStage = {
  id: 'review-request',
  anchor: 'checkOutDate',
  offsets: [2, 3],
  statuses: ['completed'],
  stamp: 'reviewRequestSentAt',
  kind: 'marketing',
  audience: 'direct-only',
  precondition: async ({ bookingId, db }) => {
    const existing = await db.collection('reviews').where('bookingId', '==', bookingId).limit(1).get();
    return existing.empty ? null : 'review already left';
  },
  send: async ({ bookingId }) => {
    const { sendReviewRequestEmail } = await import('@/services/emailService');
    return sendReviewRequestEmail(bookingId);
  },
};

/** Two weeks after checkout, with a coupon. */
export const RETURN_INCENTIVE: GuestEmailStage = {
  id: 'return-incentive',
  anchor: 'checkOutDate',
  offsets: [14, 15],
  statuses: ['completed'],
  stamp: 'returnIncentiveSentAt',
  kind: 'marketing',
  audience: 'direct-only',
  send: async ({ bookingId, booking, db }) => {
    const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
    const { format } = await import('date-fns');

    const code = `RETURN-${bookingId.slice(-6).toUpperCase()}`;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 90);

    // Create-or-reuse, keyed on the code. The coupon has to exist before the email that carries
    // it, so a failed send used to leave an orphan and the next day's run added a second document
    // with the same code.
    const existing = await db.collection('coupons').where('code', '==', code).limit(1).get();
    if (existing.empty) {
      await db.collection('coupons').add({
        code,
        discount: 10,
        validUntil: Timestamp.fromDate(expiry),
        isActive: true,
        description: `Return guest incentive for booking ${bookingId}`,
        propertyId: booking.propertyId || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const { sendReturnIncentiveEmail } = await import('@/services/emailService');
    const res = await sendReturnIncentiveEmail(bookingId, code, 10, format(expiry, 'PPP'));
    return { ...res, alsoStamp: { returnIncentiveCouponCode: code } };
  },
};

/** Three months after checkout - unless they have already booked again. */
export const SEASONAL_REMINDER: GuestEmailStage = {
  id: 'seasonal-reminder',
  anchor: 'checkOutDate',
  offsets: [90, 91],
  statuses: ['completed'],
  stamp: 'seasonalReminderSentAt',
  kind: 'marketing',
  audience: 'direct-only',
  precondition: async ({ bookingId, booking, db }) => {
    const email = booking.guestInfo?.email;
    if (!email) return null;
    const { parseFirestoreDate } = await import('@/lib/firestore-dates');
    const checkOut = parseFirestoreDate(booking.checkOutDate);
    const snap = await db
      .collection('bookings')
      .where('guestInfo.email', '==', email)
      .where('status', 'in', ['confirmed', 'completed'])
      .get();
    const reBooked = snap.docs.some((d) => {
      if (d.id === bookingId) return false;
      const created = parseFirestoreDate(d.data().createdAt);
      return created && checkOut && created > checkOut;
    });
    return reBooked ? 'already re-booked' : null;
  },
  send: async ({ bookingId }) => {
    const { sendSeasonalReminderEmail } = await import('@/services/emailService');
    return sendSeasonalReminderEmail(bookingId);
  },
};

/** Every stage, in the order a guest meets them. */
export const GUEST_EMAIL_STAGES = [
  PRE_ARRIVAL,
  REVIEW_REQUEST,
  RETURN_INCENTIVE,
  SEASONAL_REMINDER,
] as const;
