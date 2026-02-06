// src/app/admin/properties/actions.ts
"use server";

import { z } from "zod";
import { getAdminDb, Timestamp, FieldValue } from "@/lib/firebaseAdminSafe";
import type { Property, SerializableTimestamp } from "@/types";
import { revalidatePath } from "next/cache";
import { sanitizeText } from "@/lib/sanitize";
import { loggers } from '@/lib/logger';
import {
  requireAdmin,
  requireSuperAdmin,
  requirePropertyAccess,
  filterPropertiesForUser,
  handleAuthError,
  AuthorizationError
} from '@/lib/authorization';

const logger = loggers.admin;

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
    baseCurrency: z.string(),
    cleaningFee: z.coerce.number().nonnegative().optional(),
    maxGuests: z.coerce.number().int().positive(),
    baseOccupancy: z.coerce.number().int().positive(),
    extraGuestFee: z.coerce.number().nonnegative().optional(),
    bedrooms: z.coerce.number().int().nonnegative().optional(),
    beds: z.coerce.number().int().nonnegative().optional(),
    bathrooms: z.coerce.number().int().nonnegative().optional(),
    squareFeet: z.coerce.number().nonnegative().optional(),
    propertyType: z.enum(['entire_place', 'chalet', 'cabin', 'villa', 'apartment', 'house', 'cottage', 'studio', 'bungalow']).optional(),
    bedConfiguration: z.array(z.object({
      roomName: z.string().min(1).transform(sanitizeText),
      beds: z.array(z.object({
        type: z.enum(['king', 'queen', 'double', 'single', 'sofa_bed', 'bunk', 'crib']),
        count: z.coerce.number().int().positive(),
      })).min(1),
    })).optional(),
    checkInTime: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    checkOutTime: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    cancellationPolicy: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    status: z.enum(['active', 'inactive', 'draft']),
    ownerId: z.string().optional(),
    ownerEmail: z.string().email().optional().or(z.literal('')).transform(val => val || null),
    contactPhone: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    contactEmail: z.string().email().optional().or(z.literal('')).nullable().transform(val => val || null),
    customDomain: z.string().optional().nullable().transform(val => val ? sanitizeText(val) : null),
    useCustomDomain: z.boolean().optional(),
    analytics: z.object({
        enabled: z.boolean().optional(),
        googleAnalyticsId: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    }).optional(),
     googlePlaceId: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
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
  if (typeof timestamp === 'string') return timestamp;

  // Handle Firestore-like objects with _seconds and _nanoseconds
  if (typeof timestamp === 'object' && '_seconds' in timestamp && '_nanoseconds' in timestamp) {
    try {
      const seconds = Number(timestamp._seconds);
      const nanoseconds = Number(timestamp._nanoseconds);
      if (!isNaN(seconds) && !isNaN(nanoseconds)) {
        return new Date(seconds * 1000 + nanoseconds / 1000000).toISOString();
      }
    } catch (error) {
      logger.error('Error converting Firestore timestamp object', error as Error);
      return null;
    }
  }

  // Last resort - try to convert as is
  try {
    return new Date(timestamp as any).toISOString();
  } catch (error) {
    logger.error('Invalid timestamp format', error as Error, { timestamp });
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

/**
 * Fetch all properties
 * Filters results based on user's property access
 */
export async function fetchProperties(): Promise<Property[]> {
  try {
    // Check authorization first
    const user = await requireAdmin();

    const db = await getAdminDb();
    const propertiesSnapshot = await db.collection('properties').get();
    const allProperties: Property[] = [];

    propertiesSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const serializedData = serializeTimestampsInObject(data);
      allProperties.push({
        id: docSnap.id,
        slug: docSnap.id,
        ...serializedData,
      } as Property);
    });

    // Filter based on user access
    const filteredProperties = filterPropertiesForUser(allProperties, user);
    logger.debug('Properties fetched', { count: filteredProperties.length, total: allProperties.length, role: user.role });
    return filteredProperties;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchProperties');
      return [];
    }
    logger.error('Error fetching properties', error as Error);
    return [];
  }
}


/**
 * Create a new property
 * Only super admins can create properties
 */
export async function createPropertyAction(
  values: z.infer<typeof propertyActionSchema>
): Promise<{ slug?: string; name?: string; error?: string }> {
  try {
    // Only super admins can create properties
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return handleAuthError(error) as { error: string };
    }
    throw error;
  }

  const validatedFields = propertyActionSchema.safeParse(values);

  if (!validatedFields.success) {
    const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    logger.warn('Create property validation error', { errors: errorMessages });
    return { error: `Invalid input: ${errorMessages}` };
  }

  const { slug, ...propertyData } = validatedFields.data;

  try {
    const db = await getAdminDb();
    const propertyRef = db.collection('properties').doc(slug);
    const docSnap = await propertyRef.get();

    if (docSnap.exists) {
      return { error: `Property with slug "${slug}" already exists.` };
    }

    const dataToSave = {
        ...propertyData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };

    await propertyRef.set(dataToSave);

    logger.info('Property created successfully', { name: propertyData.name, slug });
    revalidatePath('/admin/properties');
    revalidatePath(`/properties/${slug}`);
    return { slug: slug, name: propertyData.name };
  } catch (error) {
    logger.error('Error creating property', error as Error, { slug });
    return { error: `Failed to create property: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Update an existing property
 * Users can only update properties they have access to
 */
export async function updatePropertyAction(
  currentSlug: string,
  values: z.infer<typeof propertyActionSchema>
): Promise<{ slug?: string; name?: string; error?: string }> {
  try {
    // Check access to this specific property
    await requirePropertyAccess(currentSlug);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return handleAuthError(error) as { error: string };
    }
    throw error;
  }

  const validatedFields = propertyActionSchema.safeParse(values);

  if (!validatedFields.success) {
    const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    logger.warn('Update property validation error', { errors: errorMessages, slug: currentSlug });
    return { error: `Invalid input: ${errorMessages}` };
  }

  const propertyData = validatedFields.data;

  try {
    const db = await getAdminDb();
    const propertyRef = db.collection('properties').doc(currentSlug);

    // Check if the document exists before updating
    const docSnap = await propertyRef.get();
    if (!docSnap.exists) {
      return { error: `Property with slug "${currentSlug}" not found.` };
    }

    // Prepare data for update (excluding slug)
    const { slug: _, ...dataWithoutSlug } = propertyData;
    const dataToUpdate = {
        ...dataWithoutSlug,
        updatedAt: FieldValue.serverTimestamp(),
    };

    await propertyRef.update(dataToUpdate);

    logger.info('Property updated successfully', { name: propertyData.name, slug: currentSlug });
    revalidatePath('/admin/properties');
    revalidatePath(`/properties/${currentSlug}`);
    revalidatePath(`/admin/properties/${currentSlug}/edit`);
    return { slug: currentSlug, name: propertyData.name };

  } catch (error) {
    logger.error('Error updating property', error as Error, { slug: currentSlug });
    return { error: `Failed to update property: ${error instanceof Error ? error.message : String(error)}` };
  }
}


/**
 * Delete a property
 * Only super admins can delete properties
 */
export async function deletePropertyAction(
  slug: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Only super admins can delete properties
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return handleAuthError(error);
    }
    throw error;
  }

  if (!slug) {
    return { success: false, error: "Property slug is required." };
  }

  try {
    const db = await getAdminDb();
    const propertyRef = db.collection('properties').doc(slug);
    const overridesRef = db.collection('propertyOverrides').doc(slug);

    // Check if the property exists
    const docSnap = await propertyRef.get();
    if (!docSnap.exists) {
        logger.warn('Property not found, attempting to delete anyway', { slug });
    }

    // TODO: Implement deletion of related data (bookings, availability, reviews, overrides, etc.)
    // This often requires a Cloud Function for reliable cascading deletes.
    // For now, we just delete the main property doc and overrides.

    await propertyRef.delete();
    await overridesRef.delete().catch(err => logger.warn('Could not delete overrides', { slug, error: err.message }));

    logger.info('Property deleted successfully', { slug });
    revalidatePath('/admin/properties');
    revalidatePath(`/properties/${slug}`);
    return { success: true };
  } catch (error) {
    logger.error('Error deleting property', error as Error, { slug });
    return { success: false, error: `Failed to delete property: ${error instanceof Error ? error.message : String(error)}` };
  }
}
