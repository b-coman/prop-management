
// src/services/couponService.ts
'use server';

import { collection, doc, getDoc, Timestamp, where, query, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Client SDK Firestore instance
import type { Coupon } from '@/types';

/**
 * Validates a coupon code against the Firestore 'coupons' collection.
 * Checks if the coupon exists, is active, and has not expired.
 *
 * @param couponCode - The coupon code string entered by the user.
 * @returns A promise resolving to an object with discount percentage or an error message.
 */
export async function validateAndApplyCoupon(couponCode: string): Promise<{ discountPercentage?: number; error?: string }> {
  if (!couponCode) {
    return { error: 'Coupon code cannot be empty.' };
  }

  const couponCodeUpper = couponCode.toUpperCase(); // Normalize code for case-insensitive matching

  try {
    const couponsCollection = collection(db, 'coupons');
    // Query by code (assuming code is unique or you want the first match)
    // You could also use the coupon code as the document ID for direct lookup: const couponRef = doc(db, 'coupons', couponCodeUpper);
    const q = query(couponsCollection, where('code', '==', couponCodeUpper), limit(1));
    const querySnapshot = await getDocs(q);


    if (querySnapshot.empty) {
      console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" not found.`);
      return { error: 'Invalid coupon code.' };
    }

    const couponDoc = querySnapshot.docs[0];
    const couponData = couponDoc.data() as Omit<Coupon, 'id'>;

    // Validate isActive status
    if (!couponData.isActive) {
      console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" is not active.`);
      return { error: 'Coupon code is no longer active.' };
    }

    // Validate expiration date
    const now = Timestamp.now();
    if (couponData.validUntil && couponData.validUntil < now) {
      console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" has expired.`);
      return { error: 'Coupon code has expired.' };
    }

    // Validate discount value
    if (typeof couponData.discount !== 'number' || couponData.discount <= 0 || couponData.discount > 100) {
        console.error(`[Coupon Service] Invalid discount percentage (${couponData.discount}) found for coupon "${couponCodeUpper}".`);
        return { error: 'Invalid coupon configuration.' }; // Internal error, don't expose details
    }

    // TODO: Add validation for usage limits if implemented (maxUses, currentUses)

    console.log(`[Coupon Service] Coupon code "${couponCodeUpper}" validated successfully. Discount: ${couponData.discount}%`);
    return { discountPercentage: couponData.discount };

  } catch (error) {
    console.error(`❌ [Coupon Service] Error validating coupon code "${couponCodeUpper}":`, error);
    return { error: 'Could not validate coupon code. Please try again.' }; // Generic error for the user
  }
}
