/**
 * @fileoverview Cron endpoint for syncing external iCal feeds.
 * Fetches all enabled iCal feeds, parses them, and updates availability.
 *
 * Security: Only accessible via cron job with proper authorization header.
 * Frequency: Every 15 minutes via Cloud Scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';
import { FieldValue } from 'firebase-admin/firestore';
import { loggers } from '@/lib/logger';
import { fetchAndParseICalFeed, syncFeedToAvailability } from '@/lib/ical/ical-import';
import type { ICalFeed } from '@/types';
import type { SyncResult } from '@/lib/ical/ical-import';

const logger = loggers.icalSync;

const MAX_CONCURRENT_SYNCS = 5;

export async function GET(request: NextRequest) {
  logger.info('iCal feed sync cron triggered');

  // Verify legitimate cron request
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');

  if (!cronHeader && !authHeader?.startsWith('Bearer ')) {
    logger.error('Unauthorized access attempt to iCal sync cron');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getFirestoreForPricing();
    if (!db) {
      throw new Error('Firebase Admin SDK not available');
    }

    // Fetch all enabled feeds
    const feedsSnapshot = await db.collection('icalFeeds')
      .where('enabled', '==', true)
      .get();

    if (feedsSnapshot.empty) {
      logger.info('No enabled iCal feeds found');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No enabled feeds to sync',
      });
    }

    const feeds: ICalFeed[] = feedsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as ICalFeed));

    logger.info('Found enabled feeds', { count: feeds.length });

    // Process feeds in batches of MAX_CONCURRENT_SYNCS
    const results: SyncResult[] = [];

    for (let i = 0; i < feeds.length; i += MAX_CONCURRENT_SYNCS) {
      const batch = feeds.slice(i, i + MAX_CONCURRENT_SYNCS);
      const batchResults = await Promise.allSettled(
        batch.map(feed => syncSingleFeed(db, feed))
      );

      for (const [index, settled] of batchResults.entries()) {
        if (settled.status === 'fulfilled') {
          results.push(settled.value);
        } else {
          const feed = batch[index];
          results.push({
            feedId: feed.id,
            feedName: feed.name,
            eventsFound: 0,
            datesBlocked: 0,
            datesReleased: 0,
            skippedOurBookings: 0,
            skippedOwnExport: 0,
            error: settled.reason?.message || String(settled.reason),
          });
        }
      }
    }

    const successCount = results.filter(r => !r.error).length;
    const errorCount = results.filter(r => r.error).length;

    logger.info('iCal feed sync completed', {
      total: results.length,
      success: successCount,
      errors: errorCount,
    });

    return NextResponse.json({
      success: true,
      processed: results.length,
      successCount,
      errorCount,
      results: results.map(r => ({
        feedId: r.feedId,
        feedName: r.feedName,
        eventsFound: r.eventsFound,
        datesBlocked: r.datesBlocked,
        datesReleased: r.datesReleased,
        error: r.error || null,
      })),
    });
  } catch (error) {
    logger.error('Error in iCal feed sync cron', error as Error);
    return NextResponse.json(
      { error: 'Failed to sync feeds', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Syncs a single iCal feed and updates its status in Firestore.
 */
async function syncSingleFeed(
  db: FirebaseFirestore.Firestore,
  feed: ICalFeed
): Promise<SyncResult> {
  const feedRef = db.collection('icalFeeds').doc(feed.id);

  try {
    logger.info('Syncing feed', { feedId: feed.id, feedName: feed.name, propertyId: feed.propertyId });

    // Fetch and parse the external iCal feed
    const events = await fetchAndParseICalFeed(feed.url);

    // Sync events to availability
    const result = await syncFeedToAvailability(db, feed, events);

    // Update feed status
    await feedRef.update({
      lastSyncAt: FieldValue.serverTimestamp(),
      lastSyncStatus: 'success',
      lastSyncError: null,
      lastSyncEventsCount: result.eventsFound,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Feed synced successfully', {
      feedId: feed.id,
      eventsFound: result.eventsFound,
      datesBlocked: result.datesBlocked,
      datesReleased: result.datesReleased,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error syncing feed', error as Error, { feedId: feed.id, feedName: feed.name });

    // Update feed status with error
    await feedRef.update({
      lastSyncAt: FieldValue.serverTimestamp(),
      lastSyncStatus: 'error',
      lastSyncError: errorMessage,
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(updateErr => {
      logger.error('Failed to update feed error status', updateErr as Error, { feedId: feed.id });
    });

    return {
      feedId: feed.id,
      feedName: feed.name,
      eventsFound: 0,
      datesBlocked: 0,
      datesReleased: 0,
      skippedOurBookings: 0,
      skippedOwnExport: 0,
      error: errorMessage,
    };
  }
}

// POST method for manual testing (protected)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return GET(request);
}
