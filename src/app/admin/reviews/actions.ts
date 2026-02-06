// src/app/admin/reviews/actions.ts
"use server";

import { z } from "zod";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdminSafe";
import type { Review } from "@/types";
import { revalidatePath } from "next/cache";
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { loggers } from '@/lib/logger';
import {
  requireAdmin,
  requirePropertyAccess,
  filterBookingsForUser,
  handleAuthError,
  AuthorizationError,
} from '@/lib/authorization';
import { recalculatePropertyRatings } from '@/services/reviewService';

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
