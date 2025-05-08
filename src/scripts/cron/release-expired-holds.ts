
// src/scripts/cron/release-expired-holds.ts
/**
 * @fileoverview Placeholder script for releasing expired booking holds.
 *
 * This script is intended to be run periodically (e.g., every hour) by a scheduler
 * (like Cloud Scheduler triggering a Cloud Function or a cron job on a server).
 *
 * It queries the 'bookings' collection for documents with status 'on-hold'
 * where the 'holdUntil' timestamp is in the past. For each expired hold,
 * it updates the booking status to 'cancelled' and triggers the availability
 * update to release the held dates.
 *
 * IMPORTANT: This is a placeholder script demonstrating the logic.
 * Actual implementation requires:
 * 1. Setting up a scheduler (e.g., Google Cloud Scheduler).
 * 2. Deploying this logic as a Cloud Function or running it on a server environment
 *    with appropriate Firebase Admin SDK credentials.
 * 3. Using the Firebase Admin SDK for Firestore operations if running server-side.
 * 4. Implementing robust error handling and logging.
 */
'use server'; // Keep 'use server' if it might be triggered via a server action for testing

import {
    collection,
    query,
    where,
    Timestamp as ClientTimestamp, // Use Client SDK Timestamp for comparison
    getDocs,
    writeBatch,
    doc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Assuming Client SDK for now, Admin SDK needed for server env
import { updatePropertyAvailability } from '@/services/bookingService'; // Import availability update function
import { format, isValid, parseISO } from 'date-fns';

async function releaseExpiredHolds() {
    console.log("--- [Cron Job Placeholder] Running releaseExpiredHolds ---");
    const now = ClientTimestamp.now(); // Get current Firestore timestamp (Client SDK version)
    const bookingsCollectionRef = collection(db, 'bookings');

    // Query for bookings that are 'on-hold' and whose holdUntil time is past
    const q = query(
        bookingsCollectionRef,
        where('status', '==', 'on-hold'),
        where('holdUntil', '<=', now)
    );

    try {
        const querySnapshot = await getDocs(q);
        console.log(`[releaseExpiredHolds] Found ${querySnapshot.docs.length} expired holds.`);

        if (querySnapshot.empty) {
            console.log("[releaseExpiredHolds] No expired holds to process.");
            return;
        }

        const batch = writeBatch(db);
        const availabilityUpdates = []; // Store promises for availability updates

        querySnapshot.forEach((docSnap) => {
            const bookingId = docSnap.id;
            const bookingData = docSnap.data();
            console.log(`[releaseExpiredHolds] Processing expired hold for booking ID: ${bookingId}`);

            // Update booking status to 'cancelled'
            const bookingRef = doc(db, 'bookings', bookingId);
            batch.update(bookingRef, {
                status: 'cancelled',
                notes: `Hold expired automatically on ${new Date().toISOString()}`,
                updatedAt: serverTimestamp(), // Use server timestamp
            });

            // Prepare availability update (needs propertyId, checkIn, checkOut)
            const propertyId = bookingData.propertyId;
            // Ensure dates are Date objects
            const checkInDate = bookingData.checkInDate instanceof ClientTimestamp ? bookingData.checkInDate.toDate() : (bookingData.checkInDate ? parseISO(bookingData.checkInDate as string) : null);
            const checkOutDate = bookingData.checkOutDate instanceof ClientTimestamp ? bookingData.checkOutDate.toDate() : (bookingData.checkOutDate ? parseISO(bookingData.checkOutDate as string) : null);

            if (propertyId && checkInDate && checkOutDate && isValid(checkInDate) && isValid(checkOutDate)) {
                console.log(`[releaseExpiredHolds] Preparing to release availability for property ${propertyId}, booking ${bookingId}.`);
                 // Add the async availability update call to a list
                 availabilityUpdates.push(
                    updatePropertyAvailability(propertyId, checkInDate, checkOutDate, true) // Mark as available
                        .then(() => console.log(`[releaseExpiredHolds] Availability released for booking ${bookingId}`))
                        .catch(err => console.error(`❌ Failed to release availability for booking ${bookingId}:`, err))
                );
            } else {
                 console.warn(`[releaseExpiredHolds] Missing data to release availability for booking ${bookingId}: propertyId=${propertyId}, checkIn=${checkInDate}, checkOut=${checkOutDate}`);
            }
        });

        // Commit Firestore batch updates
        console.log("[releaseExpiredHolds] Committing Firestore batch...");
        await batch.commit();
        console.log("✅ [releaseExpiredHolds] Firestore batch committed successfully.");

        // Wait for all availability updates to complete (or fail)
        console.log("[releaseExpiredHolds] Waiting for availability updates to complete...");
        await Promise.allSettled(availabilityUpdates);
        console.log("✅ [releaseExpiredHolds] All availability updates processed.");


    } catch (error) {
        console.error("❌ Error processing expired holds:", error);
        // Implement proper error reporting here (e.g., send to Sentry, log monitoring)
    } finally {
        console.log("--- [Cron Job Placeholder] Finished releaseExpiredHolds ---");
    }
}

// --- How to Run ---
// This function needs to be triggered by a scheduler.
// Example (conceptual - requires setup):
// 1. Deploy this logic as a Google Cloud Function.
// 2. Create a Google Cloud Scheduler job to trigger the function periodically (e.g., every hour).

// For local testing, you could potentially call this function manually or via a test route,
// but remember it uses the Client SDK here, so permissions might be an issue
// unless run in an environment with appropriate credentials or using the Admin SDK.

// Example of manual trigger (for testing purposes only):
// releaseExpiredHolds().catch(console.error);
