# Hold Expiration Implementation

This document outlines the plan for implementing an automatic cleanup system for expired holds in the RentalSpot booking system.

## Current Implementation

The booking system currently supports placing holds on property dates with the following features:

- A guest can pay a hold fee to reserve dates for 24 hours
- When a hold is created:
  - A booking record is created with status `on-hold`
  - The `holdUntil` field is set to 24 hours from payment time
  - The dates are marked as unavailable in the Firestore availability collection
  - The hold booking ID is stored in the `holds` map in the availability record
  - A hold confirmation email is sent to the guest

## Problem: Expired Holds

Currently, when a hold expires (after 24 hours), the system does not automatically:
- Update the booking status to `expired`
- Release the held dates back to available
- Remove the hold booking ID from the availability records

This can lead to dates remaining blocked in the calendar even after a hold has expired.

## Proposed Solution: Scheduled Cloud Function

The recommended approach is to implement a Firebase Cloud Function that runs on a schedule (e.g., hourly) to:

1. Query for bookings with status `on-hold` and `holdUntil` date in the past
2. Update these bookings to status `expired`
3. Release the held dates in the availability calendar
4. Optionally send notifications to admins/owners

## Implementation Details

### Cloud Function Pseudocode

```typescript
export async function checkExpiredHolds() {
  console.log(`[checkExpiredHolds] Checking for expired holds`);
  
  const now = new Date();
  const bookingsRef = collection(db, 'bookings');
  const expiredHoldsQuery = query(
    bookingsRef,
    where('status', '==', 'on-hold'),
    where('holdUntil', '<', now)
  );

  const expiredHoldsSnapshot = await getDocs(expiredHoldsQuery);
  console.log(`[checkExpiredHolds] Found ${expiredHoldsSnapshot.size} expired holds`);

  const batch = writeBatch(db);
  const processedHolds: string[] = [];

  for (const doc of expiredHoldsSnapshot.docs) {
    const holdBooking = doc.data() as Booking;
    console.log(`[checkExpiredHolds] Processing expired hold: ${doc.id}`);
    
    // Update booking status to 'expired'
    batch.update(doc.ref, { 
      status: 'expired',
      updatedAt: serverTimestamp()
    });
    
    processedHolds.push(doc.id);
  }

  // Commit the batch update
  await batch.commit();
  console.log(`[checkExpiredHolds] Updated ${processedHolds.length} expired holds to 'expired' status`);

  // Now release availability for each expired hold
  for (const bookingId of processedHolds) {
    try {
      const bookingData = await getBookingById(bookingId);
      if (bookingData && bookingData.checkInDate && bookingData.checkOutDate) {
        console.log(`[checkExpiredHolds] Releasing availability for expired hold: ${bookingId}`);
        await updatePropertyAvailability(
          bookingData.propertyId, 
          bookingData.checkInDate instanceof Date ? bookingData.checkInDate : new Date(bookingData.checkInDate as any),
          bookingData.checkOutDate instanceof Date ? bookingData.checkOutDate : new Date(bookingData.checkOutDate as any),
          true // Mark as available
        );
      }
    } catch (error) {
      console.error(`[checkExpiredHolds] Error releasing availability for booking ${bookingId}:`, error);
    }
  }

  console.log(`[checkExpiredHolds] Completed processing ${processedHolds.length} expired holds`);
  return processedHolds;
}
```

### Scheduled Trigger

```typescript
export const hourlyExpiredHoldCheck = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    await checkExpiredHolds();
    return null;
  });
```

## Deployment Requirements

- Firebase project with Cloud Functions enabled
- Proper IAM permissions for the function to access Firestore
- Environment variable configuration for any customization options

## Testing Plan

1. Create test holds with short expiration times (e.g., 5 minutes)
2. Verify that the function correctly identifies and processes expired holds
3. Check that dates are properly released in the availability calendar
4. Ensure booking statuses are correctly updated to `expired`

## Future Enhancements

- Add notification emails to property owners when holds expire
- Implement a dashboard view for monitoring hold statuses
- Create analytics for tracking hold conversion rates

## Timeline

This feature should be implemented after the current hold flow is fully completed and tested.

**Priority:** Medium
**Estimated effort:** 4-6 hours