'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getAdminDb, getAdminStorage, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import type { PropertyImage } from '@/types';

const logger = loggers.admin;

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Zod strips unknown keys, so anything missing here is silently destroyed the
 * next time an admin saves the image list. Two fields were being lost that way:
 *
 *  - aiDescription: the vision-generated description the ad/post selectors
 *    reason over. Expensive to produce, and its loss is invisible until a
 *    campaign picks the wrong photo.
 *  - blurDataURL: the tiny base64 placeholder behind each photo.
 *
 * If you add a field to PropertyImage, add it here in the same commit.
 */
const aiImageDescriptionSchema = z.object({
  summary: z.string(),
  setting: z.string(),
  season: z.string(),
  timeOfDay: z.string(),
  mood: z.string(),
  subjects: z.array(z.string()),
  features: z.array(z.string()),
  people: z.string(),
  activities: z.array(z.string()),
  palette: z.array(z.string()),
  fitsAngles: z.array(z.string()),
  model: z.string(),
  describedAt: z.string(),
});

const propertyImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(500).default(''),
  isFeatured: z.boolean().optional(),
  showInGallery: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
  thumbnailUrl: z.string().url().optional(),
  displayUrl: z.string().url().optional(),
  storagePath: z.string().optional(),
  displayStoragePath: z.string().optional(),
  thumbnailStoragePath: z.string().optional(),
  // Tolerant on purpose: a shape drift in the vision output should not wipe the
  // description, which is the exact failure this schema already caused once.
  aiDescription: aiImageDescriptionSchema.partial().passthrough().optional(),
  blurDataURL: z.string().optional(),
  'data-ai-hint': z.string().optional(),
});

const saveImagesSchema = z.array(propertyImageSchema).max(50);

// ============================================================================
// Fetch Property Images
// ============================================================================

export async function fetchPropertyImages(
  slug: string
): Promise<{ images: PropertyImage[]; propertyName: string } | null> {
  try {
    await requirePropertyAccess(slug);
    const db = await getAdminDb();

    const doc = await db.collection('properties').doc(slug).get();
    if (!doc.exists) return null;

    const data = convertTimestampsToISOStrings(doc.data()!);
    const name = typeof data.name === 'string' ? data.name : data.name?.en || slug;
    const images: PropertyImage[] = data.images || [];

    return { images, propertyName: name };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchPropertyImages', { slug });
      return null;
    }
    logger.error('Error fetching property images', error as Error, { slug });
    return null;
  }
}

// ============================================================================
// Save Property Images
// ============================================================================

export async function savePropertyImages(
  slug: string,
  images: PropertyImage[]
): Promise<{ error?: string }> {
  try {
    await requirePropertyAccess(slug);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    throw error;
  }

  const parsed = saveImagesSchema.safeParse(images);
  if (!parsed.success) {
    const errors = parsed.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    return { error: `Invalid image data: ${errors}` };
  }

  try {
    const db = await getAdminDb();

    // Assign sortOrder based on array position
    const orderedImages = parsed.data.map((img, i) => ({
      ...img,
      sortOrder: i,
    }));

    await db.collection('properties').doc(slug).update({
      images: orderedImages,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Property images saved', { slug, count: orderedImages.length });
    revalidatePath(`/admin/properties/${slug}/images`);
    revalidatePath(`/admin/properties/${slug}`);
    return {};
  } catch (error) {
    logger.error('Error saving property images', error as Error, { slug });
    return { error: 'Failed to save images' };
  }
}

// ============================================================================
// Delete Image from Storage (server-side with auth check)
// ============================================================================

export async function deleteImageFromStorage(
  slug: string,
  storagePath: string,
  thumbnailPath?: string,
  displayPath?: string
): Promise<{ error?: string }> {
  try {
    await requirePropertyAccess(slug);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    throw error;
  }

  // Validate the storage path belongs to this property
  const expectedPrefix = `properties/${slug}/images/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return { error: 'Invalid storage path for this property' };
  }

  try {
    const adminStorage = await getAdminStorage();
    const bucket = adminStorage.bucket();

    await bucket.file(storagePath).delete().catch(() => {
      // File may already be deleted — ignore
    });

    // Derivatives are absent on images predating each tier, so misses are fine.
    for (const derivative of [thumbnailPath, displayPath]) {
      if (!derivative || !derivative.startsWith(expectedPrefix)) continue;
      await bucket.file(derivative).delete().catch(() => {
        // Derivative may not exist, nothing to clean up
      });
    }

    logger.info('Storage image deleted', { slug, storagePath });
    return {};
  } catch (error) {
    logger.error('Error deleting storage image', error as Error, { slug, storagePath });
    return { error: 'Failed to delete image from storage' };
  }
}
