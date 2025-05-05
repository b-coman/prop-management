
// src/services/couponService.ts
'use server';

import { collection, doc, getDoc, Timestamp, where, query, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Client SDK Firestore instance
import type { Coupon, SerializableTimestamp } from '@/types';
import { parseISO, isWithinInterval, areIntervalsOverlapping } from 'date-fns'; // Changed 'overlaps' to 'areIntervalsOverlapping'

// Helper function to convert SerializableTimestamp to Date or null
const toDate = (timestamp: SerializableTimestamp | undefined | null): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  if (typeof timestamp === 'string') {
    try {
      return parseISO(timestamp);
    } catch {
      return null;
    }
  }
  if (typeof timestamp === 'number') {
    // Assuming number is milliseconds since epoch
    return new Date(timestamp);
  }
  return null;
};

/**
 * Validates a coupon code against the Firestore 'coupons' collection.
 * Checks existence, activity status, expiry, booking validity timeframe, exclusion periods,
 * and optionally if the coupon is restricted to a specific property.
 *
 * @param couponCode - The coupon code string entered by the user.
 * @param bookingCheckInDate - The check-in date of the booking.
 * @param bookingCheckOutDate - The check-out date of the booking.
 * @param propertyId - Optional. The slug of the property the booking is for. If provided, checks property restriction.
 * @returns A promise resolving to an object with discount percentage or an error message.
 */
export async function validateAndApplyCoupon(
  couponCode: string,
  bookingCheckInDate: Date | null,
  bookingCheckOutDate: Date | null,
  propertyId?: string | null // Optional property slug
): Promise<{ discountPercentage?: number; error?: string }> {
  if (!couponCode) {
    return { error: 'Coupon code cannot be empty.' };
  }
  if (!bookingCheckInDate || !bookingCheckOutDate || bookingCheckOutDate <= bookingCheckInDate) {
      return { error: 'Valid booking dates are required to apply a coupon.' };
  }

  const couponCodeUpper = couponCode.toUpperCase(); // Normalize code

  try {
    const couponsCollection = collection(db, 'coupons');
    // Query by code first
    const q = query(couponsCollection, where('code', '==', couponCodeUpper), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" not found.`);
      return { error: 'Invalid coupon code.' };
    }

    const couponDoc = querySnapshot.docs[0];
    // Cast data to include new fields, ensuring they can be null/undefined
    const couponData = couponDoc.data() as Coupon; // Use Coupon type directly now

    // --- Basic Validations ---
    if (!couponData.isActive) {
      console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" is not active.`);
      return { error: 'Coupon code is no longer active.' };
    }

    const couponExpiryDate = toDate(couponData.validUntil);
    const now = new Date(); // Compare with current date, not just timestamp
    // Make comparison based on the start of the day for coupon expiry
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (couponExpiryDate && couponExpiryDate < todayStart) {
      console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" has expired on ${couponExpiryDate.toISOString().split('T')[0]}.`);
      return { error: 'Coupon code has expired.' };
    }


    if (typeof couponData.discount !== 'number' || couponData.discount <= 0 || couponData.discount > 100) {
      console.error(`[Coupon Service] Invalid discount percentage (${couponData.discount}) for coupon "${couponCodeUpper}".`);
      return { error: 'Invalid coupon configuration.' };
    }

    // --- Property Restriction Validation ---
    // Check if the coupon has a propertyId and if it matches the booking's propertyId
    if (couponData.propertyId && propertyId && couponData.propertyId !== propertyId) {
        console.warn(`[Coupon Service] Coupon "${couponCodeUpper}" is only valid for property ${couponData.propertyId}, but booking is for ${propertyId}.`);
        return { error: 'Coupon is not valid for this property.' };
    }
    // If coupon has propertyId but booking doesn't, it's also an error (though unlikely in current flow)
    if (couponData.propertyId && !propertyId) {
        console.warn(`[Coupon Service] Coupon "${couponCodeUpper}" requires a specific property, but none was provided for the booking.`);
        return { error: 'Coupon requires a specific property.' };
    }


    // --- Booking Timeframe Validations ---
    const bookingValidFrom = toDate(couponData.bookingValidFrom);
    const bookingValidUntil = toDate(couponData.bookingValidUntil);

    // Check if booking starts before the valid period
    if (bookingValidFrom && bookingCheckInDate < bookingValidFrom) {
        console.warn(`[Coupon Service] Booking check-in (${bookingCheckInDate.toISOString().split('T')[0]}) is before coupon booking validity start (${bookingValidFrom.toISOString().split('T')[0]}) for "${couponCodeUpper}".`);
        return { error: 'Coupon not valid for selected check-in date.' };
    }

    // Check if booking ends after the valid period
    // For bookingValidUntil, we should check if the *check-in* date is after the validity end date
    // OR if the check-out date is strictly after the validity end date.
    if (bookingValidUntil) {
         // Set validity end to the end of the day for comparison
         const validityEndDate = new Date(bookingValidUntil.getFullYear(), bookingValidUntil.getMonth(), bookingValidUntil.getDate(), 23, 59, 59, 999);
         if (bookingCheckInDate > validityEndDate) {
             console.warn(`[Coupon Service] Booking check-in (${bookingCheckInDate.toISOString().split('T')[0]}) is after coupon booking validity end (${bookingValidUntil.toISOString().split('T')[0]}) for "${couponCodeUpper}".`);
             return { error: 'Coupon not valid for selected check-in date.' };
         }
         // Note: Check-out date is typically exclusive. A booking ending on the validity date should be allowed.
         // However, if the policy is strict, you might compare bookingCheckOutDate > validityEndDate + 1 day or similar.
         // Sticking to check-in date for simplicity based on typical coupon logic.
    }


    // --- Exclusion Period Validations ---
    if (couponData.exclusionPeriods && Array.isArray(couponData.exclusionPeriods)) {
        // The booking interval includes the check-in day but excludes the check-out day for night calculations.
        // For overlap checking, we should consider the full range of occupied days.
        const bookingInterval = { start: bookingCheckInDate, end: new Date(bookingCheckOutDate.getTime() - 1) }; // Adjust end date to be inclusive

        for (const period of couponData.exclusionPeriods) {
            const exclusionStart = toDate(period.start);
            const exclusionEnd = toDate(period.end);

            if (exclusionStart && exclusionEnd) {
                // Ensure exclusion end is inclusive for overlap check
                const exclusionInterval = { start: exclusionStart, end: new Date(exclusionEnd.getFullYear(), exclusionEnd.getMonth(), exclusionEnd.getDate(), 23, 59, 59, 999)};
                // Check if the booking interval overlaps with any exclusion interval
                if (areIntervalsOverlapping(bookingInterval, exclusionInterval, { inclusive: true })) { // Use areIntervalsOverlapping
                     console.warn(`[Coupon Service] Booking dates (${bookingCheckInDate.toISOString().split('T')[0]} - ${bookingCheckOutDate.toISOString().split('T')[0]}) overlap with exclusion period (${exclusionStart.toISOString().split('T')[0]} - ${exclusionEnd.toISOString().split('T')[0]}) for "${couponCodeUpper}".`);
                     return { error: 'Coupon not valid for the selected dates due to an exclusion period.' };
                }
            } else {
                 console.warn(`[Coupon Service] Invalid exclusion period found for coupon "${couponCodeUpper}":`, period);
            }
        }
    }


    // TODO: Add validation for usage limits if implemented (maxUses, currentUses)

    console.log(`[Coupon Service] Coupon code "${couponCodeUpper}" validated successfully for the booking dates. Discount: ${couponData.discount}%`);
    return { discountPercentage: couponData.discount };

  } catch (error) {
    console.error(`❌ [Coupon Service] Error validating coupon code "${couponCodeUpper}":`, error);
    return { error: 'Could not validate coupon code. Please try again.' }; // Generic error for the user
  }
}
