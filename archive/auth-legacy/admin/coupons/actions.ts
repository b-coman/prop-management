// src/app/admin/coupons/actions.ts
"use server";

import { z } from "zod";
import { collection, getDocs, doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Coupon, SerializableTimestamp } from "@/types";
import { revalidatePath } from "next/cache";
import { sanitizeText } from "@/lib/sanitize";

// Schema for updating coupon status
const updateCouponStatusSchema = z.object({
  couponId: z.string().min(1, "Coupon ID is required."),
  isActive: z.boolean(),
});

// Schema for updating coupon expiry date
const updateCouponExpirySchema = z.object({
  couponId: z.string().min(1, "Coupon ID is required."),
  validUntil: z.date(), // Expecting a Date object from the client
});

// Schema for updating coupon booking validity period
const updateCouponBookingValiditySchema = z.object({
    couponId: z.string().min(1, "Coupon ID is required."),
    bookingValidFrom: z.date().nullable(),
    bookingValidUntil: z.date().nullable(),
}).refine(data => {
    if (data.bookingValidFrom && data.bookingValidUntil) {
        return data.bookingValidUntil >= data.bookingValidFrom;
    }
    return true;
}, {
    message: "Booking validity end date must be on or after the start date.",
    path: ["bookingValidUntil"],
});

// Schema for updating coupon exclusion periods
const exclusionPeriodSchema = z.object({
  start: z.date(),
  end: z.date(),
}).refine(data => data.end >= data.start, { // Allow same day start/end
  message: "Exclusion end date must be on or after the start date.",
  path: ["end"],
});

const updateCouponExclusionsSchema = z.object({
  couponId: z.string().min(1, "Coupon ID is required."),
  exclusionPeriods: z.array(exclusionPeriodSchema),
});


// Helper to convert Firestore Timestamp or string date to a serializable format (ISO string)
const serializeTimestamp = (timestamp: SerializableTimestamp | undefined | null): string | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  if (typeof timestamp === 'string') {
    try {
      return new Date(timestamp).toISOString();
    } catch (e) {
      console.warn(`Could not parse date string to ISOString: ${timestamp}`, e);
      return null;
    }
  }
  if (typeof timestamp === 'number') {
    return new Date(timestamp).toISOString();
  }
  console.warn(`Unhandled timestamp type for serialization: ${typeof timestamp}`, timestamp);
  return null;
};


export async function fetchCoupons(): Promise<Coupon[]> {
  try {
    const couponsCollection = collection(db, 'coupons');
    const querySnapshot = await getDocs(couponsCollection);
    const coupons = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      // Convert Timestamps to ISO strings for client components
      return {
        id: doc.id,
        ...data,
        validUntil: serializeTimestamp(data.validUntil),
        bookingValidFrom: serializeTimestamp(data.bookingValidFrom),
        bookingValidUntil: serializeTimestamp(data.bookingValidUntil),
        exclusionPeriods: data.exclusionPeriods?.map((p: {start: SerializableTimestamp, end: SerializableTimestamp}) => ({
            start: serializeTimestamp(p.start),
            end: serializeTimestamp(p.end),
        })) || null,
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
      } as Coupon; // Cast to Coupon to ensure type compatibility
    });
    return coupons;
  } catch (error) {
    console.error("[Action fetchCoupons] Error fetching coupons:", error);
    return []; // Return empty array on error
  }
}

export async function updateCouponStatusAction(
  values: z.infer<typeof updateCouponStatusSchema>
): Promise<{ success: boolean; error?: string }> {
  const validatedFields = updateCouponStatusSchema.safeParse(values);

  if (!validatedFields.success) {
    return { success: false, error: "Invalid input." };
  }

  const { couponId, isActive } = validatedFields.data;

  try {
    const couponRef = doc(db, 'coupons', couponId);
    await updateDoc(couponRef, {
      isActive: isActive,
      updatedAt: serverTimestamp(),
    });
    revalidatePath('/admin/coupons');
    return { success: true };
  } catch (error) {
    console.error("[Action updateCouponStatusAction] Error updating coupon status:", error);
    return { success: false, error: "Failed to update coupon status." };
  }
}

export async function updateCouponExpiryAction(
  values: z.infer<typeof updateCouponExpirySchema>
): Promise<{ success: boolean; error?: string }> {
  const validatedFields = updateCouponExpirySchema.safeParse(values);

  if (!validatedFields.success) {
     const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, error: `Invalid input: ${errorMessages}` };
  }

  const { couponId, validUntil } = validatedFields.data;

  try {
    const couponRef = doc(db, 'coupons', couponId);
    await updateDoc(couponRef, {
      validUntil: Timestamp.fromDate(validUntil), // Convert Date to Firestore Timestamp
      updatedAt: serverTimestamp(),
    });
    revalidatePath('/admin/coupons');
    return { success: true };
  } catch (error) {
    console.error("[Action updateCouponExpiryAction] Error updating coupon expiry:", error);
    return { success: false, error: "Failed to update coupon expiry date." };
  }
}


export async function updateCouponBookingValidityAction(
  values: z.infer<typeof updateCouponBookingValiditySchema>
): Promise<{ success: boolean; error?: string }> {
    const validatedFields = updateCouponBookingValiditySchema.safeParse(values);

    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return { success: false, error: `Invalid input: ${errorMessages}` };
    }

    const { couponId, bookingValidFrom, bookingValidUntil } = validatedFields.data;

    try {
        const couponRef = doc(db, 'coupons', couponId);
        await updateDoc(couponRef, {
            bookingValidFrom: bookingValidFrom ? Timestamp.fromDate(bookingValidFrom) : null,
            bookingValidUntil: bookingValidUntil ? Timestamp.fromDate(bookingValidUntil) : null,
            updatedAt: serverTimestamp(),
        });
        revalidatePath('/admin/coupons');
        return { success: true };
    } catch (error) {
        console.error("[Action updateCouponBookingValidityAction] Error updating coupon booking validity:", error);
        return { success: false, error: "Failed to update coupon booking validity." };
    }
}

export async function updateCouponExclusionsAction(
  values: z.infer<typeof updateCouponExclusionsSchema>
): Promise<{ success: boolean; error?: string }> {
    const validatedFields = updateCouponExclusionsSchema.safeParse(values);

    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return { success: false, error: `Invalid input: ${errorMessages}` };
    }

    const { couponId, exclusionPeriods } = validatedFields.data;

    try {
        const couponRef = doc(db, 'coupons', couponId);
        await updateDoc(couponRef, {
            exclusionPeriods: exclusionPeriods.map(period => ({
                start: Timestamp.fromDate(period.start),
                end: Timestamp.fromDate(period.end),
            })),
            updatedAt: serverTimestamp(),
        });
        revalidatePath('/admin/coupons');
        return { success: true };
    } catch (error) {
        console.error("[Action updateCouponExclusionsAction] Error updating coupon exclusion periods:", error);
        return { success: false, error: "Failed to update coupon exclusion periods." };
    }
}
