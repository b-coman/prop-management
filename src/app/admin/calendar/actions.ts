'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { requireAdmin, requirePropertyAccess, filterPropertiesForUser, AuthorizationError } from '@/lib/authorization';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { randomUUID } from 'crypto';
import type { ICalFeed } from '@/types';

const logger = loggers.icalSync;

// ============================================================================
// Zod Schemas
// ============================================================================

const addFeedSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  name: z.string().min(1, 'Name is required').max(100),
  url: z.string().url('Must be a valid URL').max(2048),
});

// ============================================================================
// Property Fetching (reused pattern from pricing)
// ============================================================================

export async function fetchProperties() {
  try {
    const user = await requireAdmin();
    const db = await getAdminDb();
    const propertiesSnapshot = await db.collection('properties').get();

    const allProperties = propertiesSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const serializedData = convertTimestampsToISOStrings(data);
      return {
        id: docSnap.id,
        slug: docSnap.id,
        name: serializedData.name || docSnap.id,
        location: serializedData.location || '',
        status: serializedData.status || 'active',
        pricePerNight: serializedData.pricePerNight,
        ...serializedData,
      };
    });

    const filteredProperties = filterPropertiesForUser(allProperties, user);
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

// ============================================================================
// iCal Feed CRUD
// ============================================================================

export async function fetchICalFeeds(propertyId: string): Promise<ICalFeed[]> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    const snapshot = await db
      .collection('icalFeeds')
      .where('propertyId', '==', propertyId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => {
      const data = convertTimestampsToISOStrings(doc.data());
      return { id: doc.id, ...data } as ICalFeed;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchICalFeeds', { propertyId });
      return [];
    }
    logger.error('Error fetching iCal feeds', error as Error, { propertyId });
    return [];
  }
}

export async function addICalFeed(formData: FormData): Promise<{ error?: string }> {
  const raw = {
    propertyId: formData.get('propertyId')?.toString() || '',
    name: formData.get('name')?.toString() || '',
    url: formData.get('url')?.toString() || '',
  };

  const parsed = addFeedSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { error: `Invalid input: ${errors}` };
  }

  const { propertyId, name, url } = parsed.data;

  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message };
    }
    throw error;
  }

  try {
    const db = await getAdminDb();
    await db.collection('icalFeeds').add({
      propertyId,
      name,
      url,
      enabled: true,
      lastSyncAt: null,
      lastSyncStatus: 'pending',
      lastSyncError: null,
      lastSyncEventsCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('iCal feed added', { propertyId, name });
    revalidatePath('/admin/calendar');
    return {};
  } catch (error) {
    logger.error('Error adding iCal feed', error as Error, { propertyId });
    return { error: 'Failed to add feed' };
  }
}

export async function toggleFeedEnabled(feedId: string, enabled: boolean): Promise<{ error?: string }> {
  try {
    const db = await getAdminDb();
    const feedRef = db.collection('icalFeeds').doc(feedId);
    const feedDoc = await feedRef.get();

    if (!feedDoc.exists) {
      return { error: 'Feed not found' };
    }

    const feedData = feedDoc.data()!;
    await requirePropertyAccess(feedData.propertyId);

    await feedRef.update({
      enabled,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('iCal feed toggled', { feedId, enabled });
    revalidatePath('/admin/calendar');
    return {};
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message };
    }
    logger.error('Error toggling feed', error as Error, { feedId });
    return { error: 'Failed to toggle feed' };
  }
}

export async function deleteICalFeed(feedId: string): Promise<{ error?: string }> {
  try {
    const db = await getAdminDb();
    const feedRef = db.collection('icalFeeds').doc(feedId);
    const feedDoc = await feedRef.get();

    if (!feedDoc.exists) {
      return { error: 'Feed not found' };
    }

    const feedData = feedDoc.data()!;
    const propertyId = feedData.propertyId;
    await requirePropertyAccess(propertyId);

    // Clean up external blocks from availability docs
    const availSnapshot = await db.collection('availability')
      .where('propertyId', '==', propertyId)
      .get();

    const batch = db.batch();
    let cleanedCount = 0;

    for (const availDoc of availSnapshot.docs) {
      const data = availDoc.data();
      if (!data.externalBlocks) continue;

      const updateData: Record<string, any> = {};
      let hasUpdates = false;

      for (const [day, sourceFeedId] of Object.entries(data.externalBlocks)) {
        if (sourceFeedId === feedId) {
          // Release the date unless it's also blocked by our own booking
          const dayNum = parseInt(day, 10);
          const isOurBooking = data.holds?.[dayNum];

          if (!isOurBooking) {
            updateData[`available.${day}`] = true;
          }
          updateData[`externalBlocks.${day}`] = FieldValue.delete();
          hasUpdates = true;
          cleanedCount++;
        }
      }

      if (hasUpdates) {
        updateData.updatedAt = FieldValue.serverTimestamp();
        batch.update(availDoc.ref, updateData);
      }
    }

    // Delete the feed document
    batch.delete(feedRef);
    await batch.commit();

    logger.info('iCal feed deleted with cleanup', { feedId, propertyId, cleanedBlocks: cleanedCount });
    revalidatePath('/admin/calendar');
    return {};
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message };
    }
    logger.error('Error deleting feed', error as Error, { feedId });
    return { error: 'Failed to delete feed' };
  }
}

// ============================================================================
// Export Token Management
// ============================================================================

export async function fetchExportConfig(propertyId: string): Promise<{
  icalExportToken?: string;
  icalExportEnabled?: boolean;
}> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();
    const propertyDoc = await db.collection('properties').doc(propertyId).get();

    if (!propertyDoc.exists) return {};

    const data = propertyDoc.data()!;
    return {
      icalExportToken: data.icalExportToken || undefined,
      icalExportEnabled: data.icalExportEnabled || false,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return {};
    logger.error('Error fetching export config', error as Error, { propertyId });
    return {};
  }
}

export async function generateExportToken(propertyId: string): Promise<{ token?: string; error?: string }> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    const token = randomUUID();
    await db.collection('properties').doc(propertyId).update({
      icalExportToken: token,
      icalExportEnabled: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('iCal export token generated', { propertyId });
    revalidatePath('/admin/calendar');
    return { token };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message };
    }
    logger.error('Error generating export token', error as Error, { propertyId });
    return { error: 'Failed to generate token' };
  }
}

export async function toggleExportEnabled(propertyId: string, enabled: boolean): Promise<{ error?: string }> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    await db.collection('properties').doc(propertyId).update({
      icalExportEnabled: enabled,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('iCal export toggled', { propertyId, enabled });
    revalidatePath('/admin/calendar');
    return {};
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message };
    }
    logger.error('Error toggling export', error as Error, { propertyId });
    return { error: 'Failed to toggle export' };
  }
}
