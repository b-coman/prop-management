// src/services/couponService.ts
'use server';

import { collection, doc, getDoc, Timestamp, where, query, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Client SDK Firestore instance
import type { Coupon, SerializableTimestamp } from '@/types';
import { parseISO, isWithinInterval, areIntervalsOverlapping } from 'date-fns';
import { sanitizeText } from '@/lib/sanitize'; // Import sanitizer

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
    return new Date(timestamp);
  }
  return null;
};

export async function validateAndApplyCoupon(
  couponCodeInput: string, // Renamed to avoid confusion with sanitized version
  bookingCheckInDate: Date | null,
  bookingCheckOutDate: Date | null,
  propertyId?: string | null
): Promise<{ discountPercentage?: number; error?: string }> {
  const couponCode = sanitizeText(couponCodeInput); // Sanitize the input code

  if (!couponCode) {
    return { error: 'Coupon code cannot be empty.' };
  }
  if (!bookingCheckInDate || !bookingCheckOutDate || bookingCheckOutDate <= bookingCheckInDate) {
    return { error: 'Valid booking dates are required to apply a coupon.' };
  }

  const couponCodeUpper = couponCode.toUpperCase();

  try {
    const couponsCollection = collection(db, 'coupons');
    const q = query(couponsCollection, where('code', '==', couponCodeUpper), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" not found.`);
      return { error: 'Invalid coupon code.' };
    }

    const couponDoc = querySnapshot.docs[0];
    const couponData = couponDoc.data() as Coupon;

    if (!couponData.isActive) {
      console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" is not active.`);
      return { error: 'Coupon code is no longer active.' };
    }

    const couponExpiryDate = toDate(couponData.validUntil);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (couponExpiryDate && couponExpiryDate < todayStart) {
      console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" has expired on ${couponExpiryDate.toISOString().split('T')[0]}.`);
      return { error: 'Coupon code has expired.' };
    }

    if (typeof couponData.discount !== 'number' || couponData.discount <= 0 || couponData.discount > 100) {
      console.error(`[Coupon Service] Invalid discount percentage (${couponData.discount}) for coupon "${couponCodeUpper}".`);
      return { error: 'Invalid coupon configuration.' };
    }

    if (couponData.propertyId && propertyId && couponData.propertyId !== propertyId) {
      console.warn(`[Coupon Service] Coupon "${couponCodeUpper}" is only valid for property ${couponData.propertyId}, but booking is for ${propertyId}.`);
      return { error: 'Coupon is not valid for this property.' };
    }
    if (couponData.propertyId && !propertyId) {
      console.warn(`[Coupon Service] Coupon "${couponCodeUpper}" requires a specific property, but none was provided for the booking.`);
      return { error: 'Coupon requires a specific property.' };
    }

    const bookingValidFrom = toDate(couponData.bookingValidFrom);
    const bookingValidUntil = toDate(couponData.bookingValidUntil);

    if (bookingValidFrom && bookingCheckInDate < bookingValidFrom) {
      console.warn(`[Coupon Service] Booking check-in (${bookingCheckInDate.toISOString().split('T')[0]}) is before coupon booking validity start (${bookingValidFrom.toISOString().split('T')[0]}) for "${couponCodeUpper}".`);
      return { error: 'Coupon not valid for selected check-in date.' };
    }

    if (bookingValidUntil) {
      const validityEndDate = new Date(bookingValidUntil.getFullYear(), bookingValidUntil.getMonth(), bookingValidUntil.getDate(), 23, 59, 59, 999);
      if (bookingCheckInDate > validityEndDate) {
        console.warn(`[Coupon Service] Booking check-in (${bookingCheckInDate.toISOString().split('T')[0]}) is after coupon booking validity end (${bookingValidUntil.toISOString().split('T')[0]}) for "${couponCodeUpper}".`);
        return { error: 'Coupon not valid for selected check-in date.' };
      }
    }

    if (couponData.exclusionPeriods && Array.isArray(couponData.exclusionPeriods)) {
      const bookingInterval = { start: bookingCheckInDate, end: new Date(bookingCheckOutDate.getTime() - 1) };
      for (const period of couponData.exclusionPeriods) {
        const exclusionStart = toDate(period.start);
        const exclusionEnd = toDate(period.end);
        if (exclusionStart && exclusionEnd) {
          const exclusionInterval = { start: exclusionStart, end: new Date(exclusionEnd.getFullYear(), exclusionEnd.getMonth(), exclusionEnd.getDate(), 23, 59, 59, 999)};
          if (areIntervalsOverlapping(bookingInterval, exclusionInterval, { inclusive: true })) {
            console.warn(`[Coupon Service] Booking dates (${bookingCheckInDate.toISOString().split('T')[0]} - ${bookingCheckOutDate.toISOString().split('T')[0]}) overlap with exclusion period (${exclusionStart.toISOString().split('T')[0]} - ${exclusionEnd.toISOString().split('T')[0]}) for "${couponCodeUpper}".`);
            return { error: 'Coupon not valid for the selected dates due to an exclusion period.' };
          }
        } else {
          console.warn(`[Coupon Service] Invalid exclusion period found for coupon "${couponCodeUpper}":`, period);
        }
      }
    }

    console.log(`[Coupon Service] Coupon code "${couponCodeUpper}" validated successfully for the booking dates. Discount: ${couponData.discount}%`);
    return { discountPercentage: couponData.discount };
  } catch (error) {
    console.error(`❌ [Coupon Service] Error validating coupon code "${couponCodeUpper}":`, error);
    return { error: 'Could not validate coupon code. Please try again.' };
  }
}
