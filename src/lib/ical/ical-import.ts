/**
 * @fileoverview Core logic for importing external iCal feeds and syncing to availability.
 * Fetches .ics from external URLs, parses events, and blocks dates in availability docs.
 * Handles conflict resolution (our bookings win) and stale block cleanup.
 */

import { FieldValue, FieldPath } from 'firebase-admin/firestore';
import { loggers } from '@/lib/logger';
import type { ICalFeed } from '@/types';
import { recordOtaBlockObservations, type RecordOtaBlockInput } from '@/services/otaBlockObservations';

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

  /**
   * Which reservation produced each night. The expansion below is where event identity used to be
   * destroyed: after it, a day knew only its feedId, so four nights of one booking were
   * indistinguishable from four separate bookings. `otaBlockObservations` needs the uid to fold them
   * back together — otherwise a single four-night stay reports as four, which reads as a working
   * funnel and is not one. Last writer wins on an overlap, which is the same precedence the block
   * loop already applies.
   */
  const eventByDate = new Map<string, { uid: string; summary: string }>();

  for (const event of externalEvents) {
    const current = new Date(event.startDate);
    while (current < event.endDate) {
      // Use UTC consistently to avoid timezone mismatch
      const year = current.getUTCFullYear();
      const month = current.getUTCMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const day = current.getUTCDate();
      datesToBlock.add(`${monthKey}:${day}`);
      eventByDate.set(`${monthKey}:${day}`, { uid: event.uid, summary: event.summary });
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
  // Query by doc ID prefix — some docs may lack a propertyId field
  const docIdPrefix = `${feed.propertyId}_`;
  const availSnapshot = await db.collection('availability')
    .where(FieldPath.documentId(), '>=', docIdPrefix)
    .where(FieldPath.documentId(), '<', docIdPrefix + '\uf8ff')
    .get();

  const existingBlocksByMonth = new Map<string, Map<number, string>>(); // month -> day -> feedId
  for (const doc of availSnapshot.docs) {
    const data = doc.data();
    if (!data.externalBlocks) continue;
    // Extract month from doc ID (format: propertyId_YYYY-MM)
    const month = doc.id.slice(docIdPrefix.length);
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

  // Process in batches (Firestore batch limit is 500 ops).
  // `let`, because a committed WriteBatch cannot be reused — the flush below has to start a new one.
  let batch = db.batch();
  let batchOps = 0;

  /**
   * Observations accumulated across every month, written once at the end so a multi-night
   * reservation shares one `capturedAt` and folds back into a single booking.
   */
  const observations: RecordOtaBlockInput[] = [];
  const capturedAt = new Date().toISOString();

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

      /**
       * FIRST SIGHTING, not "we wrote something". `datesBlocked` below also counts a re-write when
       * the stored feedId or the available flag drifted out of sync, so it over-reports as a booking
       * signal. A genuine first observation is the field being ABSENT — verified against live data,
       * where a missing key, an empty `externalBlocks: {}` and a populated one are all distinguishable.
       */
      const wasNotBlockedBefore = currentData.externalBlocks?.[day] === undefined;

      // Block the date
      if (currentData.externalBlocks?.[day] !== feed.id || currentData.available?.[day] !== false) {
        updateData[`available.${day}`] = false;
        updateData[`externalBlocks.${day}`] = feed.id;
        hasUpdates = true;
        result.datesBlocked++;

        if (wasNotBlockedBefore) {
          const event = eventByDate.get(`${monthKey}:${day}`);
          observations.push({
            propertyId: feed.propertyId,
            date: `${monthKey}-${String(day).padStart(2, '0')}`,
            feedId: feed.id,
            feedName: feed.name,
            event: 'appeared',
            uid: event?.uid,
            summary: event?.summary,
          });
        }
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

        // A cancellation is as much a signal as a booking, and the stored state that proves it is
        // being deleted on this very line. No uid: the event that created the block is long gone.
        observations.push({
          propertyId: feed.propertyId,
          date: `${monthKey}-${String(day).padStart(2, '0')}`,
          feedId: feed.id,
          feedName: feed.name,
          event: 'released',
        });
      }
    }

    if (hasUpdates) {
      updateData.updatedAt = FieldValue.serverTimestamp();
      // Always ensure propertyId and month are set (may be missing on docs created by other code paths)
      updateData.propertyId = feed.propertyId;
      updateData.month = monthKey;
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

      // Firestore batch limit. The old code committed and then kept writing into the SAME batch
      // object, which throws once committed — unreachable for one property, but a real bug.
      if (batchOps >= 450) {
        await batch.commit();
        batch = db.batch();
        batchOps = 0;
      }
    }
  }

  if (batchOps > 0) {
    await batch.commit();
  }

  /**
   * AFTER the calendar is committed, never before. The sync's job is to keep the calendar correct;
   * an observation is bookkeeping. `recordOtaBlockObservations` swallows its own errors for the same
   * reason — a missing observation costs attribution, a failed sync costs a double booking.
   */
  if (observations.length) {
    await recordOtaBlockObservations(observations, capturedAt);
  }

  return result;
}
