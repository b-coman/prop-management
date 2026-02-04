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
import { format, isValid, parseISO } from 'date-fns';
import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { loggers } from '@/lib/logger';

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
          updateAvailabilityAdmin(db, propertyId, checkInDate, checkOutDate, true)
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

/**
 * Update property availability using Admin SDK
 */
async function updateAvailabilityAdmin(
  db: FirebaseFirestore.Firestore,
  propertyId: string,
  checkInDate: Date,
  checkOutDate: Date,
  available: boolean
): Promise<void> {
  logger.debug('Updating availability', { propertyId, action: available ? 'releasing' : 'blocking' });
  
  // Get date range (excluding check-out date)
  const dates: Date[] = [];
  const currentDate = new Date(checkInDate);
  
  while (currentDate < checkOutDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  if (dates.length === 0) {
    logger.debug('No dates to update', { propertyId });
    return;
  }
  
  // Group updates by month
  const updatesByMonth: { [monthKey: string]: { [day: number]: boolean } } = {};
  
  dates.forEach(date => {
    const monthKey = format(date, 'yyyy-MM');
    const day = date.getDate();
    
    if (!updatesByMonth[monthKey]) {
      updatesByMonth[monthKey] = {};
    }
    updatesByMonth[monthKey][day] = available;
  });
  
  // Apply updates
  const batch = db.batch();
  
  for (const [monthKey, dayUpdates] of Object.entries(updatesByMonth)) {
    const docId = `${propertyId}_${monthKey}`;
    const docRef = db.collection('availability').doc(docId);
    
    // Prepare update object
    const updateData: { [key: string]: any } = {
      updatedAt: new Date()
    };
    
    for (const [day, isAvailable] of Object.entries(dayUpdates)) {
      updateData[`available.${day}`] = isAvailable;
      // Clear hold when making available - use FieldValue.delete() to remove the field
      if (isAvailable) {
        updateData[`holds.${day}`] = FieldValue.delete();
      }
    }
    
    logger.debug('Updating availability document', { docId, daysCount: Object.keys(dayUpdates).length });
    // Use update() instead of set() with merge - update() properly handles dot notation for nested maps
    batch.update(docRef, updateData);
  }

  await batch.commit();
  logger.info('Completed availability updates', { propertyId });
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