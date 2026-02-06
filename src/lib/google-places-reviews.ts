'use server';

import { loggers } from '@/lib/logger';

const logger = loggers.review;

export interface GoogleReview {
  guestName: string;
  rating: number;
  comment: string;
  date: string;
  sourceUrl?: string;
  language?: string;
}

export interface FetchGoogleReviewsResult {
  success: boolean;
  reviews: GoogleReview[];
  placeName?: string;
  error?: string;
}

/**
 * Fetch reviews from Google Places API (New) for a given Place ID.
 * Returns up to 5 reviews (Google API limit).
 */
export async function fetchGoogleReviews(placeId: string): Promise<FetchGoogleReviewsResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return { success: false, reviews: [], error: 'Google Places API key is not configured.' };
  }

  try {
    const url = `https://places.googleapis.com/v1/places/${placeId}`;
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'displayName,reviews',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Google Places API error', new Error(errorText), { placeId, status: response.status });
      return { success: false, reviews: [], error: `Google API error (${response.status}): ${errorText.slice(0, 200)}` };
    }

    const data = await response.json();

    const placeName = data.displayName?.text || undefined;
    const reviews: GoogleReview[] = [];

    if (data.reviews && Array.isArray(data.reviews)) {
      for (const r of data.reviews) {
        const guestName = r.authorAttribution?.displayName || 'Anonymous';
        const rating = r.rating || 0;
        const comment = r.text?.text || '';
        const publishTime = r.publishTime || '';
        const sourceUrl = r.googleMapsUri || undefined;
        const language = r.text?.languageCode || undefined;

        if (rating >= 1 && rating <= 5 && comment) {
          reviews.push({
            guestName,
            rating,
            comment,
            date: publishTime ? new Date(publishTime).toISOString() : new Date().toISOString(),
            sourceUrl,
            language,
          });
        }
      }
    }

    logger.info('Fetched Google reviews', { placeId, count: reviews.length });
    return { success: true, reviews, placeName };
  } catch (error) {
    logger.error('Failed to fetch Google reviews', error as Error, { placeId });
    return { success: false, reviews: [], error: 'Failed to connect to Google Places API.' };
  }
}
