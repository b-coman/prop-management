"use server";

import { z } from "zod";
import { collection, addDoc, serverTimestamp, Timestamp, doc, updateDoc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Use Client SDK
import type { Coupon } from "@/types";
import { revalidatePath } from 'next/cache'; // Import revalidatePath

// Define the Zod schema for input validation (mirrors the form schema)
const createCouponSchema = z.object({
  code: z.string().min(3).max(50).transform(val => val.toUpperCase()),
  discount: z.coerce.number().min(1).max(100),
  validUntil: z.date(),
  isActive: z.boolean().default(true),
  description: z.string().max(100).optional(),
});

// --- Server action to create a coupon ---
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
    // Keep Timestamps for Firestore write
    const couponDataForDb: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'validUntil'> & { validUntil: Timestamp, createdAt: any } = {
      code: code,
      discount: discount,
      validUntil: Timestamp.fromDate(validUntil), // Convert Date to Firestore Timestamp
      isActive: isActive,
      description: description || "", // Ensure description is not undefined
      createdAt: serverTimestamp(), // Add createdAt server timestamp
    };

    // Add the document to Firestore
    const docRef = await addDoc(couponsCollection, couponDataForDb);

    console.log(`[Create Coupon Action] Coupon "${code}" created successfully with ID: ${docRef.id}`);
    revalidatePath('/admin/coupons'); // Revalidate the coupon list page
    return { id: docRef.id, code: code };

  } catch (error) {
    console.error(`❌ [Create Coupon Action] Error creating coupon "${code}":`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Check for permission denied error specifically
    if (errorMessage.includes('PERMISSION_DENIED')) {
      return { error: 'Permission denied. Ensure you are logged in with admin privileges.' };
    }
    return { error: `Failed to create coupon: ${errorMessage}` };
  }
}


// --- Server action to update coupon status ---
const updateCouponStatusSchema = z.object({
  couponId: z.string().min(1, "Coupon ID is required."),
  isActive: z.boolean(),
});

export async function updateCouponStatusAction(
  values: z.infer<typeof updateCouponStatusSchema>
): Promise<{ success: boolean; error?: string }> {
    const validatedFields = updateCouponStatusSchema.safeParse(values);
    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        console.error("[Update Coupon Status Action] Validation Error:", errorMessages);
        return { success: false, error: `Invalid input: ${errorMessages}` };
    }

    const { couponId, isActive } = validatedFields.data;

    try {
        const couponRef = doc(db, 'coupons', couponId);
        await updateDoc(couponRef, {
            isActive: isActive,
            updatedAt: serverTimestamp() // Update timestamp
        });
        console.log(`[Update Coupon Status Action] Coupon ${couponId} status updated to ${isActive}.`);
        revalidatePath('/admin/coupons'); // Revalidate the list page
        return { success: true };
    } catch (error) {
        console.error(`❌ [Update Coupon Status Action] Error updating status for coupon ${couponId}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('PERMISSION_DENIED')) {
             return { success: false, error: 'Permission denied. Ensure you are logged in with admin privileges.' };
        }
        return { success: false, error: `Failed to update coupon status: ${errorMessage}` };
    }
}


// --- Server action to update coupon expiry date ---
const updateCouponExpirySchema = z.object({
  couponId: z.string().min(1, "Coupon ID is required."),
  validUntil: z.date(),
});

export async function updateCouponExpiryAction(
  values: z.infer<typeof updateCouponExpirySchema>
): Promise<{ success: boolean; error?: string }> {
     const validatedFields = updateCouponExpirySchema.safeParse(values);
    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        console.error("[Update Coupon Expiry Action] Validation Error:", errorMessages);
        return { success: false, error: `Invalid input: ${errorMessages}` };
    }
    const { couponId, validUntil } = validatedFields.data;

    try {
        const couponRef = doc(db, 'coupons', couponId);
        await updateDoc(couponRef, {
            validUntil: Timestamp.fromDate(validUntil), // Convert Date to Firestore Timestamp
            updatedAt: serverTimestamp() // Update timestamp
        });
        console.log(`[Update Coupon Expiry Action] Coupon ${couponId} expiry updated to ${validUntil.toISOString()}.`);
        revalidatePath('/admin/coupons'); // Revalidate the list page
        return { success: true };
    } catch (error) {
        console.error(`❌ [Update Coupon Expiry Action] Error updating expiry for coupon ${couponId}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
         if (errorMessage.includes('PERMISSION_DENIED')) {
             return { success: false, error: 'Permission denied. Ensure you are logged in with admin privileges.' };
         }
        return { success: false, error: `Failed to update coupon expiry: ${errorMessage}` };
    }
}


// --- Function to fetch coupons (can be called by the page component) ---
// Convert Firestore Timestamps to a serializable format (e.g., ISO string or number)
// before returning them, because Timestamp objects cannot be directly passed
// from Server Components to Client Components.
export async function fetchCoupons(): Promise<Coupon[]> {
  try {
    const couponsCollection = collection(db, 'coupons');
    // Order by creation date descending by default
    const q = query(couponsCollection, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const coupons = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        // Helper to safely convert Timestamp to ISO string
        const toSerializableDate = (timestamp: any): string | null => {
            if (timestamp instanceof Timestamp) {
                return timestamp.toDate().toISOString();
            }
            // Handle potential serverTimestamp placeholders if data is read immediately after write
            // Or handle if it's already serialized somehow (less likely here)
            if (timestamp && typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
                 return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000).toISOString();
            }
            return null; // Or return undefined, depending on how you want to handle missing/invalid dates
        };

        return {
          id: doc.id,
          code: data.code,
          discount: data.discount,
          isActive: data.isActive,
          description: data.description,
          // Convert Timestamps to ISO strings for serialization
          validUntil: toSerializableDate(data.validUntil),
          createdAt: toSerializableDate(data.createdAt),
          updatedAt: toSerializableDate(data.updatedAt),
        };
      // Assert the final type after mapping and serialization
    }) as Coupon[];

    return coupons;

  } catch (error) {
    console.error("❌ Error fetching coupons:", error);
    // Handle error appropriately, maybe return an empty array or throw
    return [];
  }
}