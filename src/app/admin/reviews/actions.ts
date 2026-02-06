// src/app/admin/reviews/actions.ts
"use server";

import { z } from "zod";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdminSafe";
import type { Review, ReviewSource } from "@/types";
import { revalidatePath } from "next/cache";
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { loggers } from '@/lib/logger';
import {
  requireAdmin,
  requirePropertyAccess,
  handleAuthError,
  AuthorizationError,
} from '@/lib/authorization';
import { batchCreateReviews, recalculatePropertyRatings } from '@/services/reviewService';
import { sanitizeText } from '@/lib/sanitize';
import { fetchGoogleReviews } from '@/lib/google-places-reviews';

const logger = loggers.adminReviews;

/**
 * Fetch all reviews, filtered by user property access.
 */
export async function fetchReviews(): Promise<Review[]> {
  try {
    const user = await requireAdmin();
    const db = await getAdminDb();
    const snapshot = await db.collection('reviews').orderBy('date', 'desc').get();

    const allReviews: Review[] = snapshot.docs.map((doc) =>
      convertTimestampsToISOStrings({ id: doc.id, ...doc.data() }) as Review
    );

    // Filter by property access (reuse the generic filter pattern)
    if (user.role === 'super_admin') {
      return allReviews;
    }
    return allReviews.filter(r => user.managedProperties.includes(r.propertyId));
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchReviews');
      return [];
    }
    logger.error('Error fetching reviews', error as Error);
    return [];
  }
}

const togglePublishSchema = z.object({
  reviewId: z.string().min(1),
  isPublished: z.boolean(),
});

/**
 * Toggle publish/unpublish a review.
 */
export async function togglePublishReview(
  values: z.infer<typeof togglePublishSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }

  const parsed = togglePublishSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' };
  }

  const { reviewId, isPublished } = parsed.data;

  try {
    const db = await getAdminDb();
    const docRef = db.collection('reviews').doc(reviewId);
    const existing = await docRef.get();

    if (!existing.exists) {
      return { success: false, error: 'Review not found.' };
    }

    const data = existing.data()!;
    await requirePropertyAccess(data.propertyId);

    await docRef.update({
      isPublished,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await recalculatePropertyRatings(data.propertyId);
    revalidatePath('/admin/reviews');
    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    logger.error('Error toggling review publish', error as Error, { reviewId });
    return { success: false, error: 'Failed to update review.' };
  }
}

/**
 * Delete a review.
 */
export async function deleteReviewAction(
  reviewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }

  try {
    const db = await getAdminDb();
    const docRef = db.collection('reviews').doc(reviewId);
    const existing = await docRef.get();

    if (!existing.exists) {
      return { success: false, error: 'Review not found.' };
    }

    const data = existing.data()!;
    await requirePropertyAccess(data.propertyId);

    await docRef.delete();

    if (data.isPublished) {
      await recalculatePropertyRatings(data.propertyId);
    }

    revalidatePath('/admin/reviews');
    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    logger.error('Error deleting review', error as Error, { reviewId });
    return { success: false, error: 'Failed to delete review.' };
  }
}

const ownerResponseSchema = z.object({
  reviewId: z.string().min(1),
  comment: z.string().min(1, 'Response cannot be empty.').max(2000),
});

/**
 * Set owner response on a review.
 */
export async function setOwnerResponseAction(
  values: z.infer<typeof ownerResponseSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }

  const parsed = ownerResponseSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || 'Invalid input.' };
  }

  const { reviewId, comment } = parsed.data;

  try {
    const db = await getAdminDb();
    const docRef = db.collection('reviews').doc(reviewId);
    const existing = await docRef.get();

    if (!existing.exists) {
      return { success: false, error: 'Review not found.' };
    }

    await requirePropertyAccess(existing.data()!.propertyId);

    await docRef.update({
      ownerResponse: {
        comment,
        date: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath('/admin/reviews');
    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    logger.error('Error setting owner response', error as Error, { reviewId });
    return { success: false, error: 'Failed to set response.' };
  }
}

/**
 * Remove owner response from a review.
 */
export async function removeOwnerResponseAction(
  reviewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }

  try {
    const db = await getAdminDb();
    const docRef = db.collection('reviews').doc(reviewId);
    const existing = await docRef.get();

    if (!existing.exists) {
      return { success: false, error: 'Review not found.' };
    }

    await requirePropertyAccess(existing.data()!.propertyId);

    await docRef.update({
      ownerResponse: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath('/admin/reviews');
    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    logger.error('Error removing owner response', error as Error, { reviewId });
    return { success: false, error: 'Failed to remove response.' };
  }
}

// --- Bulk Actions ---

const bulkIdsSchema = z.array(z.string().min(1)).min(1).max(50);

interface BulkActionResult {
  success: boolean;
  successCount: number;
  failCount: number;
}

export async function bulkPublishReviews(reviewIds: string[]): Promise<BulkActionResult> {
  return bulkSetPublished(reviewIds, true);
}

export async function bulkUnpublishReviews(reviewIds: string[]): Promise<BulkActionResult> {
  return bulkSetPublished(reviewIds, false);
}

async function bulkSetPublished(reviewIds: string[], isPublished: boolean): Promise<BulkActionResult> {
  const parsed = bulkIdsSchema.safeParse(reviewIds);
  if (!parsed.success) {
    return { success: false, successCount: 0, failCount: reviewIds.length };
  }

  try {
    await requireAdmin();
  } catch {
    return { success: false, successCount: 0, failCount: parsed.data.length };
  }

  const db = await getAdminDb();
  let successCount = 0;
  let failCount = 0;
  const affectedProperties = new Set<string>();

  const results = await Promise.allSettled(
    parsed.data.map(async (reviewId) => {
      const docRef = db.collection('reviews').doc(reviewId);
      const snap = await docRef.get();
      if (!snap.exists) throw new Error('Review not found');

      const data = snap.data()!;
      await requirePropertyAccess(data.propertyId);

      if (data.isPublished === isPublished) return; // Already in desired state

      await docRef.update({
        isPublished,
        updatedAt: FieldValue.serverTimestamp(),
      });
      affectedProperties.add(data.propertyId);
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') successCount++;
    else failCount++;
  }

  for (const propertyId of affectedProperties) {
    await recalculatePropertyRatings(propertyId);
  }

  revalidatePath('/admin/reviews');
  logger.info(`Bulk ${isPublished ? 'publish' : 'unpublish'} completed`, { successCount, failCount });
  return { success: failCount === 0, successCount, failCount };
}

export async function bulkDeleteReviews(reviewIds: string[]): Promise<BulkActionResult> {
  const parsed = bulkIdsSchema.safeParse(reviewIds);
  if (!parsed.success) {
    return { success: false, successCount: 0, failCount: reviewIds.length };
  }

  try {
    await requireAdmin();
  } catch {
    return { success: false, successCount: 0, failCount: parsed.data.length };
  }

  const db = await getAdminDb();
  let successCount = 0;
  let failCount = 0;
  const affectedProperties = new Set<string>();

  const results = await Promise.allSettled(
    parsed.data.map(async (reviewId) => {
      const docRef = db.collection('reviews').doc(reviewId);
      const snap = await docRef.get();
      if (!snap.exists) throw new Error('Review not found');

      const data = snap.data()!;
      await requirePropertyAccess(data.propertyId);

      await docRef.delete();
      if (data.isPublished) {
        affectedProperties.add(data.propertyId);
      }
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') successCount++;
    else failCount++;
  }

  for (const propertyId of affectedProperties) {
    await recalculatePropertyRatings(propertyId);
  }

  revalidatePath('/admin/reviews');
  logger.info('Bulk delete reviews completed', { successCount, failCount });
  return { success: failCount === 0, successCount, failCount };
}

// --- Review Import ---

const VALID_SOURCES: ReviewSource[] = ['direct', 'google', 'booking.com', 'airbnb', 'manual'];

const importReviewSchema = z.object({
  propertyId: z.string().min(1),
  guestName: z.string().min(1).max(200).transform(sanitizeText),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(5000).transform(sanitizeText),
  date: z.string().min(1),
  source: z.enum(['direct', 'google', 'booking.com', 'airbnb', 'manual'] as const),
  sourceUrl: z.string().max(2000).optional(),
  language: z.string().max(10).optional(),
  isPublished: z.boolean(),
});

type ImportReviewInput = z.infer<typeof importReviewSchema>;

/**
 * Check for duplicate reviews across properties.
 * Matches on lowercase trimmed guestName + date (day only) + source + propertyId.
 */
export async function checkDuplicateReviews(
  reviews: Array<{ propertyId: string; guestName: string; date: string; source: string }>
): Promise<{ duplicateIndices: number[] }> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { duplicateIndices: [] };
    throw error;
  }

  const db = await getAdminDb();
  const duplicateIndices: number[] = [];

  // Group by propertyId to minimize queries
  const byProperty = new Map<string, { index: number; guestName: string; date: string; source: string }[]>();
  for (let i = 0; i < reviews.length; i++) {
    const r = reviews[i];
    const existing = byProperty.get(r.propertyId) || [];
    existing.push({ index: i, guestName: r.guestName, date: r.date, source: r.source });
    byProperty.set(r.propertyId, existing);
  }

  for (const [propertyId, entries] of byProperty) {
    try {
      const snapshot = await db
        .collection('reviews')
        .where('propertyId', '==', propertyId)
        .get();

      const existingReviews = snapshot.docs.map(doc => {
        const data = doc.data();
        // Normalize date to YYYY-MM-DD for comparison
        let dateStr = '';
        if (data.date) {
          if (data.date.toDate) {
            dateStr = data.date.toDate().toISOString().slice(0, 10);
          } else if (typeof data.date === 'string') {
            dateStr = new Date(data.date).toISOString().slice(0, 10);
          }
        }
        return {
          guestName: (data.guestName || '').toLowerCase().trim(),
          date: dateStr,
          source: data.source || '',
        };
      });

      for (const entry of entries) {
        const entryDate = new Date(entry.date).toISOString().slice(0, 10);
        const entryName = entry.guestName.toLowerCase().trim();
        const isDuplicate = existingReviews.some(
          ex => ex.guestName === entryName && ex.date === entryDate && ex.source === entry.source
        );
        if (isDuplicate) {
          duplicateIndices.push(entry.index);
        }
      }
    } catch (error) {
      logger.error('Error checking duplicates for property', error as Error, { propertyId });
    }
  }

  return { duplicateIndices };
}

/**
 * Import a batch of reviews. Validates each review, checks property access, delegates to batchCreateReviews.
 */
export async function importReviewsBatch(
  input: { reviews: ImportReviewInput[] }
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, count: 0, error: 'Unauthorized.' };
    }
    throw error;
  }

  if (!input.reviews || input.reviews.length === 0) {
    return { success: false, count: 0, error: 'No reviews to import.' };
  }

  if (input.reviews.length > 100) {
    return { success: false, count: 0, error: 'Cannot import more than 100 reviews at once.' };
  }

  // Validate each review
  const validatedReviews: ImportReviewInput[] = [];
  for (let i = 0; i < input.reviews.length; i++) {
    const parsed = importReviewSchema.safeParse(input.reviews[i]);
    if (!parsed.success) {
      const msg = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, count: 0, error: `Review ${i + 1}: ${msg}` };
    }
    validatedReviews.push(parsed.data);
  }

  // Check property access for each unique property
  const uniqueProperties = [...new Set(validatedReviews.map(r => r.propertyId))];
  for (const propertyId of uniqueProperties) {
    try {
      await requirePropertyAccess(propertyId);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return { success: false, count: 0, error: `No access to property: ${propertyId}` };
      }
      throw error;
    }
  }

  // Delegate to batchCreateReviews
  const result = await batchCreateReviews(
    validatedReviews.map(r => ({
      propertyId: r.propertyId,
      guestName: r.guestName,
      rating: r.rating,
      comment: r.comment,
      date: r.date,
      source: r.source,
      sourceUrl: r.sourceUrl,
      language: r.language,
      isPublished: r.isPublished,
    }))
  );

  if (result.success) {
    revalidatePath('/admin/reviews');
  }

  return result;
}

// --- Google Places Sync ---

interface GoogleSyncReview {
  guestName: string;
  rating: number;
  comment: string;
  date: string;
  sourceUrl?: string;
  language?: string;
}

interface GoogleSyncResult {
  success: boolean;
  reviews: GoogleSyncReview[];
  placeName?: string;
  error?: string;
}

/**
 * Fetch Google reviews for a property via its configured googlePlaceId.
 */
export async function fetchGoogleReviewsForProperty(
  propertyId: string
): Promise<GoogleSyncResult> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, reviews: [], error: 'Unauthorized.' };
    }
    throw error;
  }

  try {
    const db = await getAdminDb();
    const propertyDoc = await db.collection('properties').doc(propertyId).get();

    if (!propertyDoc.exists) {
      return { success: false, reviews: [], error: 'Property not found.' };
    }

    const data = propertyDoc.data()!;
    const googlePlaceId = data.googlePlaceId;

    if (!googlePlaceId) {
      return { success: false, reviews: [], error: 'No Google Place ID configured. Add it in Property Settings.' };
    }

    const result = await fetchGoogleReviews(googlePlaceId);

    if (!result.success) {
      return { success: false, reviews: [], error: result.error };
    }

    return {
      success: true,
      reviews: result.reviews.map(r => ({
        guestName: r.guestName,
        rating: r.rating,
        comment: r.comment,
        date: r.date,
        sourceUrl: r.sourceUrl,
        language: r.language,
      })),
      placeName: result.placeName,
    };
  } catch (error) {
    logger.error('Failed to fetch Google reviews for property', error as Error, { propertyId });
    return { success: false, reviews: [], error: 'Failed to fetch Google reviews.' };
  }
}
