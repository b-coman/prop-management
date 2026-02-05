'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { format } from 'date-fns';
import { loggers } from '@/lib/logger';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { sanitizeText } from '@/lib/sanitize';
import { regenerateCalendarsAfterChange } from './server-actions-hybrid';

const logger = loggers.adminPricing;

// ============================================================================
// Zod Schemas
// ============================================================================

const seasonTypeEnum = z.enum(['minimum', 'low', 'standard', 'medium', 'high']);

// Base schema without refinement for extending
const baseSeasonSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  name: z.string().min(1, 'Name is required').max(100).transform(sanitizeText),
  seasonType: seasonTypeEnum,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  priceMultiplier: z.coerce.number().min(0.1, 'Multiplier must be at least 0.1').max(10, 'Multiplier cannot exceed 10'),
  minimumStay: z.coerce.number().int().min(1, 'Minimum stay must be at least 1').max(30),
});

const createSeasonSchema = baseSeasonSchema.refine(
  data => data.endDate >= data.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

const updateSeasonSchema = baseSeasonSchema.extend({
  id: z.string().min(1, 'Season ID is required'),
  enabled: z.coerce.boolean(),
}).refine(
  data => data.endDate >= data.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

const createDateOverrideSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  customPrice: z.coerce.number().nonnegative('Price must be non-negative'),
  reason: z.string().max(200).optional().transform(val => val ? sanitizeText(val) : ''),
  minimumStay: z.coerce.number().int().min(1).max(30).default(1),
  available: z.coerce.boolean().default(true),
  flatRate: z.coerce.boolean().default(false),
});

const updateDateOverrideSchema = createDateOverrideSchema.extend({
  id: z.string().min(1, 'Override ID is required'),
});

const deleteSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  propertyId: z.string().min(1, 'Property ID is required'),
});

// Helper to parse FormData into object
function formDataToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  formData.forEach((value, key) => {
    obj[key] = value.toString();
  });
  return obj;
}

/**
 * Create a new seasonal pricing rule
 * Requires access to the property
 */
export async function createSeasonalPricing(formData: FormData) {
  // Validate input with Zod
  const parsed = createSeasonSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    const errorMessages = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    logger.warn('Create seasonal pricing validation error', { errors: errorMessages });
    throw new Error(`Invalid input: ${errorMessages}`);
  }

  const { propertyId, name, seasonType, startDate, endDate, priceMultiplier, minimumStay } = parsed.data;

  // Check property access
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new Error(error.message);
    }
    throw error;
  }

  try {
    // Create the seasonal pricing object
    const seasonalPricing = {
      propertyId,
      name,
      seasonType,
      startDate,
      endDate,
      priceMultiplier,
      minimumStay,
      enabled: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // Add to Firestore
    const db = await getAdminDb();
    await db.collection('seasonalPricing').add(seasonalPricing);

    logger.info('Created seasonal pricing', { propertyId, name });

    // Regenerate calendars to reflect the new season
    await regenerateCalendarsAfterChange(propertyId);

    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    logger.error('Error creating seasonal pricing', error as Error, { propertyId });
    throw new Error(`Failed to create seasonal pricing: ${error}`);
  }

  // redirect() must be called outside try/catch — it throws NEXT_REDIRECT
  redirect(`/admin/pricing?propertyId=${propertyId}`);
}

/**
 * Update an existing seasonal pricing rule
 * Requires access to the property
 */
export async function updateSeasonalPricing(formData: FormData) {
  // Validate input with Zod
  const parsed = updateSeasonSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    const errorMessages = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    logger.warn('Update seasonal pricing validation error', { errors: errorMessages });
    throw new Error(`Invalid input: ${errorMessages}`);
  }

  const { id, propertyId, name, seasonType, startDate, endDate, priceMultiplier, minimumStay, enabled } = parsed.data;

  // Check property access
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new Error(error.message);
    }
    throw error;
  }

  try {
    // Create the update object
    const updatedSeason = {
      propertyId,
      name,
      seasonType,
      startDate,
      endDate,
      priceMultiplier,
      minimumStay,
      enabled,
      updatedAt: FieldValue.serverTimestamp()
    };

    // Update in Firestore
    const db = await getAdminDb();
    const seasonRef = db.collection('seasonalPricing').doc(id);
    await seasonRef.update(updatedSeason);

    logger.info('Updated seasonal pricing', { id, propertyId, name });

    // Regenerate calendars to reflect the updated season
    await regenerateCalendarsAfterChange(propertyId);

    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    logger.error('Error updating seasonal pricing', error as Error, { id, propertyId });
    throw new Error(`Failed to update seasonal pricing: ${error}`);
  }

  // redirect() must be called outside try/catch — it throws NEXT_REDIRECT
  redirect(`/admin/pricing?propertyId=${propertyId}`);
}

/**
 * Create a new date override
 * Requires access to the property
 */
export async function createDateOverride(formData: FormData) {
  // Validate input with Zod
  const parsed = createDateOverrideSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    const errorMessages = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    logger.warn('Create date override validation error', { errors: errorMessages });
    throw new Error(`Invalid input: ${errorMessages}`);
  }

  const { propertyId, date, customPrice, reason, minimumStay, available, flatRate } = parsed.data;

  // Check property access
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new Error(error.message);
    }
    throw error;
  }

  try {
    // Create the date override object
    const dateOverride = {
      propertyId,
      date,
      customPrice,
      reason,
      minimumStay,
      available,
      flatRate,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // Add to Firestore
    const db = await getAdminDb();
    await db.collection('dateOverrides').add(dateOverride);

    logger.info('Created date override', { propertyId, date });

    // Regenerate calendars to reflect the new override
    await regenerateCalendarsAfterChange(propertyId);

    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    logger.error('Error creating date override', error as Error, { propertyId, date });
    throw new Error(`Failed to create date override: ${error}`);
  }

  // redirect() must be called outside try/catch — it throws NEXT_REDIRECT
  redirect(`/admin/pricing?propertyId=${propertyId}`);
}

/**
 * Update an existing date override
 * Requires access to the property
 */
export async function updateDateOverride(formData: FormData) {
  // Validate input with Zod
  const parsed = updateDateOverrideSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    const errorMessages = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    logger.warn('Update date override validation error', { errors: errorMessages });
    throw new Error(`Invalid input: ${errorMessages}`);
  }

  const { id, propertyId, date, customPrice, reason, minimumStay, available, flatRate } = parsed.data;

  // Check property access
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new Error(error.message);
    }
    throw error;
  }

  try {
    // Create the update object
    const updatedOverride = {
      propertyId,
      date,
      customPrice,
      reason,
      minimumStay,
      available,
      flatRate,
      updatedAt: FieldValue.serverTimestamp()
    };

    // Update in Firestore
    const db = await getAdminDb();
    const overrideRef = db.collection('dateOverrides').doc(id);
    await overrideRef.update(updatedOverride);

    logger.info('Updated date override', { id, propertyId, date });

    // Regenerate calendars to reflect the updated override
    await regenerateCalendarsAfterChange(propertyId);

    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    logger.error('Error updating date override', error as Error, { id, propertyId });
    throw new Error(`Failed to update date override: ${error}`);
  }

  // redirect() must be called outside try/catch — it throws NEXT_REDIRECT
  redirect(`/admin/pricing?propertyId=${propertyId}`);
}

/**
 * Delete a seasonal pricing rule
 * Requires access to the property
 */
export async function deleteSeasonalPricing(formData: FormData) {
  // Validate input with Zod
  const parsed = deleteSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    const errorMessages = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    logger.warn('Delete seasonal pricing validation error', { errors: errorMessages });
    throw new Error(`Invalid input: ${errorMessages}`);
  }

  const { id, propertyId } = parsed.data;

  // Check property access
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new Error(error.message);
    }
    throw error;
  }

  try {
    // Delete from Firestore
    const db = await getAdminDb();
    const seasonRef = db.collection('seasonalPricing').doc(id);
    await seasonRef.delete();

    logger.info('Deleted seasonal pricing', { id, propertyId });

    // Regenerate calendars to remove the deleted season's pricing
    await regenerateCalendarsAfterChange(propertyId);

    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    logger.error('Error deleting seasonal pricing', error as Error, { id, propertyId });
    throw new Error(`Failed to delete seasonal pricing: ${error}`);
  }

  // redirect() must be called outside try/catch — it throws NEXT_REDIRECT
  redirect(`/admin/pricing?propertyId=${propertyId}`);
}

/**
 * Delete a date override
 * Requires access to the property
 */
export async function deleteDateOverride(formData: FormData) {
  // Validate input with Zod
  const parsed = deleteSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    const errorMessages = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    logger.warn('Delete date override validation error', { errors: errorMessages });
    throw new Error(`Invalid input: ${errorMessages}`);
  }

  const { id, propertyId } = parsed.data;

  // Check property access
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new Error(error.message);
    }
    throw error;
  }

  try {
    // Delete from Firestore
    const db = await getAdminDb();
    const overrideRef = db.collection('dateOverrides').doc(id);
    await overrideRef.delete();

    logger.info('Deleted date override', { id, propertyId });

    // Regenerate calendars to remove the deleted override's pricing
    await regenerateCalendarsAfterChange(propertyId);

    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    logger.error('Error deleting date override', error as Error, { id, propertyId });
    throw new Error(`Failed to delete date override: ${error}`);
  }

  // redirect() must be called outside try/catch — it throws NEXT_REDIRECT
  redirect(`/admin/pricing?propertyId=${propertyId}`);
}