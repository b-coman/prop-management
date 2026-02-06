'use server';

import { z } from 'zod';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { validateReviewToken } from '@/lib/review-token';
import { createReview } from '@/services/reviewService';
import { sanitizeText } from '@/lib/sanitize';
import { loggers } from '@/lib/logger';

const logger = loggers.admin;

const submitReviewSchema = z.object({
  bookingId: z.string().min(1),
  token: z.string().min(1),
  guestName: z.string().min(1).max(200),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(20).max(2000),
  language: z.string().optional(),
});

export async function submitGuestReview(input: {
  bookingId: string;
  token: string;
  guestName: string;
  rating: number;
  comment: string;
  language?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate input
    const parsed = submitReviewSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return { success: false, error: firstError?.message || 'Invalid input.' };
    }

    const { bookingId, token, guestName, rating, comment, language } = parsed.data;

    // Fetch booking and validate token
    const db = await getAdminDb();
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();

    if (!bookingDoc.exists) {
      return { success: false, error: 'Booking not found.' };
    }

    const booking = bookingDoc.data()!;
    const guestEmail = booking.guestInfo?.email;

    if (!guestEmail) {
      return { success: false, error: 'Invalid booking data.' };
    }

    if (!validateReviewToken(bookingId, guestEmail, token)) {
      return { success: false, error: 'Invalid review link.' };
    }

    // Check no existing review
    const existingReview = await db
      .collection('reviews')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();

    if (!existingReview.empty) {
      return { success: false, error: 'A review has already been submitted for this booking.' };
    }

    // Create review (unpublished, pending admin moderation)
    const result = await createReview({
      propertyId: booking.propertyId,
      bookingId,
      guestName: sanitizeText(guestName),
      rating,
      comment: sanitizeText(comment),
      date: new Date().toISOString(),
      source: 'direct',
      language: language || booking.language,
      isPublished: false,
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to submit review.' };
    }

    logger.info('Guest review submitted', { bookingId, reviewId: result.id });
    return { success: true };
  } catch (error) {
    logger.error('Error submitting guest review', error as Error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
