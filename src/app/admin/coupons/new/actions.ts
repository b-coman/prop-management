
"use server";

import { z } from "zod";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Use Client SDK
import type { Coupon } from "@/types";

// Define the Zod schema for input validation (mirrors the form schema)
const createCouponSchema = z.object({
  code: z.string().min(3).max(50).transform(val => val.toUpperCase()),
  discount: z.coerce.number().min(1).max(100),
  validUntil: z.date(),
  isActive: z.boolean().default(true),
  description: z.string().max(100).optional(),
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

  const { code, discount, validUntil, isActive, description } = validatedFields.data;

  try {
    const couponsCollection = collection(db, 'coupons');

    // Prepare data for Firestore
    const couponData: Omit<Coupon, 'id'> = {
      code: code,
      discount: discount,
      validUntil: Timestamp.fromDate(validUntil), // Convert Date to Firestore Timestamp
      isActive: isActive,
      description: description || "", // Ensure description is not undefined
      createdAt: serverTimestamp(), // Add createdAt timestamp
      // Add usage limits if needed in the future
      // maxUses: null,
      // currentUses: 0,
    };

    // Add the document to Firestore
    const docRef = await addDoc(couponsCollection, couponData);

    console.log(`[Create Coupon Action] Coupon "${code}" created successfully with ID: ${docRef.id}`);
    return { id: docRef.id, code: code };

  } catch (error) {
    console.error(`❌ [Create Coupon Action] Error creating coupon "${code}":`, error);
    return { error: `Failed to create coupon: ${error instanceof Error ? error.message : String(error)}` };
  }
}
