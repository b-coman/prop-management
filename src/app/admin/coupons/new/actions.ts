
"use server";

import { z } from "zod";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Use Client SDK
import type { Coupon } from "@/types";
import { revalidatePath } from "next/cache";

// Define Zod schema for input validation (mirrors the form schema)
// including new optional fields and refining date logic
const exclusionPeriodSchema = z.object({
  start: z.date(),
  end: z.date(),
}).refine(data => data.end > data.start, {
  message: "Exclusion end date must be after start date.",
  path: ["end"],
});

const createCouponSchema = z.object({
  code: z.string().min(3).max(50).transform(val => val.toUpperCase()),
  discount: z.coerce.number().min(1).max(100),
  validUntil: z.date(), // Coupon expiry date
  isActive: z.boolean().default(true),
  description: z.string().max(100).optional(),
  // Optional booking validity dates (can be null)
  bookingValidFrom: z.date().nullable().optional(),
  bookingValidUntil: z.date().nullable().optional(),
  // Optional array of exclusion periods
  exclusionPeriods: z.array(exclusionPeriodSchema).optional(),
})
.refine(data => {
    // Booking end date must be after start date if both are provided
    if (data.bookingValidFrom && data.bookingValidUntil) {
        return data.bookingValidUntil > data.bookingValidFrom;
    }
    return true;
}, {
    message: "Booking validity end date must be after start date.",
    path: ["bookingValidUntil"],
})
.refine(data => {
    // Coupon expiry must be on or after booking validity end date if set
    if (data.validUntil && data.bookingValidUntil) {
        // Compare dates only, ignore time if needed, or use startOfDay
        return data.validUntil >= data.bookingValidUntil;
    }
    return true;
}, {
    message: "Coupon expiry date must be on or after the booking validity end date.",
    path: ["validUntil"],
});

// Server action to create a coupon
export async function createCouponAction(
  values: z.infer<typeof createCouponSchema>
): Promise<{ id?: string; code?: string; error?: string }> {
  // Validate input using Zod
  const validatedFields = createCouponSchema.safeParse(values);

  if (!validatedFields.success) {
    const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error("[Create Coupon Action] Validation Error:", errorMessages);
    return { error: `Invalid input: ${errorMessages}` };
  }

  const {
      code,
      discount,
      validUntil,
      isActive,
      description,
      bookingValidFrom,
      bookingValidUntil,
      exclusionPeriods
   } = validatedFields.data;

  try {
    const couponsCollection = collection(db, 'coupons');

    // Prepare data for Firestore, converting Dates to Timestamps or null
    const couponData: Omit<Coupon, 'id'> = {
      code: code,
      discount: discount,
      validUntil: Timestamp.fromDate(validUntil), // Convert Date to Firestore Timestamp
      isActive: isActive,
      description: description || "",
      createdAt: serverTimestamp(), // Use server timestamp for creation
      updatedAt: serverTimestamp(), // Also set updatedAt on creation

      // Handle optional dates - convert to Timestamp or store as null
      bookingValidFrom: bookingValidFrom ? Timestamp.fromDate(bookingValidFrom) : null,
      bookingValidUntil: bookingValidUntil ? Timestamp.fromDate(bookingValidUntil) : null,

      // Handle exclusion periods - convert dates to Timestamps
      exclusionPeriods: exclusionPeriods ? exclusionPeriods.map(period => ({
        start: Timestamp.fromDate(period.start),
        end: Timestamp.fromDate(period.end),
      })) : null, // Store as null if empty/not provided

      // Add usage limits if needed in the future
      // maxUses: null,
      // currentUses: 0,
    };

    // Add the document to Firestore
    const docRef = await addDoc(couponsCollection, couponData);

    console.log(`[Create Coupon Action] Coupon "${code}" created successfully with ID: ${docRef.id}`);
    revalidatePath('/admin/coupons'); // Revalidate the coupon list page
    return { id: docRef.id, code: code };

  } catch (error) {
    console.error(`❌ [Create Coupon Action] Error creating coupon "${code}":`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('PERMISSION_DENIED')) {
      return { error: 'Permission denied. Ensure you are logged in with admin privileges.' };
    }
    return { error: `Failed to create coupon: ${errorMessage}` };
  }
}
