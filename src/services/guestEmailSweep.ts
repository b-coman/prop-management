/**
 * Runs the guest email schedule against the bookings collection.
 *
 * ONE sweep, driven by the stage table in `guestEmailSchedule.ts`. Every cron route is a thin
 * caller that names the stages it owns; none of them repeat the skip rules, the idempotency or
 * the date handling.
 *
 * Against "I don't want any email to be missed":
 *
 *   missed run      every stage fires on more than one calendar-day offset, so a run lost to a
 *                   deploy or an outage is recovered by the next morning's.
 *   send failure    the stamp is written ONLY after a successful send, so a failure is retried on
 *                   the stage's remaining offsets. Cloud Scheduler also retries the request.
 *   double run      the stamp makes a second run in the same day a no-op.
 *
 * And against "do not try to send to guests without an email": the no-email skip is one branch
 * here, so it cannot be present in one route and missing from another again.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { parseFirestoreDate } from '@/lib/firestore-dates';
import { bucharestDayOffset } from '@/lib/dates/property-times';
import { loggers } from '@/lib/logger';
import {
  audienceAllows,
  classifySource,
  stageFiresAt,
  type GuestEmailStage,
} from '@/services/guestEmailSchedule';

const logger = loggers.email;

export interface SweepOptions {
  /** Overridable so the schedule can be exercised at a chosen date. */
  now?: Date;
  /** Decide and report, send nothing, stamp nothing. */
  dryRun?: boolean;
  /** Restrict to a single booking. */
  onlyBooking?: string;
}

export interface SweepEntry {
  bookingId: string;
  stage: string;
  offset?: number;
  sent?: boolean;
  wouldSend?: boolean;
  skipped?: string;
  failed?: string;
  messageId?: string;
}

export interface SweepResult {
  ok: boolean;
  dryRun: boolean;
  now: string;
  stages: string[];
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Bookings whose `source` matched neither the direct nor the OTA list. */
  unknownSource: number;
  /** Only the interesting rows: sends, would-sends, failures, and audience/precondition skips. */
  entries: SweepEntry[];
}

/** Skips so numerous and so uninteresting that listing them would bury the real rows. */
const QUIET_SKIPS = new Set(['out of window', 'wrong status', 'already sent', 'no anchor date']);

export async function runGuestEmailSweep(
  stages: readonly GuestEmailStage[],
  opts: SweepOptions = {}
): Promise<SweepResult> {
  const now = opts.now ?? new Date();
  const dryRun = opts.dryRun ?? false;
  const db: Firestore = await getAdminDb();

  const statuses = [...new Set(stages.flatMap((s) => s.statuses))];
  const snapshot = await db.collection('bookings').where('status', 'in', statuses).get();

  const result: SweepResult = {
    ok: true,
    dryRun,
    now: now.toISOString(),
    stages: stages.map((s) => s.id),
    scanned: snapshot.size,
    sent: 0,
    skipped: 0,
    failed: 0,
    unknownSource: 0,
    entries: [],
  };

  const note = (e: SweepEntry) => {
    if (!e.skipped || !QUIET_SKIPS.has(e.skipped)) result.entries.push(e);
  };

  for (const doc of snapshot.docs) {
    const bookingId = doc.id;
    if (opts.onlyBooking && bookingId !== opts.onlyBooking) continue;
    const booking = doc.data();

    if (classifySource(booking.source) === 'unknown') result.unknownSource++;

    for (const stage of stages) {
      const skip = (reason: string, offset?: number) => {
        result.skipped++;
        note({ bookingId, stage: stage.id, offset, skipped: reason });
      };

      if (!stage.statuses.includes(booking.status)) { skip('wrong status'); continue; }

      const anchor = parseFirestoreDate(booking[stage.anchor]);
      if (!anchor) { skip('no anchor date'); continue; }

      const offset = bucharestDayOffset(anchor, now);
      if (!stageFiresAt(stage, offset)) { skip('out of window', offset); continue; }

      // Cheap, local checks before anything that costs a read or a send.
      if (booking[stage.stamp]) { skip('already sent', offset); continue; }

      if (!audienceAllows(stage.audience, booking.source)) {
        skip(`audience: ${classifySource(booking.source)}`, offset);
        continue;
      }

      const email = booking.guestInfo?.email;
      if (!email) { skip('no guest email', offset); continue; }

      // A transactional message concerns a stay already paid for, so a lookup that throws must
      // not cost the guest their arrival details. A marketing message has no such claim: if we
      // cannot confirm consent, we do not send.
      try {
        const { isGuestUnsubscribed } = await import('@/services/guestService');
        if (await isGuestUnsubscribed(email)) { skip('unsubscribed', offset); continue; }
      } catch (e) {
        if (stage.kind === 'marketing') { skip('unsubscribe check failed', offset); continue; }
        logger.warn('Unsubscribe check failed; proceeding with a transactional message', {
          bookingId, stage: stage.id,
        });
      }

      if (stage.precondition) {
        try {
          const reason = await stage.precondition({ bookingId, booking, db });
          if (reason) { skip(reason, offset); continue; }
        } catch (e) {
          result.failed++;
          note({ bookingId, stage: stage.id, offset, failed: `precondition threw: ${String(e)}` });
          logger.error('Stage precondition threw', e as Error, { bookingId, stage: stage.id });
          continue;
        }
      }

      if (dryRun) {
        result.sent++;
        note({ bookingId, stage: stage.id, offset, wouldSend: true });
        continue;
      }

      try {
        const res = await stage.send({ bookingId, booking, db });
        if (res.success) {
          // Only on success, so a failure is retried on the stage's remaining offsets.
          await doc.ref.update({
            [stage.stamp]: FieldValue.serverTimestamp(),
            ...(res.alsoStamp ?? {}),
          });
          result.sent++;
          note({ bookingId, stage: stage.id, offset, sent: true, messageId: res.messageId });
          logger.info('Guest email sent', { bookingId, stage: stage.id, offset });
        } else {
          result.failed++;
          note({ bookingId, stage: stage.id, offset, failed: res.error });
          logger.error('Guest email failed', new Error(res.error || 'unknown'), {
            bookingId, stage: stage.id,
          });
        }
      } catch (e) {
        result.failed++;
        note({ bookingId, stage: stage.id, offset, failed: String(e) });
        logger.error('Guest email threw', e as Error, { bookingId, stage: stage.id });
      }
    }
  }

  logger.info('Guest email sweep complete', {
    stages: result.stages, scanned: result.scanned, sent: result.sent,
    skipped: result.skipped, failed: result.failed, dryRun,
  });
  return result;
}
