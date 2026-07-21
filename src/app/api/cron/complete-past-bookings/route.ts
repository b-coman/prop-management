/**
 * @fileoverview Cron endpoint: mark past-checkout bookings as `completed`.
 *
 * There is no automatic confirmed→completed transition in the booking lifecycle,
 * so a stay that has ended stays `confirmed` until an admin manually completes it.
 * Anything keyed on `completed` therefore lags reality: the guest CRM
 * `lastStayDate` (recency) and the post-stay review-request emails.
 *
 * This job flips non-cancelled `confirmed` bookings whose checkout has passed to
 * `completed`, and advances the guest's `lastStayDate` via `advanceGuestLastStay`
 * — which does NOT re-increment totals (unlike upsertGuestFromBooking), so it is
 * safe to run over already-counted bookings.
 *
 * Only touches `confirmed` bookings. Idempotent: once completed, a booking is no
 * longer selected. `?dryRun=1` reports what WOULD happen without writing.
 *
 * Security: cron-only (X-Appengine-Cron header or Bearer token).
 * Frequency: intended daily via Cloud Scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { isPast, parseISO, isValid } from 'date-fns';
import { loggers } from '@/lib/logger';
import { advanceGuestLastStay } from '@/services/guestService';

const logger = loggers.booking;

/** Parse a Firestore date field (Timestamp | {_seconds} | Date | ISO string). */
function toDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (raw instanceof AdminTimestamp) return raw.toDate();
  if (typeof raw === 'object' && raw !== null && '_seconds' in raw) {
    return new Date((raw as { _seconds: number })._seconds * 1000);
  }
  if (typeof raw === 'string') {
    const d = parseISO(raw);
    return isValid(d) ? d : null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');
  if (!cronHeader && !authHeader?.startsWith('Bearer ')) {
    logger.error('Unauthorized access attempt to complete-past-bookings');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRunParam = request.nextUrl.searchParams.get('dryRun');
  const dryRun = dryRunParam === '1' || dryRunParam === 'true';

  try {
    const db = await getAdminDb();
    const snap = await db.collection('bookings').where('status', '==', 'confirmed').get();

    const byProperty: Record<string, number> = {};
    const sample: Array<{ id: string; propertyId?: string; checkOut: string; guest?: string }> = [];
    let eligible = 0;
    let completed = 0;
    let guestsAdvanced = 0;
    let skippedNotPast = 0;
    let skippedBadDate = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      const checkOut = toDate(data.checkOutDate);
      if (!checkOut) {
        skippedBadDate++;
        continue;
      }
      if (!isPast(checkOut)) {
        skippedNotPast++;
        continue;
      }

      eligible++;
      const propertyId = data.propertyId as string | undefined;
      const key = propertyId ?? 'unknown';
      byProperty[key] = (byProperty[key] ?? 0) + 1;
      if (sample.length < 25) {
        const gi = (data.guestInfo ?? {}) as { firstName?: string; lastName?: string };
        sample.push({
          id: doc.id,
          propertyId,
          checkOut: checkOut.toISOString().slice(0, 10),
          guest: [gi.firstName, gi.lastName].filter(Boolean).join(' ') || undefined,
        });
      }

      if (dryRun) continue;

      await doc.ref.update({ status: 'completed', updatedAt: FieldValue.serverTimestamp() });
      completed++;
      if (await advanceGuestLastStay(doc.id, checkOut)) guestsAdvanced++;
    }

    logger.info('complete-past-bookings run', {
      dryRun,
      confirmedScanned: snap.docs.length,
      eligible,
      completed,
      guestsAdvanced,
      skippedNotPast,
      skippedBadDate,
      byProperty,
    });

    return NextResponse.json({
      success: true,
      dryRun,
      confirmedScanned: snap.docs.length,
      eligible, // confirmed AND checkout in the past — what a live run would complete
      completed, // 0 in dry-run
      guestsAdvanced,
      skippedNotPast, // confirmed but checkout still today/future (untouched)
      skippedBadDate,
      byProperty,
      sample,
    });
  } catch (error) {
    logger.error('complete-past-bookings failed', error as Error);
    return NextResponse.json(
      { error: 'Failed to complete past bookings', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST for manual testing (protected).
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return GET(request);
}
