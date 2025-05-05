
"use server";

import { z } from "zod";
import { collection, addDoc, serverTimestamp, Timestamp, doc, updateDoc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Use Client SDK
import type { Coupon, SerializableTimestamp } from "@/types"; // Import SerializableTimestamp
import { revalidatePath } from 'next/cache'; // Import revalidatePath

// Define the Zod schema for input validation (mirrors the form schema)
// Including new optional fields and refining date logic
const exclusionPeriodSchema = z.object({
  start: z.date(),
  end: z.date(),
}).refine(data => data.end >= data.start, { // Allow same day
  message: "Exclusion end date must be on or after start date.",
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
    // Booking end date must be on or after start date if both are provided
    if (data.bookingValidFrom && data.bookingValidUntil) {
        return data.bookingValidUntil >= data.bookingValidFrom; // Allow same day
    }
    return true;
}, {
    message: "Booking validity end date must be on or after start date.",
    path: ["bookingValidUntil"],
})
.refine(data => {
    // Coupon expiry must be on or after booking validity end date if set
    if (data.validUntil && data.bookingValidUntil) {
        // Compare dates only, ignore time if needed, or use startOfDay
        return data.validUntil >= data.bookingValidUntil; // Allow same day
    }
    return true;
}, {
    message: "Coupon expiry date must be on or after the booking validity end date.",
    path: ["validUntil"],
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
    // Explicitly type the data being sent to Firestore for clarity
    // Note: We let Firestore auto-generate the ID here
    const couponDataForDb: Omit<Coupon, 'id'> = {
      code: code,
      discount: discount,
      validUntil: Timestamp.fromDate(validUntil), // Convert Date to Firestore Timestamp
      isActive: isActive,
      description: description || "",
      createdAt: serverTimestamp(), // Use server timestamp for creation
      updatedAt: serverTimestamp(), // Also set updatedAt on creation
      bookingValidFrom: bookingValidFrom ? Timestamp.fromDate(bookingValidFrom) : null,
      bookingValidUntil: bookingValidUntil ? Timestamp.fromDate(bookingValidUntil) : null,
      exclusionPeriods: exclusionPeriods ? exclusionPeriods.map(period => ({
        start: Timestamp.fromDate(period.start),
        end: Timestamp.fromDate(period.end),
      })) : [], // Store as empty array if not provided or empty
      // Explicitly set propertyId to null or handle if coupons are property-specific
      propertyId: null, // Assuming general coupons, adjust if needed
    };

    // Add the document to Firestore (auto-generated ID)
    const docRef = await addDoc(couponsCollection, couponDataForDb);

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


// --- Server action to update coupon status ---
const updateCouponStatusSchema = z.object({
  couponId: z.string().min(1, "Coupon ID is required."), // Use Firestore document ID
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
        const couponRef = doc(db, 'coupons', couponId); // Use couponId (doc ID)
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
  couponId: z.string().min(1, "Coupon ID is required."), // Use Firestore document ID
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
        const couponRef = doc(db, 'coupons', couponId); // Use couponId (doc ID)
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

// --- Server action to update booking validity dates ---
const updateCouponBookingValiditySchema = z.object({
    couponId: z.string().min(1, "Coupon ID is required."), // Use Firestore document ID
    bookingValidFrom: z.date().nullable(),
    bookingValidUntil: z.date().nullable(),
}).refine(data => {
    if (data.bookingValidFrom && data.bookingValidUntil) {
        return data.bookingValidUntil >= data.bookingValidFrom; // Allow same day
    }
    return true;
}, {
    message: "Booking validity end date must be on or after start date.",
    path: ["bookingValidUntil"],
});

export async function updateCouponBookingValidityAction(
  values: z.infer<typeof updateCouponBookingValiditySchema>
): Promise<{ success: boolean; error?: string }> {
    const validatedFields = updateCouponBookingValiditySchema.safeParse(values);
    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        console.error("[Update Coupon Booking Validity Action] Validation Error:", errorMessages);
        return { success: false, error: `Invalid input: ${errorMessages}` };
    }
    const { couponId, bookingValidFrom, bookingValidUntil } = validatedFields.data;

    try {
        const couponRef = doc(db, 'coupons', couponId); // Use couponId (doc ID)
        await updateDoc(couponRef, {
            bookingValidFrom: bookingValidFrom ? Timestamp.fromDate(bookingValidFrom) : null,
            bookingValidUntil: bookingValidUntil ? Timestamp.fromDate(bookingValidUntil) : null,
            updatedAt: serverTimestamp() // Update timestamp
        });
        console.log(`[Update Coupon Booking Validity Action] Coupon ${couponId} booking validity updated.`);
        revalidatePath('/admin/coupons'); // Revalidate the list page
        return { success: true };
    } catch (error) {
        console.error(`❌ [Update Coupon Booking Validity Action] Error updating booking validity for coupon ${couponId}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
         if (errorMessage.includes('PERMISSION_DENIED')) {
             return { success: false, error: 'Permission denied. Ensure you are logged in with admin privileges.' };
         }
        return { success: false, error: `Failed to update coupon booking validity: ${errorMessage}` };
    }
}

// --- Server action to update coupon exclusion periods ---
const updateCouponExclusionsSchema = z.object({
    couponId: z.string().min(1, "Coupon ID is required."), // Use Firestore document ID
    exclusionPeriods: z.array(exclusionPeriodSchema).optional(), // Allow empty array
});

export async function updateCouponExclusionsAction(
  values: z.infer<typeof updateCouponExclusionsSchema>
): Promise<{ success: boolean; error?: string }> {
     const validatedFields = updateCouponExclusionsSchema.safeParse(values);
    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        console.error("[Update Coupon Exclusions Action] Validation Error:", errorMessages);
        return { success: false, error: `Invalid input: ${errorMessages}` };
    }
    const { couponId, exclusionPeriods } = validatedFields.data;

    try {
        const couponRef = doc(db, 'coupons', couponId); // Use couponId (doc ID)
        const formattedExclusions = exclusionPeriods ? exclusionPeriods.map(p => ({
            start: Timestamp.fromDate(p.start),
            end: Timestamp.fromDate(p.end)
        })) : []; // Ensure it's an empty array if null/undefined

        await updateDoc(couponRef, {
            exclusionPeriods: formattedExclusions,
            updatedAt: serverTimestamp() // Update timestamp
        });
        console.log(`[Update Coupon Exclusions Action] Coupon ${couponId} exclusion periods updated.`);
        revalidatePath('/admin/coupons'); // Revalidate the list page
        return { success: true };
    } catch (error) {
        console.error(`❌ [Update Coupon Exclusions Action] Error updating exclusions for coupon ${couponId}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
         if (errorMessage.includes('PERMISSION_DENIED')) {
             return { success: false, error: 'Permission denied. Ensure you are logged in with admin privileges.' };
         }
        return { success: false, error: `Failed to update coupon exclusions: ${errorMessage}` };
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
             if (timestamp && typeof timestamp.toDate === 'function') { // Handle if it's already a Date object passed wrongly
                return timestamp.toDate().toISOString();
            }
            return null; // Or return undefined, depending on how you want to handle missing/invalid dates
        };

         // Helper to serialize exclusion periods
         const serializeExclusionPeriods = (periods: any): Array<{ start: string | null; end: string | null }> | null => {
             if (!Array.isArray(periods)) {
                 return null; // Or return [] depending on preference
             }
             return periods.map(period => ({
                 start: toSerializableDate(period.start),
                 end: toSerializableDate(period.end),
             }));
         };


        return {
          id: doc.id, // Use Firestore document ID
          code: data.code,
          discount: data.discount,
          isActive: data.isActive,
          description: data.description,
          propertyId: data.propertyId ?? null, // Handle optional propertyId (slug)
          // Convert Timestamps to ISO strings for serialization
          validUntil: toSerializableDate(data.validUntil),
          createdAt: toSerializableDate(data.createdAt),
          updatedAt: toSerializableDate(data.updatedAt),
          bookingValidFrom: toSerializableDate(data.bookingValidFrom), // Serialize booking dates
          bookingValidUntil: toSerializableDate(data.bookingValidUntil),
          exclusionPeriods: serializeExclusionPeriods(data.exclusionPeriods), // Serialize exclusions
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
