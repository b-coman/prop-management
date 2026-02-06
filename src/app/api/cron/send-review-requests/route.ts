import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { loggers } from '@/lib/logger';

const logger = loggers.email;

/**
 * Parse a Firestore date field that may be Timestamp, {_seconds}, or string.
 */
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
  logger.info('Send review requests cron endpoint called');

  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');

  if (!cronHeader && !authHeader?.startsWith('Bearer ')) {
    logger.error('Unauthorized access attempt to send-review-requests cron');
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

    logger.info('Found completed bookings', { count: snapshot.docs.length });

    let sent = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
      const bookingId = doc.id;
      const data = doc.data();

      // Skip if review request already sent
      if (data.reviewRequestSentAt) {
        skipped++;
        continue;
      }

      // Parse checkout date
      const checkOutDate = parseFirestoreDate(data.checkOutDate);
      if (!checkOutDate || isNaN(checkOutDate.getTime())) {
        logger.warn('Invalid checkOutDate for booking, skipping', { bookingId });
        skipped++;
        continue;
      }

      // Check if checkout was 1.5-3.5 days ago (sweet spot for review requests)
      const daysSinceCheckout = (now.getTime() - checkOutDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCheckout < 1.5 || daysSinceCheckout > 3.5) {
        skipped++;
        continue;
      }

      // Check if a review already exists for this booking
      const existingReview = await db
        .collection('reviews')
        .where('bookingId', '==', bookingId)
        .limit(1)
        .get();

      if (!existingReview.empty) {
        logger.info('Review already exists for booking, skipping', { bookingId });
        skipped++;
        continue;
      }

      // Send review request email
      try {
        const { sendReviewRequestEmail } = await import('@/services/emailService');
        const result = await sendReviewRequestEmail(bookingId);

        if (result.success) {
          await doc.ref.update({
            reviewRequestSentAt: FieldValue.serverTimestamp(),
          });
          sent++;
          logger.info('Review request sent', { bookingId });
        } else {
          logger.error('Failed to send review request', new Error(result.error || 'Unknown error'), { bookingId });
          skipped++;
        }
      } catch (emailError) {
        logger.error('Error sending review request email', emailError as Error, { bookingId });
        skipped++;
      }
    }

    logger.info('Review request cron completed', { processed: snapshot.docs.length, sent, skipped });

    return NextResponse.json({
      success: true,
      processed: snapshot.docs.length,
      sent,
      skipped,
    });
  } catch (error) {
    logger.error('Error in send-review-requests cron', error as Error);
    return NextResponse.json(
      { error: 'Failed to process review requests', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
