// src/app/admin/properties/actions.ts
"use server";

import { z } from "zod";
import { collection, doc, addDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Property, SerializableTimestamp } from "@/types";
import { revalidatePath } from "next/cache";
import { sanitizeText } from "@/lib/sanitize"; // Assuming sanitizer

// Schema for Property (adjust based on your final Property type in types/index.ts)
// This schema should mirror the form validation schema but used for server-side action validation
// IMPORTANT: Keep this in sync with the form schema and Property type
const propertyActionSchema = z.object({
    name: z.string().min(3).transform(sanitizeText),
    slug: z.string().min(3).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), // Validate slug format
    description: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    shortDescription: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    templateId: z.string().min(1),
    themeId: z.string().optional(),
    location: z.object({
        address: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
        city: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
        state: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
        country: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
        zipCode: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
        coordinates: z.object({
            latitude: z.coerce.number().optional(),
            longitude: z.coerce.number().optional(),
        }).optional(),
    }),
    pricePerNight: z.coerce.number().positive(),
    baseCurrency: z.string(), // Add validation if using enum type
    cleaningFee: z.coerce.number().nonnegative().optional(),
    maxGuests: z.coerce.number().int().positive(),
    baseOccupancy: z.coerce.number().int().positive(),
    extraGuestFee: z.coerce.number().nonnegative().optional(),
    bedrooms: z.coerce.number().int().nonnegative().optional(),
    beds: z.coerce.number().int().nonnegative().optional(),
    bathrooms: z.coerce.number().int().nonnegative().optional(),
    squareFeet: z.coerce.number().nonnegative().optional(),
    checkInTime: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    checkOutTime: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    cancellationPolicy: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    status: z.enum(['active', 'inactive', 'draft']),
    ownerId: z.string().optional(), // Handle setting this appropriately
    customDomain: z.string().optional().nullable().transform(val => val ? sanitizeText(val) : null),
    useCustomDomain: z.boolean().optional(),
    analytics: z.object({
        enabled: z.boolean().optional(),
        googleAnalyticsId: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    }).optional(),
     holdFeeAmount: z.coerce.number().nonnegative().optional(),
     enableHoldOption: z.boolean().optional(),
     enableContactOption: z.boolean().optional(),
}).refine(data => data.maxGuests >= data.baseOccupancy, {
    message: "Max guests must be >= base occupancy.",
    path: ["maxGuests"],
});


// Helper to convert Firestore Timestamps for client components
const serializeTimestamp = (timestamp: SerializableTimestamp | undefined | null): string | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Timestamp) return timestamp.toDate().toISOString();
  if (timestamp instanceof Date) return timestamp.toISOString();
  if (typeof timestamp === 'string') return timestamp; // Assume already ISO string
  
  // Handle Firestore-like objects with _seconds and _nanoseconds
  if (typeof timestamp === 'object' && '_seconds' in timestamp && '_nanoseconds' in timestamp) {
    try {
      const seconds = Number(timestamp._seconds);
      const nanoseconds = Number(timestamp._nanoseconds);
      if (!isNaN(seconds) && !isNaN(nanoseconds)) {
        return new Date(seconds * 1000 + nanoseconds / 1000000).toISOString();
      }
    } catch (error) {
      console.error("Error converting Firestore timestamp object:", error);
      return null;
    }
  }
  
  // Last resort - try to convert as is
  try {
    return new Date(timestamp as any).toISOString();
  } catch (error) {
    console.error("Invalid timestamp format:", timestamp);
    return null;
  }
};

// Helper function to recursively serialize timestamps in an object
const serializeTimestampsInObject = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  // If it's an array, process each element
  if (Array.isArray(obj)) {
    return obj.map(item => serializeTimestampsInObject(item));
  }
  
  // If it's a timestamp-like object
  if ('_seconds' in obj && '_nanoseconds' in obj) {
    return serializeTimestamp(obj);
  }
  
  // Process each property of the object
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = serializeTimestampsInObject(value);
  }
  
  return result;
};

// Fetch all properties
export async function fetchProperties(): Promise<Property[]> {
  try {
    const propertiesCollection = collection(db, 'properties');
    const querySnapshot = await getDocs(propertiesCollection);
    const properties = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      // Recursively serialize all timestamps in the data
      const serializedData = serializeTimestampsInObject(data);
      return {
        id: doc.id,
        slug: doc.id, // Use doc ID as slug
        ...serializedData,
      } as Property;
    });
    return properties;
  } catch (error) {
    console.error("[Action fetchProperties] Error fetching properties:", error);
    return [];
  }
}


// Create a new property
export async function createPropertyAction(
  values: z.infer<typeof propertyActionSchema>
): Promise<{ slug?: string; name?: string; error?: string }> {
  const validatedFields = propertyActionSchema.safeParse(values);

  if (!validatedFields.success) {
    const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error("[Create Property Action] Validation Error:", errorMessages);
    return { error: `Invalid input: ${errorMessages}` };
  }

  const { slug, ...propertyData } = validatedFields.data;

  // Check if slug already exists
  try {
    const existingDocRef = doc(db, 'properties', slug);
    const docSnap = await getDoc(existingDocRef);
    if (docSnap.exists()) {
      return { error: `Property with slug "${slug}" already exists.` };
    }

    // Add ownerId if necessary (e.g., from logged-in user context - needs implementation)
    // propertyData.ownerId = 'current_user_id';

    const dataToSave = {
        ...propertyData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(existingDocRef, dataToSave); // Use setDoc with the slug as the ID

    console.log(`[Create Property Action] Property "${propertyData.name}" created successfully with slug: ${slug}`);
    revalidatePath('/admin/properties');
    revalidatePath(`/properties/${slug}`); // Revalidate public page
    return { slug: slug, name: propertyData.name };
  } catch (error) {
    console.error(`❌ [Create Property Action] Error creating property "${slug}":`, error);
    return { error: `Failed to create property: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Update an existing property
export async function updatePropertyAction(
  currentSlug: string, // The slug of the property to update
  values: z.infer<typeof propertyActionSchema>
): Promise<{ slug?: string; name?: string; error?: string }> {
   // Instead of omit, validate directly against propertyActionSchema
   // and ignore the slug field since we use the currentSlug
   const validatedFields = propertyActionSchema.safeParse(values);

   if (!validatedFields.success) {
     const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
     console.error("[Update Property Action] Validation Error:", errorMessages);
     return { error: `Invalid input: ${errorMessages}` };
   }

   const propertyData = validatedFields.data;

  try {
    const propertyRef = doc(db, 'properties', currentSlug);

    // Check if the document exists before updating
    const docSnap = await getDoc(propertyRef);
    if (!docSnap.exists()) {
      return { error: `Property with slug "${currentSlug}" not found.` };
    }

     // Prepare data for update (excluding slug)
     const { slug: _, ...dataWithoutSlug } = propertyData;
     const dataToUpdate = {
         ...dataWithoutSlug,
         updatedAt: serverTimestamp(),
     };

    await updateDoc(propertyRef, dataToUpdate);

    console.log(`[Update Property Action] Property "${propertyData.name}" (${currentSlug}) updated successfully.`);
    revalidatePath('/admin/properties');
    revalidatePath(`/properties/${currentSlug}`); // Revalidate public page
    revalidatePath(`/admin/properties/${currentSlug}/edit`); // Revalidate edit page
    return { slug: currentSlug, name: propertyData.name };

  } catch (error) {
    console.error(`❌ [Update Property Action] Error updating property "${currentSlug}":`, error);
    return { error: `Failed to update property: ${error instanceof Error ? error.message : String(error)}` };
  }
}


// Delete a property
export async function deletePropertyAction(
  slug: string
): Promise<{ success: boolean; error?: string }> {
  if (!slug) {
    return { success: false, error: "Property slug is required." };
  }

  try {
    const propertyRef = doc(db, 'properties', slug);
    const overridesRef = doc(db, 'propertyOverrides', slug); // Also target overrides

    // Check if the property exists
    const docSnap = await getDoc(propertyRef);
    if (!docSnap.exists()) {
        console.warn(`[Delete Property Action] Property "${slug}" not found, attempting to delete anyway.`);
        // Allow deletion attempt even if main doc is missing, to clean up overrides etc.
    }

    // TODO: Implement deletion of related data (bookings, availability, reviews, overrides, etc.)
    // This often requires a Cloud Function for reliable cascading deletes.
    // For now, we just delete the main property doc and overrides.

    await deleteDoc(propertyRef);
    await deleteDoc(overridesRef).catch(err => console.warn(`Could not delete overrides for ${slug}: ${err.message}`)); // Try to delete overrides, ignore if not found

    console.log(`[Delete Property Action] Property "${slug}" deleted successfully.`);
    revalidatePath('/admin/properties');
    revalidatePath(`/properties/${slug}`); // Invalidate deleted page path
    return { success: true };
  } catch (error) {
    console.error(`❌ [Delete Property Action] Error deleting property "${slug}":`, error);
    return { success: false, error: `Failed to delete property: ${error instanceof Error ? error.message : String(error)}` };
  }
}
