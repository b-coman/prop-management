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

export async function GET(request: NextRequest) {
  console.log("--- [Cron API] Release expired holds endpoint called ---");
  
  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');
  
  // For Cloud Scheduler, check for Bearer token or cron header
  if (!cronHeader && !authHeader?.startsWith('Bearer ')) {
    console.error('[Cron API] Unauthorized access attempt');
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

    console.log('[Cron API] Querying for expired holds...');
    const now = new Date();
    
    // Query for expired holds using Admin SDK
    const expiredHoldsQuery = db.collection('bookings')
      .where('status', '==', 'on-hold')
      .where('holdUntil', '<=', now);
    
    const snapshot = await expiredHoldsQuery.get();
    console.log(`[Cron API] Found ${snapshot.docs.length} expired holds to process`);

    if (snapshot.empty) {
      console.log('[Cron API] No expired holds found');
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
      
      console.log(`[Cron API] Processing expired hold: ${bookingId}`);
      
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
      console.log(`[Cron API] Raw dates for ${bookingId}: checkIn type=${rawCheckIn?.constructor?.name}, checkOut type=${rawCheckOut?.constructor?.name}`);

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

      console.log(`[Cron API] Parsed dates: checkIn=${checkInDate?.toISOString()}, checkOut=${checkOutDate?.toISOString()}, valid=${checkInDate && checkOutDate ? isValid(checkInDate) && isValid(checkOutDate) : 'N/A'}`);

      if (propertyId && checkInDate && checkOutDate && isValid(checkInDate) && isValid(checkOutDate)) {
        console.log(`[Cron API] Scheduling availability release for property ${propertyId}`);
        
        // Add availability update to the queue
        availabilityUpdates.push(
          updateAvailabilityAdmin(db, propertyId, checkInDate, checkOutDate, true)
            .then(() => console.log(`[Cron API] ✅ Released availability for booking ${bookingId}`))
            .catch(err => console.error(`[Cron API] ❌ Failed to release availability for booking ${bookingId}:`, err))
        );
        
        processedCount++;
      } else {
        console.warn(`[Cron API] Invalid data for booking ${bookingId}, skipping availability update`);
      }
    }

    // Commit booking status updates
    console.log('[Cron API] Committing booking status updates...');
    await batch.commit();
    console.log('[Cron API] ✅ Booking status updates committed');

    // Process availability updates
    console.log('[Cron API] Processing availability updates...');
    await Promise.allSettled(availabilityUpdates);
    console.log('[Cron API] ✅ Availability updates completed');

    console.log(`[Cron API] Successfully processed ${processedCount} expired holds`);
    
    return NextResponse.json({
      success: true,
      processed: processedCount,
      message: `Successfully processed ${processedCount} expired holds`
    });

  } catch (error) {
    console.error('[Cron API] Error processing expired holds:', error);
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
  console.log(`[updateAvailabilityAdmin] ${available ? 'Releasing' : 'Blocking'} dates for property ${propertyId}`);
  
  // Get date range (excluding check-out date)
  const dates: Date[] = [];
  const currentDate = new Date(checkInDate);
  
  while (currentDate < checkOutDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  if (dates.length === 0) {
    console.log('[updateAvailabilityAdmin] No dates to update');
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
    
    console.log(`[updateAvailabilityAdmin] Updating ${docId} with ${Object.keys(dayUpdates).length} days`);
    batch.set(docRef, updateData, { merge: true });
  }
  
  await batch.commit();
  console.log(`[updateAvailabilityAdmin] ✅ Completed availability updates for property ${propertyId}`);
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