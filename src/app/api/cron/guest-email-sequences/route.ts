import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { loggers } from '@/lib/logger';
import { format } from 'date-fns';

const logger = loggers.guest;

function parseFirestoreDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof AdminTimestamp) return raw.toDate();
  if (typeof raw === 'object' && raw !== null && '_seconds' in raw) {
    return new Date((raw as { _seconds: number })._seconds * 1000);
  }
  if (typeof raw === 'string') return new Date(raw);
  if (raw instanceof Date) return raw;
  return null;
}

export async function GET(request: NextRequest) {
  logger.info('Guest email sequences cron endpoint called');

  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');

  if (!cronHeader && !authHeader?.startsWith('Bearer ')) {
    logger.error('Unauthorized access attempt to guest-email-sequences cron');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getAdminDb();
    const now = new Date();

    // Query completed bookings
    const snapshot = await db
      .collection('bookings')
      .where('status', '==', 'completed')
      .get();

    logger.info('Found completed bookings for email sequences', { count: snapshot.docs.length });

    const stats = {
      checkoutSent: 0,
      returnIncentiveSent: 0,
      seasonalReminderSent: 0,
      skipped: 0,
      errors: 0,
    };

    for (const doc of snapshot.docs) {
      const bookingId = doc.id;
      const data = doc.data();

      // Skip imported bookings — they are historical and should not trigger email sequences
      if (data.imported) {
        stats.skipped++;
        continue;
      }

      const checkOutDate = parseFirestoreDate(data.checkOutDate);
      if (!checkOutDate || isNaN(checkOutDate.getTime())) {
        stats.skipped++;
        continue;
      }

      const daysSinceCheckout = (now.getTime() - checkOutDate.getTime()) / (1000 * 60 * 60 * 24);
      const guestEmail = data.guestInfo?.email;

      if (!guestEmail) {
        stats.skipped++;
        continue;
      }

      // Check unsubscribe status once per booking
      try {
        const { isGuestUnsubscribed } = await import('@/services/guestService');
        if (await isGuestUnsubscribed(guestEmail)) {
          stats.skipped++;
          continue;
        }
      } catch {
        // If we can't check, proceed cautiously by skipping
        stats.skipped++;
        continue;
      }

      // Day 0: Checkout confirmation (0-1.5 days after checkout)
      if (daysSinceCheckout >= 0 && daysSinceCheckout <= 1.5 && !data.checkoutEmailSentAt) {
        try {
          const { sendCheckoutConfirmationEmail } = await import('@/services/emailService');
          const result = await sendCheckoutConfirmationEmail(bookingId);
          if (result.success) {
            await doc.ref.update({ checkoutEmailSentAt: FieldValue.serverTimestamp() });
            stats.checkoutSent++;
            logger.info('Checkout confirmation sent', { bookingId });
          } else {
            stats.errors++;
          }
        } catch (error) {
          logger.error('Error sending checkout confirmation', error as Error, { bookingId });
          stats.errors++;
        }
        continue; // Process one email per booking per run
      }

      // Day 14: Return incentive (13.5-15.5 days after checkout)
      if (daysSinceCheckout >= 13.5 && daysSinceCheckout <= 15.5 && !data.returnIncentiveSentAt) {
        try {
          // Auto-create coupon
          const couponCode = `RETURN-${bookingId.slice(-6).toUpperCase()}`;
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 90);

          await db.collection('coupons').add({
            code: couponCode,
            discount: 10,
            validUntil: AdminTimestamp.fromDate(expiryDate),
            isActive: true,
            description: `Return guest incentive for booking ${bookingId}`,
            propertyId: data.propertyId || null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          const { sendReturnIncentiveEmail } = await import('@/services/emailService');
          const result = await sendReturnIncentiveEmail(
            bookingId,
            couponCode,
            10,
            format(expiryDate, 'PPP')
          );

          if (result.success) {
            await doc.ref.update({
              returnIncentiveSentAt: FieldValue.serverTimestamp(),
              returnIncentiveCouponCode: couponCode,
            });
            stats.returnIncentiveSent++;
            logger.info('Return incentive sent', { bookingId, couponCode });
          } else {
            stats.errors++;
          }
        } catch (error) {
          logger.error('Error sending return incentive', error as Error, { bookingId });
          stats.errors++;
        }
        continue;
      }

      // Day 90: Seasonal reminder (89.5-91.5 days after checkout)
      if (daysSinceCheckout >= 89.5 && daysSinceCheckout <= 91.5 && !data.seasonalReminderSentAt) {
        try {
          // Check if guest has re-booked
          const reBookingSnap = await db
            .collection('bookings')
            .where('guestInfo.email', '==', guestEmail)
            .where('status', 'in', ['confirmed', 'completed'])
            .get();

          const hasReBooked = reBookingSnap.docs.some(
            (b) => b.id !== bookingId && parseFirestoreDate(b.data().createdAt)! > checkOutDate
          );

          if (hasReBooked) {
            stats.skipped++;
            continue;
          }

          const { sendSeasonalReminderEmail } = await import('@/services/emailService');
          const result = await sendSeasonalReminderEmail(bookingId);

          if (result.success) {
            await doc.ref.update({ seasonalReminderSentAt: FieldValue.serverTimestamp() });
            stats.seasonalReminderSent++;
            logger.info('Seasonal reminder sent', { bookingId });
          } else {
            stats.errors++;
          }
        } catch (error) {
          logger.error('Error sending seasonal reminder', error as Error, { bookingId });
          stats.errors++;
        }
        continue;
      }

      stats.skipped++;
    }

    logger.info('Guest email sequences cron completed', stats);

    return NextResponse.json({
      success: true,
      processed: snapshot.docs.length,
      ...stats,
    });
  } catch (error) {
    logger.error('Error in guest-email-sequences cron', error as Error);
    return NextResponse.json(
      { error: 'Failed to process email sequences', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
