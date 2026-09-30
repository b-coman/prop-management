import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { formatBucharestDateTime } from '@/lib/dates/property-times';
import { loggers } from '@/lib/logger';

const logger = loggers.email;

/**
 * Pre-arrival email — one per booking, the morning before check-in.
 *
 * NOT A QUEUE, ON PURPOSE. The booking IS the queue and `preArrivalSentAt` is the cursor. A
 * separate queue collection would add a drainer and its own failure modes for one or two emails a
 * day, and would still need exactly this stamp to avoid duplicates.
 *
 * What that buys, against "I don't want any email missed":
 *
 *   missed run      the window is [today, tomorrow], not "tomorrow" alone, so a run lost to a
 *                   deploy or an outage is recovered by the next morning's run. The guest still
 *                   gets it on arrival day, and the copy adjusts itself — `isTomorrow` is false
 *                   then, so the subject does not claim "mâine" on the day they arrive.
 *   send failure    the stamp is written ONLY after a successful send, so a failure is retried
 *                   tomorrow. Cloud Scheduler also retries the request itself 3x with backoff.
 *   double run      the stamp makes a second run in the same day a no-op.
 *   late booking    someone booking tonight for tomorrow is picked up at 08:00. Someone booking
 *                   tomorrow morning for tomorrow is not — they get the confirmation instead,
 *                   which already carries the guide link and the phone number.
 *
 * Guests with no email address are skipped without an attempt: every OTA import lands without
 * one, and trying would only produce noise in the logs.
 */

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof AdminTimestamp) return raw.toDate();
  if (raw instanceof Date) return raw;
  if (typeof raw === 'object' && raw !== null && '_seconds' in raw) {
    return new Date((raw as { _seconds: number })._seconds * 1000);
  }
  if (typeof raw === 'string') return new Date(raw);
  return null;
}

/** Calendar day in the property's timezone — the cron runs at 08:00 Bucharest, not 08:00 UTC. */
const bucharestDay = (d: Date) => formatBucharestDateTime(d, 'yyyy-MM-dd');

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');
  if (!cronHeader && !authHeader?.startsWith('Bearer ')) {
    logger.error('Unauthorized access attempt to send-pre-arrival cron');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const onlyBooking = url.searchParams.get('bookingId') || undefined;

  logger.info('Pre-arrival cron called', { dryRun, onlyBooking });

  try {
    const db = await getAdminDb();
    const now = new Date();
    const today = bucharestDay(now);
    const tomorrow = bucharestDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));

    const snapshot = await db.collection('bookings').where('status', '==', 'confirmed').get();

    const results: Array<Record<string, unknown>> = [];
    let sent = 0, skipped = 0, failed = 0;

    for (const doc of snapshot.docs) {
      const bookingId = doc.id;
      const b = doc.data();
      if (onlyBooking && bookingId !== onlyBooking) continue;

      const checkIn = parseDate(b.checkInDate);
      if (!checkIn || Number.isNaN(checkIn.getTime())) { skipped++; continue; }

      const day = bucharestDay(checkIn);
      // Tomorrow is the target; today is the catch-up for a run that did not happen.
      if (day !== tomorrow && day !== today) { skipped++; continue; }

      if (b.preArrivalSentAt) {
        skipped++;
        results.push({ bookingId, skipped: 'already sent' });
        continue;
      }

      // Every OTA import arrives without an email. Not an error, and not worth attempting.
      const email = b.guestInfo?.email;
      if (!email) {
        skipped++;
        results.push({ bookingId, skipped: 'no guest email', checkIn: day });
        continue;
      }

      try {
        const { isGuestUnsubscribed } = await import('@/services/guestService');
        if (await isGuestUnsubscribed(email)) {
          skipped++;
          results.push({ bookingId, skipped: 'unsubscribed' });
          continue;
        }
      } catch {
        // A failed unsubscribe lookup must not cost the guest their arrival details.
        logger.warn('Unsubscribe check failed, proceeding', { bookingId });
      }

      if (dryRun) {
        sent++;
        results.push({ bookingId, wouldSend: true, checkIn: day, isTomorrow: day === tomorrow });
        continue;
      }

      const { sendPreArrivalEmail } = await import('@/services/emailService');
      const res = await sendPreArrivalEmail(bookingId);

      if (res.success) {
        // Stamped only on success, so a failure is retried by tomorrow's run.
        await doc.ref.update({ preArrivalSentAt: FieldValue.serverTimestamp() });
        sent++;
        results.push({ bookingId, sent: true, checkIn: day, messageId: res.messageId });
        logger.info('Pre-arrival email sent', { bookingId, checkIn: day });
      } else {
        failed++;
        results.push({ bookingId, failed: res.error, checkIn: day });
        logger.error('Pre-arrival email failed', new Error(res.error || 'unknown'), { bookingId });
      }
    }

    logger.info('Pre-arrival cron complete', { sent, skipped, failed, dryRun });
    return NextResponse.json({ ok: true, dryRun, today, tomorrow, sent, skipped, failed, results });
  } catch (error) {
    logger.error('Pre-arrival cron threw', error as Error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
