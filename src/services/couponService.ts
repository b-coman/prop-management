
// src/services/couponService.ts
'use server';

import { collection, doc, getDoc, Timestamp, where, query, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Client SDK Firestore instance
import type { Coupon, SerializableTimestamp } from '@/types';
import { parseISO, isWithinInterval, overlaps } from 'date-fns';

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
 * Checks existence, activity status, expiry, booking validity timeframe, and exclusion periods.
 *
 * @param couponCode - The coupon code string entered by the user.
 * @param bookingCheckInDate - The check-in date of the booking.
 * @param bookingCheckOutDate - The check-out date of the booking.
 * @returns A promise resolving to an object with discount percentage or an error message.
 */
export async function validateAndApplyCoupon(
  couponCode: string,
  bookingCheckInDate: Date | null,
  bookingCheckOutDate: Date | null
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
    const q = query(couponsCollection, where('code', '==', couponCodeUpper), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" not found.`);
      return { error: 'Invalid coupon code.' };
    }

    const couponDoc = querySnapshot.docs[0];
    // Cast data to include new fields, ensuring they can be null/undefined
    const couponData = couponDoc.data() as Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'validUntil' | 'bookingValidFrom' | 'bookingValidUntil' | 'exclusionPeriods'> & {
        createdAt: any;
        updatedAt?: any;
        validUntil: any;
        bookingValidFrom?: any | null;
        bookingValidUntil?: any | null;
        exclusionPeriods?: Array<{ start: any; end: any }> | null;
    };


    // --- Basic Validations ---
    if (!couponData.isActive) {
      console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" is not active.`);
      return { error: 'Coupon code is no longer active.' };
    }

    const couponExpiryDate = toDate(couponData.validUntil);
    const now = new Date(); // Compare with current date, not just timestamp
    if (couponExpiryDate && couponExpiryDate < now) {
      console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" has expired.`);
      return { error: 'Coupon code has expired.' };
    }

    if (typeof couponData.discount !== 'number' || couponData.discount <= 0 || couponData.discount > 100) {
      console.error(`[Coupon Service] Invalid discount percentage (${couponData.discount}) for coupon "${couponCodeUpper}".`);
      return { error: 'Invalid coupon configuration.' };
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
    if (bookingValidUntil && bookingCheckOutDate > bookingValidUntil) {
        console.warn(`[Coupon Service] Booking check-out (${bookingCheckOutDate.toISOString().split('T')[0]}) is after coupon booking validity end (${bookingValidUntil.toISOString().split('T')[0]}) for "${couponCodeUpper}".`);
        return { error: 'Coupon not valid for selected check-out date.' };
    }

    // --- Exclusion Period Validations ---
    if (couponData.exclusionPeriods && Array.isArray(couponData.exclusionPeriods)) {
        const bookingInterval = { start: bookingCheckInDate, end: bookingCheckOutDate };

        for (const period of couponData.exclusionPeriods) {
            const exclusionStart = toDate(period.start);
            const exclusionEnd = toDate(period.end);

            if (exclusionStart && exclusionEnd) {
                const exclusionInterval = { start: exclusionStart, end: exclusionEnd };
                // Check if the booking interval overlaps with any exclusion interval
                if (overlaps(bookingInterval, exclusionInterval)) {
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

