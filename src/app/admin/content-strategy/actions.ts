'use server';

import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import {
  CONTENT_COLLECTIONS,
  type ContentBrief,
  type ContentTopic,
  type ContentDraft,
} from '@/lib/content-schemas';
import { generateContent } from '@/services/contentGeneration';

const logger = loggers.admin;

// ============================================================================
// Content Brief CRUD
// ============================================================================

export async function fetchContentBrief(
  propertyId: string
): Promise<ContentBrief | null> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    const doc = await db
      .collection(CONTENT_COLLECTIONS.briefs)
      .doc(propertyId)
      .get();

    if (!doc.exists) return null;

    return convertTimestampsToISOStrings(doc.data()) as ContentBrief;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchContentBrief', { propertyId });
      return null;
    }
    logger.error('Error fetching content brief', error as Error, { propertyId });
    return null;
  }
}

export async function saveContentBrief(
  propertyId: string,
  brief: Partial<ContentBrief>
): Promise<{ error?: string }> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    await db
      .collection(CONTENT_COLLECTIONS.briefs)
      .doc(propertyId)
      .set(
        {
          ...brief,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return {};
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: 'Not authorized' };
    }
    logger.error('Error saving content brief', error as Error, { propertyId });
    return { error: 'Failed to save content brief' };
  }
}

// ============================================================================
// Content Topics CRUD
// ============================================================================

export async function fetchContentTopics(
  propertyId: string
): Promise<ContentTopic[]> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    const snapshot = await db
      .collection(CONTENT_COLLECTIONS.topics(propertyId))
      .orderBy('priority')
      .get();

    return snapshot.docs.map((doc) => {
      const data = convertTimestampsToISOStrings(doc.data());
      return { id: doc.id, ...data } as ContentTopic;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchContentTopics', { propertyId });
      return [];
    }
    logger.error('Error fetching content topics', error as Error, { propertyId });
    return [];
  }
}

export async function saveContentTopic(
  propertyId: string,
  topic: ContentTopic
): Promise<{ error?: string; topicId?: string }> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    const collectionRef = db.collection(CONTENT_COLLECTIONS.topics(propertyId));
    const { id, ...topicData } = topic;

    if (id) {
      await collectionRef.doc(id).set(
        { ...topicData, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      return { topicId: id };
    } else {
      const docRef = await collectionRef.add({
        ...topicData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { topicId: docRef.id };
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: 'Not authorized' };
    }
    logger.error('Error saving content topic', error as Error, { propertyId });
    return { error: 'Failed to save topic' };
  }
}

export async function deleteContentTopic(
  propertyId: string,
  topicId: string
): Promise<{ error?: string }> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    await db
      .collection(CONTENT_COLLECTIONS.topics(propertyId))
      .doc(topicId)
      .delete();

    return {};
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: 'Not authorized' };
    }
    logger.error('Error deleting content topic', error as Error, { propertyId, topicId });
    return { error: 'Failed to delete topic' };
  }
}

export async function updateTopicStatus(
  propertyId: string,
  topicId: string,
  status: string
): Promise<{ error?: string }> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    await db
      .collection(CONTENT_COLLECTIONS.topics(propertyId))
      .doc(topicId)
      .update({
        status,
        updatedAt: FieldValue.serverTimestamp(),
      });

    return {};
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: 'Not authorized' };
    }
    logger.error('Error updating topic status', error as Error, { propertyId, topicId, status });
    return { error: 'Failed to update topic status' };
  }
}

// ============================================================================
// Content Drafts
// ============================================================================

export async function fetchContentDrafts(
  propertyId: string
): Promise<ContentDraft[]> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    const snapshot = await db
      .collection(CONTENT_COLLECTIONS.drafts(propertyId))
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map((doc) => {
      const data = convertTimestampsToISOStrings(doc.data());
      return { id: doc.id, ...data } as ContentDraft;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchContentDrafts', { propertyId });
      return [];
    }
    logger.error('Error fetching content drafts', error as Error, { propertyId });
    return [];
  }
}

// ============================================================================
// Content Generation
// ============================================================================

export async function generateTopicContent(
  propertyId: string,
  topicId: string
): Promise<{ draftId?: string; error?: string }> {
  try {
    await requirePropertyAccess(propertyId);

    logger.info('Generating content for topic', { propertyId, topicId });
    const result = await generateContent({ propertySlug: propertyId, topicId });

    if (result.error) {
      logger.warn('Content generation returned error', { propertyId, topicId, error: result.error });
    } else {
      logger.info('Content generated successfully', { propertyId, topicId, draftId: result.draftId });
    }

    return result;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: 'Not authorized' };
    }
    logger.error('Error generating content', error as Error, { propertyId, topicId });
    return { error: 'Failed to generate content' };
  }
}
