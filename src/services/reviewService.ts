// src/services/reviewService.ts
'use server';

import { getAdminDb, Timestamp, FieldValue } from '@/lib/firebaseAdminSafe';
import type { Review, ReviewSource } from '@/types';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { loggers } from '@/lib/logger';

const logger = loggers.review;

/**
 * Get published reviews for a property (public-facing).
 */
export async function getPublishedReviewsForProperty(
  propertyId: string,
  maxResults = 10
): Promise<Review[]> {
  try {
    const db = await getAdminDb();
    const snapshot = await db
      .collection('reviews')
      .where('propertyId', '==', propertyId)
      .where('isPublished', '==', true)
      .orderBy('date', 'desc')
      .limit(maxResults)
      .get();

    return snapshot.docs.map((doc) =>
      convertTimestampsToISOStrings({ id: doc.id, ...doc.data() }) as Review
    );
  } catch (error) {
    logger.error('Failed to get published reviews', error as Error, { propertyId });
    return [];
  }
}

/**
 * Get all reviews for admin panel.
 */
export async function getAllReviewsForAdmin(propertyId?: string): Promise<Review[]> {
  try {
    const db = await getAdminDb();
    let ref: FirebaseFirestore.Query = db.collection('reviews');

    if (propertyId) {
      ref = ref.where('propertyId', '==', propertyId);
    }

    const snapshot = await ref.orderBy('date', 'desc').get();

    return snapshot.docs.map((doc) =>
      convertTimestampsToISOStrings({ id: doc.id, ...doc.data() }) as Review
    );
  } catch (error) {
    logger.error('Failed to get all reviews for admin', error as Error);
    return [];
  }
}

/**
 * Create a review. Recalculates property ratings if published.
 */
export async function createReview(data: {
  propertyId: string;
  bookingId?: string;
  guestName: string;
  rating: number;
  comment: string;
  photos?: string[];
  date: string;
  source: ReviewSource;
  sourceUrl?: string;
  language?: string;
  isPublished: boolean;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const db = await getAdminDb();
    const now = FieldValue.serverTimestamp();

    const docRef = await db.collection('reviews').add({
      ...data,
      date: Timestamp.fromDate(new Date(data.date)),
      createdAt: now,
      updatedAt: now,
    });

    logger.info('Review created', { id: docRef.id, propertyId: data.propertyId });

    if (data.isPublished) {
      await recalculatePropertyRatings(data.propertyId);
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    logger.error('Failed to create review', error as Error);
    return { success: false, error: 'Failed to create review.' };
  }
}

/**
 * Batch create reviews. Recalculates ratings for affected properties.
 */
export async function batchCreateReviews(
  reviews: Array<{
    propertyId: string;
    guestName: string;
    rating: number;
    comment: string;
    date: string;
    source: ReviewSource;
    sourceUrl?: string;
    language?: string;
    isPublished: boolean;
  }>
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const db = await getAdminDb();
    const batch = db.batch();
    const now = FieldValue.serverTimestamp();
    const affectedProperties = new Set<string>();

    for (const review of reviews) {
      const ref = db.collection('reviews').doc();
      batch.set(ref, {
        ...review,
        date: Timestamp.fromDate(new Date(review.date)),
        createdAt: now,
        updatedAt: now,
      });
      if (review.isPublished) {
        affectedProperties.add(review.propertyId);
      }
    }

    await batch.commit();
    logger.info('Batch reviews created', { count: reviews.length });

    // Recalculate ratings for all affected properties
    for (const propertyId of affectedProperties) {
      await recalculatePropertyRatings(propertyId);
    }

    return { success: true, count: reviews.length };
  } catch (error) {
    logger.error('Failed to batch create reviews', error as Error);
    return { success: false, count: 0, error: 'Failed to batch create reviews.' };
  }
}

/**
 * Update a review. Recalculates ratings if isPublished changed.
 */
export async function updateReview(
  reviewId: string,
  data: Partial<Pick<Review, 'guestName' | 'rating' | 'comment' | 'photos' | 'source' | 'sourceUrl' | 'language' | 'isPublished'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getAdminDb();
    const docRef = db.collection('reviews').doc(reviewId);
    const existing = await docRef.get();

    if (!existing.exists) {
      return { success: false, error: 'Review not found.' };
    }

    const oldData = existing.data()!;
    const publishedChanged = data.isPublished !== undefined && data.isPublished !== oldData.isPublished;

    await docRef.update({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Review updated', { reviewId });

    if (publishedChanged) {
      await recalculatePropertyRatings(oldData.propertyId);
    }

    return { success: true };
  } catch (error) {
    logger.error('Failed to update review', error as Error, { reviewId });
    return { success: false, error: 'Failed to update review.' };
  }
}

/**
 * Delete a review. Recalculates ratings if the review was published.
 */
export async function deleteReview(
  reviewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getAdminDb();
    const docRef = db.collection('reviews').doc(reviewId);
    const existing = await docRef.get();

    if (!existing.exists) {
      return { success: false, error: 'Review not found.' };
    }

    const data = existing.data()!;
    await docRef.delete();

    logger.info('Review deleted', { reviewId, propertyId: data.propertyId });

    if (data.isPublished) {
      await recalculatePropertyRatings(data.propertyId);
    }

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete review', error as Error, { reviewId });
    return { success: false, error: 'Failed to delete review.' };
  }
}

/**
 * Set an owner response on a review.
 */
export async function setOwnerResponse(
  reviewId: string,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getAdminDb();
    const docRef = db.collection('reviews').doc(reviewId);
    const existing = await docRef.get();

    if (!existing.exists) {
      return { success: false, error: 'Review not found.' };
    }

    await docRef.update({
      ownerResponse: {
        comment,
        date: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Owner response set', { reviewId });
    return { success: true };
  } catch (error) {
    logger.error('Failed to set owner response', error as Error, { reviewId });
    return { success: false, error: 'Failed to set owner response.' };
  }
}

/**
 * Remove owner response from a review.
 */
export async function removeOwnerResponse(
  reviewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getAdminDb();
    const docRef = db.collection('reviews').doc(reviewId);
    const existing = await docRef.get();

    if (!existing.exists) {
      return { success: false, error: 'Review not found.' };
    }

    await docRef.update({
      ownerResponse: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Owner response removed', { reviewId });
    return { success: true };
  } catch (error) {
    logger.error('Failed to remove owner response', error as Error, { reviewId });
    return { success: false, error: 'Failed to remove owner response.' };
  }
}

/**
 * Recalculate and update property.ratings based on published reviews.
 */
export async function recalculatePropertyRatings(
  propertyId: string
): Promise<void> {
  try {
    const db = await getAdminDb();
    const snapshot = await db
      .collection('reviews')
      .where('propertyId', '==', propertyId)
      .where('isPublished', '==', true)
      .get();

    const count = snapshot.size;
    let average = 0;

    if (count > 0) {
      const total = snapshot.docs.reduce((sum, doc) => sum + (doc.data().rating || 0), 0);
      average = Math.round((total / count) * 10) / 10; // Round to 1 decimal
    }

    // Update the property document
    // Properties are stored by slug as the doc ID
    const propertyRef = db.collection('properties').doc(propertyId);
    const propertyDoc = await propertyRef.get();

    if (propertyDoc.exists) {
      await propertyRef.update({
        ratings: { average, count },
        updatedAt: FieldValue.serverTimestamp(),
      });
      logger.info('Property ratings recalculated', { propertyId, average, count });
    } else {
      logger.warn('Property not found for ratings recalculation', { propertyId });
    }
  } catch (error) {
    logger.error('Failed to recalculate property ratings', error as Error, { propertyId });
  }
}
