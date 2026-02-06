/**
 * @fileoverview Core logic for importing external iCal feeds and syncing to availability.
 * Fetches .ics from external URLs, parses events, and blocks dates in availability docs.
 * Handles conflict resolution (our bookings win) and stale block cleanup.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { loggers } from '@/lib/logger';
import type { ICalFeed } from '@/types';

const logger = loggers.icalSync;

/** A date range extracted from an iCal event */
interface ParsedEvent {
  uid: string;
  summary: string;
  startDate: Date; // Inclusive
  endDate: Date;   // Exclusive
}

export interface SyncResult {
  feedId: string;
  feedName: string;
  eventsFound: number;
  datesBlocked: number;
  datesReleased: number;
  skippedOurBookings: number;
  skippedOwnExport: number;
  error?: string;
}

const OUR_UID_PATTERN = /^rentalspot-/;
const FETCH_TIMEOUT_MS = 30000;

/**
 * Fetches and parses an iCal feed URL into event date ranges.
 */
export async function fetchAndParseICalFeed(url: string): Promise<ParsedEvent[]> {
  // Fetch with timeout using AbortController
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let responseText: string;
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    responseText = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  // Dynamic import to avoid BigInt build-time issue with node-ical
  const ical = await import('node-ical');

  // Parse the iCal content
  const parsed = ical.sync.parseICS(responseText);
  const events: ParsedEvent[] = [];

  for (const [key, component] of Object.entries(parsed)) {
    if (!component || component.type !== 'VEVENT') continue;

    const event = component as any;
    if (!event.start) continue;

    // Extract UID
    const uid = event.uid || key;

    // Extract summary
    const summary = typeof event.summary === 'string'
      ? event.summary
      : event.summary?.val || '';

    // Get start and end dates
    const startDate = new Date(event.start);
    let endDate: Date;

    if (event.end) {
      endDate = new Date(event.end);
    } else {
      // If no end date, assume single day (next day for exclusive end)
      endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
    }

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) continue;
    if (endDate <= startDate) continue;

    events.push({ uid, summary, startDate, endDate });
  }

  return events;
}

/**
 * Syncs parsed iCal events to availability docs for a feed.
 * - Blocks dates from external events (if not already blocked by our bookings)
 * - Releases stale external blocks that no longer appear in the feed
 * - Skips events matching our own export UID pattern
 */
export async function syncFeedToAvailability(
  db: FirebaseFirestore.Firestore,
  feed: ICalFeed,
  events: ParsedEvent[]
): Promise<SyncResult> {
  const result: SyncResult = {
    feedId: feed.id,
    feedName: feed.name,
    eventsFound: events.length,
    datesBlocked: 0,
    datesReleased: 0,
    skippedOurBookings: 0,
    skippedOwnExport: 0,
  };

  // Filter out our own exported events to prevent circular sync
  const externalEvents = events.filter(e => {
    if (OUR_UID_PATTERN.test(e.uid)) {
      result.skippedOwnExport++;
      return false;
    }
    return true;
  });

  // Collect all dates that should be blocked from this feed
  const datesToBlock = new Set<string>(); // "YYYY-MM:day" format for deduplication

  for (const event of externalEvents) {
    const current = new Date(event.startDate);
    while (current < event.endDate) {
      // Use UTC consistently to avoid timezone mismatch
      const year = current.getUTCFullYear();
      const month = current.getUTCMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const day = current.getUTCDate();
      datesToBlock.add(`${monthKey}:${day}`);
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  // Group dates by month for efficient Firestore operations
  const datesByMonth = new Map<string, Set<number>>();
  for (const dateKey of datesToBlock) {
    const [monthKey, dayStr] = dateKey.split(':');
    if (!datesByMonth.has(monthKey)) {
      datesByMonth.set(monthKey, new Set());
    }
    datesByMonth.get(monthKey)!.add(parseInt(dayStr, 10));
  }

  // Also find all months that currently have external blocks from this feed
  // (to clean up stale blocks)
  const availSnapshot = await db.collection('availability')
    .where('propertyId', '==', feed.propertyId)
    .get();

  const existingBlocksByMonth = new Map<string, Map<number, string>>(); // month -> day -> feedId
  for (const doc of availSnapshot.docs) {
    const data = doc.data();
    if (!data.externalBlocks) continue;
    const month = data.month;
    if (!month) continue;

    const blocks = new Map<number, string>();
    for (const [day, feedId] of Object.entries(data.externalBlocks)) {
      if (feedId === feed.id) {
        blocks.set(parseInt(day, 10), feedId as string);
      }
    }
    if (blocks.size > 0) {
      existingBlocksByMonth.set(month, blocks);
    }
  }

  // Determine which months we need to touch
  const allMonths = new Set<string>([...datesByMonth.keys(), ...existingBlocksByMonth.keys()]);

  // Process in batches (Firestore batch limit is 500 ops)
  const batch = db.batch();
  let batchOps = 0;

  for (const monthKey of allMonths) {
    const docId = `${feed.propertyId}_${monthKey}`;
    const docRef = db.collection('availability').doc(docId);

    const incomingDays = datesByMonth.get(monthKey) || new Set<number>();
    const existingBlocks = existingBlocksByMonth.get(monthKey) || new Map<number, string>();

    const updateData: Record<string, any> = {};
    let hasUpdates = false;

    // Fetch current doc to check conflicts
    const currentDoc = await docRef.get();
    const currentData = currentDoc.exists ? currentDoc.data()! : {};

    // Block new dates from the feed
    for (const day of incomingDays) {
      // Check if this date is already blocked by our own booking/hold
      const isOurBooking = currentData.available?.[day] === false &&
        !currentData.externalBlocks?.[day];
      const hasHold = !!currentData.holds?.[day];

      if (isOurBooking || hasHold) {
        result.skippedOurBookings++;
        continue;
      }

      // Block the date
      if (currentData.externalBlocks?.[day] !== feed.id || currentData.available?.[day] !== false) {
        updateData[`available.${day}`] = false;
        updateData[`externalBlocks.${day}`] = feed.id;
        hasUpdates = true;
        result.datesBlocked++;
      }
    }

    // Release stale blocks (dates that were previously blocked by this feed but no longer in the incoming events)
    for (const [day] of existingBlocks) {
      if (!incomingDays.has(day)) {
        // Only release if the block is exclusively from this feed
        const isOurBooking = currentData.holds?.[day];
        if (!isOurBooking) {
          updateData[`available.${day}`] = true;
        }
        updateData[`externalBlocks.${day}`] = FieldValue.delete();
        hasUpdates = true;
        result.datesReleased++;
      }
    }

    if (hasUpdates) {
      updateData.updatedAt = FieldValue.serverTimestamp();
      if (currentDoc.exists) {
        batch.update(docRef, updateData);
      } else {
        // Create the availability doc if it doesn't exist.
        // First create the base doc, then update with dot-notation fields.
        // Cannot mix full field (available: {}) with dot-notation (available.2: false) in set().
        batch.set(docRef, {
          propertyId: feed.propertyId,
          month: monthKey,
        }, { merge: true });
        batch.update(docRef, updateData);
        batchOps++; // extra op for the two-step create
      }
      batchOps++;

      // Firestore batch limit
      if (batchOps >= 450) {
        await batch.commit();
        batchOps = 0;
      }
    }
  }

  if (batchOps > 0) {
    await batch.commit();
  }

  return result;
}
