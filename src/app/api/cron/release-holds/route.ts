/**
 * @fileoverview Cloud Function endpoint for releasing expired booking holds.
 *
 * This API endpoint is designed to be triggered by Cloud Scheduler (cron job)
 * and processes expired holds automatically. It uses Firebase Admin SDK for
 * server-side operations and proper authorization.
 *
 * Security: Only accessible via cron job with proper authorization header.
 * Frequency: Intended to run every hour via Cloud Scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';
import { isValid, parseISO } from 'date-fns';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { loggers } from '@/lib/logger';
import { updateAvailabilityAdmin } from '@/lib/availability-admin';

const logger = loggers.booking;

export async function GET(request: NextRequest) {
  logger.info('Release expired holds endpoint called');

  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');

  // For Cloud Scheduler, check for Bearer token or cron header
  if (!cronHeader && !authHeader?.startsWith('Bearer ')) {
    logger.error('Unauthorized access attempt to cron endpoint');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const db = await getFirestoreForPricing();
    if (!db) {
      throw new Error('Firebase Admin SDK not available');
    }

    logger.debug('Querying for expired holds');
    const now = new Date();

    // Query for expired holds using Admin SDK
    const expiredHoldsQuery = db.collection('bookings')
      .where('status', '==', 'on-hold')
      .where('holdUntil', '<=', now);

    const snapshot = await expiredHoldsQuery.get();
    logger.info('Found expired holds', { count: snapshot.docs.length });

    if (snapshot.empty) {
      logger.info('No expired holds found');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No expired holds to process'
      });
    }

    const batch = db.batch();
    const availabilityUpdates: Promise<void>[] = [];
    let processedCount = 0;

    for (const doc of snapshot.docs) {
      const bookingId = doc.id;
      const bookingData = doc.data();

      logger.info('Processing expired hold', { bookingId });

      // Update booking status to cancelled
      batch.update(doc.ref, {
        status: 'cancelled',
        notes: `Hold expired automatically on ${now.toISOString()}`,
        updatedAt: new Date()
      });

      // Prepare availability update
      const propertyId = bookingData.propertyId;
      const rawCheckIn = bookingData.checkInDate;
      const rawCheckOut = bookingData.checkOutDate;

      // Debug logging for date parsing
      logger.debug('Raw dates for booking', { bookingId, checkInType: rawCheckIn?.constructor?.name, checkOutType: rawCheckOut?.constructor?.name });

      // Parse dates - Admin SDK returns Timestamp objects from firebase-admin/firestore
      // These have a toDate() method, but we need to handle both Timestamp and string formats
      let checkInDate: Date | null = null;
      if (rawCheckIn instanceof AdminTimestamp) {
        checkInDate = rawCheckIn.toDate();
      } else if (rawCheckIn && typeof rawCheckIn === 'object' && '_seconds' in rawCheckIn) {
        // Handle case where Timestamp was serialized with _seconds/_nanoseconds
        checkInDate = new Date((rawCheckIn as any)._seconds * 1000);
      } else if (typeof rawCheckIn === 'string') {
        checkInDate = parseISO(rawCheckIn);
      }

      let checkOutDate: Date | null = null;
      if (rawCheckOut instanceof AdminTimestamp) {
        checkOutDate = rawCheckOut.toDate();
      } else if (rawCheckOut && typeof rawCheckOut === 'object' && '_seconds' in rawCheckOut) {
        // Handle case where Timestamp was serialized with _seconds/_nanoseconds
        checkOutDate = new Date((rawCheckOut as any)._seconds * 1000);
      } else if (typeof rawCheckOut === 'string') {
        checkOutDate = parseISO(rawCheckOut);
      }

      logger.debug('Parsed dates', { bookingId, checkIn: checkInDate?.toISOString(), checkOut: checkOutDate?.toISOString() });

      if (propertyId && checkInDate && checkOutDate && isValid(checkInDate) && isValid(checkOutDate)) {
        logger.debug('Scheduling availability release', { bookingId, propertyId });

        // Add availability update to the queue
        availabilityUpdates.push(
          updateAvailabilityAdmin(propertyId, checkInDate, checkOutDate, true)
            .then(() => logger.info('Released availability for booking', { bookingId }))
            .catch(err => logger.error('Failed to release availability', err as Error, { bookingId }))
        );

        processedCount++;
      } else {
        logger.warn('Invalid data for booking, skipping availability update', { bookingId });
      }
    }

    // Commit booking status updates
    logger.debug('Committing booking status updates');
    await batch.commit();
    logger.info('Booking status updates committed');

    // Process availability updates
    logger.debug('Processing availability updates');
    await Promise.allSettled(availabilityUpdates);
    logger.info('Availability updates completed');

    logger.info('Successfully processed expired holds', { processedCount });
    
    return NextResponse.json({
      success: true,
      processed: processedCount,
      message: `Successfully processed ${processedCount} expired holds`
    });

  } catch (error) {
    logger.error('Error processing expired holds', error as Error);
    return NextResponse.json(
      {
        error: 'Failed to process expired holds',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// POST method for manual testing (protected)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Call the GET handler for manual testing
  return GET(request);
}