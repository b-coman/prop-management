'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getAdminDb, FieldValue, FieldPath, Timestamp } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { randomUUID } from 'crypto';
import type { ICalFeed, SerializableTimestamp } from '@/types';
import type { MonthAvailabilityData, AvailabilityDayData, DayStatus } from './_lib/availability-types';
import { fetchAndParseICalFeed, syncFeedToAvailability } from '@/lib/ical/ical-import';
import { getDaysInMonth, parseISO } from 'date-fns';

const logger = loggers.icalSync;
const availLogger = loggers.availability;

// ============================================================================
// Zod Schemas
// ============================================================================

const addFeedSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  name: z.string().min(1, 'Name is required').max(100),
  url: z.string().url('Must be a valid URL').max(2048),
});

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
    // Query by doc ID prefix — some docs may lack a propertyId field
    const docIdPrefix = `${propertyId}_`;
    const availSnapshot = await db.collection('availability')
      .where(FieldPath.documentId(), '>=', docIdPrefix)
      .where(FieldPath.documentId(), '<', docIdPrefix + '\uf8ff')
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

// ============================================================================
// Manual Sync Trigger
// ============================================================================

export async function triggerManualSync(feedId: string): Promise<{
  error?: string;
  datesBlocked?: number;
  datesReleased?: number;
  eventsFound?: number;
}> {
  try {
    const db = await getAdminDb();
    const feedRef = db.collection('icalFeeds').doc(feedId);
    const feedDoc = await feedRef.get();

    if (!feedDoc.exists) {
      return { error: 'Feed not found' };
    }

    const feedData = feedDoc.data()!;
    await requirePropertyAccess(feedData.propertyId);

    const feed: ICalFeed = { id: feedDoc.id, ...feedData } as ICalFeed;

    logger.info('Manual sync triggered', { feedId, feedName: feed.name });

    // Fetch and parse the feed
    const events = await fetchAndParseICalFeed(feed.url);

    // Sync to availability
    const result = await syncFeedToAvailability(db, feed, events);

    // Update feed status
    await feedRef.update({
      lastSyncAt: FieldValue.serverTimestamp(),
      lastSyncStatus: 'success',
      lastSyncError: null,
      lastSyncEventsCount: result.eventsFound,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Manual sync completed', {
      feedId,
      eventsFound: result.eventsFound,
      datesBlocked: result.datesBlocked,
      datesReleased: result.datesReleased,
    });

    revalidatePath('/admin/calendar');
    return {
      eventsFound: result.eventsFound,
      datesBlocked: result.datesBlocked,
      datesReleased: result.datesReleased,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message };
    }

    // Update feed with error status
    try {
      const db = await getAdminDb();
      await db.collection('icalFeeds').doc(feedId).update({
        lastSyncAt: FieldValue.serverTimestamp(),
        lastSyncStatus: 'error',
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch {
      // Best effort
    }

    logger.error('Manual sync failed', error as Error, { feedId });
    revalidatePath('/admin/calendar');
    return { error: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// ============================================================================
// Availability Calendar Data
// ============================================================================

const toDate = (timestamp: SerializableTimestamp | undefined | null): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  if (typeof timestamp === 'string') {
    try { return parseISO(timestamp); } catch { return null; }
  }
  if (typeof timestamp === 'number') return new Date(timestamp);
  if (typeof timestamp === 'object' && '_seconds' in timestamp) {
    return new Date((timestamp as any)._seconds * 1000);
  }
  return null;
};

export async function fetchAvailabilityCalendarData(
  propertyId: string,
  yearMonth: string
): Promise<MonthAvailabilityData> {
  await requirePropertyAccess(propertyId);
  const db = await getAdminDb();

  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));

  // 1. Fetch availability doc
  const availDocId = `${propertyId}_${yearMonth}`;
  const availDoc = await db.collection('availability').doc(availDocId).get();
  const availData = availDoc.exists ? availDoc.data() : null;

  const availableMap: Record<number, boolean> = availData?.available || {};
  const holdsMap: Record<number, string | null> = availData?.holds || {};
  const externalBlocksMap: Record<number, string | null> = availData?.externalBlocks || {};

  // 2. Fetch non-cancelled bookings overlapping this month
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59); // last day of month

  const bookingsSnapshot = await db.collection('bookings')
    .where('propertyId', '==', propertyId)
    .where('status', 'in', ['confirmed', 'completed', 'on-hold'])
    .get();

  // Build a map: day number -> booking data (for bookings overlapping this month)
  const bookingsByDay: Record<number, { id: string; guestName: string; checkIn: string; checkOut: string; source?: string; status: string; holdUntil?: string }> = {};

  for (const doc of bookingsSnapshot.docs) {
    const data = doc.data();
    const checkIn = toDate(data.checkInDate);
    const checkOut = toDate(data.checkOutDate);
    if (!checkIn || !checkOut) continue;

    // Check if booking overlaps with this month
    // Booking occupies nights from checkIn to checkOut-1
    // Use < instead of <= so checkouts on the 1st are included for tail detection
    if (checkOut < monthStart || checkIn > monthEnd) continue;

    const guestName = [data.guestInfo?.firstName, data.guestInfo?.lastName].filter(Boolean).join(' ') || 'Unknown';
    const holdUntilDate = toDate(data.holdUntil);

    // Mark each occupied day in this month
    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(year, month - 1, d);
      // A booking occupies the night of checkIn through the night before checkOut
      if (dayDate >= checkIn && dayDate < checkOut) {
        bookingsByDay[d] = {
          id: doc.id,
          guestName,
          checkIn: checkIn.toISOString().split('T')[0],
          checkOut: checkOut.toISOString().split('T')[0],
          source: data.source,
          status: data.status,
          holdUntil: holdUntilDate ? holdUntilDate.toISOString() : undefined,
        };
      }
    }
  }

  // 3. Fetch iCal feeds for this property (to resolve feedId -> name)
  const feedsSnapshot = await db.collection('icalFeeds')
    .where('propertyId', '==', propertyId)
    .get();
  const feedNames: Record<string, string> = {};
  for (const doc of feedsSnapshot.docs) {
    feedNames[doc.id] = doc.data().name || 'External';
  }

  // 4. Fetch price calendar + property currency
  const priceDocId = `${propertyId}_${yearMonth}`;
  const [priceDoc, propertyDoc] = await Promise.all([
    db.collection('priceCalendars').doc(priceDocId).get(),
    db.collection('properties').doc(propertyId).get(),
  ]);
  const priceData = priceDoc.exists ? priceDoc.data() : null;
  const currency = propertyDoc.data()?.baseCurrency || 'EUR';

  // 4. Build day data using resolution logic
  const days: Record<number, AvailabilityDayData> = {};
  const summary = { available: 0, booked: 0, onHold: 0, externallyBlocked: 0, manuallyBlocked: 0 };

  for (let d = 1; d <= daysInMonth; d++) {
    let status: DayStatus;
    let dayData: AvailabilityDayData = { day: d, status: 'available' };

    if (holdsMap[d]) {
      // Priority 1: on-hold
      status = 'on-hold';
      const booking = bookingsByDay[d];
      if (booking) {
        dayData = { day: d, status, bookingId: booking.id, bookingDetails: booking };
      } else {
        dayData = { day: d, status, bookingId: holdsMap[d] || undefined };
      }
      summary.onHold++;
    } else if (availableMap[d] === false && bookingsByDay[d]) {
      // Priority 2: booked (confirmed/completed) — wins over external blocks
      status = 'booked';
      const booking = bookingsByDay[d];
      dayData = { day: d, status, bookingId: booking.id, bookingDetails: booking };
      summary.booked++;
    } else if (availableMap[d] === false && externalBlocksMap[d]) {
      // Priority 3: external block
      status = 'external-block';
      const feedName = feedNames[externalBlocksMap[d] as string] || 'External';
      dayData = { day: d, status, externalFeedName: feedName };
      summary.externallyBlocked++;
    } else if (availableMap[d] === false) {
      // Priority 4: manual block
      status = 'manual-block';
      dayData = { day: d, status };
      summary.manuallyBlocked++;
    } else {
      // Priority 5: available
      status = 'available';
      dayData = { day: d, status };
      summary.available++;
    }

    // Attach price from price calendar
    if (priceData?.days?.[String(d)]) {
      dayData.price = priceData.days[String(d)].adjustedPrice;
    }

    days[d] = dayData;
  }

  // Compute booking bar positions
  for (let d = 1; d <= daysInMonth; d++) {
    const dayEntry = days[d];
    if (!dayEntry) continue;
    if (dayEntry.status !== 'booked' && dayEntry.status !== 'on-hold') continue;

    const booking = dayEntry.bookingDetails || bookingsByDay[d];
    if (!booking) continue;

    const [ciY, ciM, ciD] = booking.checkIn.split('-').map(Number);
    const checkInDay = new Date(ciY, ciM - 1, ciD);
    const [coY, coM, coD] = booking.checkOut.split('-').map(Number);
    const lastNight = new Date(coY, coM - 1, coD);
    lastNight.setDate(lastNight.getDate() - 1);

    const dayDate = new Date(year, month - 1, d);
    const isCheckIn = dayDate.getTime() === checkInDay.getTime();
    const isLastNight = dayDate.getTime() === lastNight.getTime();

    if (isCheckIn && isLastNight) {
      dayEntry.bookingPosition = 'single';
    } else if (isCheckIn) {
      dayEntry.bookingPosition = 'start';
    } else if (isLastNight) {
      dayEntry.bookingPosition = 'end';
    } else {
      dayEntry.bookingPosition = 'middle';
    }
  }

  // Compute checkout tails
  for (const doc of bookingsSnapshot.docs) {
    const data = doc.data();
    const checkOut = toDate(data.checkOutDate);
    if (!checkOut) continue;

    const coYear = checkOut.getFullYear();
    const coMonth = checkOut.getMonth(); // 0-based
    if (coYear !== year || coMonth !== month - 1) continue;

    const checkoutDay = checkOut.getDate();
    if (checkoutDay < 1 || checkoutDay > daysInMonth) continue;

    // Skip if checkout day is itself a booked night (back-to-back)
    if (days[checkoutDay]?.status === 'booked' || days[checkoutDay]?.status === 'on-hold') continue;

    const guestName = [data.guestInfo?.firstName, data.guestInfo?.lastName].filter(Boolean).join(' ') || 'Unknown';
    const barColor = data.status === 'on-hold' ? 'amber' as const : 'emerald' as const;

    if (days[checkoutDay]) {
      days[checkoutDay].checkoutBooking = {
        bookingId: doc.id,
        guestName,
        source: data.source,
        barColor,
      };
    }
  }

  // Compute price range for color coding
  const prices = Object.values(days).map(d => d.price).filter((p): p is number => p != null);
  const priceRange = prices.length > 0
    ? { min: Math.min(...prices), max: Math.max(...prices) }
    : undefined;

  return {
    propertyId,
    month: yearMonth,
    days,
    summary,
    currency,
    priceRange,
  };
}

export async function toggleDateBlocked(
  propertyId: string,
  yearMonth: string,
  day: number,
  block: boolean
): Promise<{ error?: string }> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();
    const docId = `${propertyId}_${yearMonth}`;
    const docRef = db.collection('availability').doc(docId);
    const doc = await docRef.get();

    if (!block) {
      // Unblocking: guard against holds, external blocks, and active bookings
      if (doc.exists) {
        const data = doc.data()!;
        if (data.holds?.[day]) {
          return { error: 'Cannot unblock a day with an active hold' };
        }
        if (data.externalBlocks?.[day]) {
          return { error: 'Cannot unblock a day blocked by an external calendar' };
        }
      }

      // Check for active bookings on this day
      const [year, month] = yearMonth.split('-').map(Number);
      const dayDate = new Date(year, month - 1, day);
      const bookingsSnapshot = await db.collection('bookings')
        .where('propertyId', '==', propertyId)
        .where('status', 'in', ['confirmed', 'completed'])
        .get();

      for (const bookingDoc of bookingsSnapshot.docs) {
        const data = bookingDoc.data();
        const checkIn = toDate(data.checkInDate);
        const checkOut = toDate(data.checkOutDate);
        if (checkIn && checkOut && dayDate >= checkIn && dayDate < checkOut) {
          return { error: 'Cannot unblock a day with an active booking' };
        }
      }
    }

    if (doc.exists) {
      await docRef.update({
        [`available.${day}`]: !block,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Create the doc
      const [year, month] = yearMonth.split('-').map(Number);
      await docRef.set({
        propertyId,
        month: yearMonth,
        available: { [day]: !block },
        holds: {},
        externalBlocks: {},
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    availLogger.info('Date toggled', { propertyId, yearMonth, day, blocked: block });
    revalidatePath('/admin/calendar');
    return {};
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message };
    }
    availLogger.error('Error toggling date', error as Error, { propertyId, yearMonth, day });
    return { error: 'Failed to toggle date' };
  }
}

export async function toggleDateRangeBlocked(
  propertyId: string,
  dates: { yearMonth: string; day: number }[],
  block: boolean
): Promise<{ success: boolean; blockedCount: number; skippedCount: number; error?: string }> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    // Group dates by yearMonth
    const byMonth: Record<string, number[]> = {};
    for (const { yearMonth, day } of dates) {
      if (!byMonth[yearMonth]) byMonth[yearMonth] = [];
      byMonth[yearMonth].push(day);
    }

    // Fetch all relevant availability docs
    const monthKeys = Object.keys(byMonth);
    const availDocs: Record<string, FirebaseFirestore.DocumentSnapshot> = {};
    for (const ym of monthKeys) {
      const docId = `${propertyId}_${ym}`;
      availDocs[ym] = await db.collection('availability').doc(docId).get();
    }

    // If unblocking, fetch bookings to check conflicts
    let activeBookings: { checkIn: Date; checkOut: Date }[] = [];
    if (!block) {
      const bookingsSnapshot = await db.collection('bookings')
        .where('propertyId', '==', propertyId)
        .where('status', 'in', ['confirmed', 'completed'])
        .get();
      activeBookings = bookingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          checkIn: toDate(data.checkInDate)!,
          checkOut: toDate(data.checkOutDate)!,
        };
      }).filter(b => b.checkIn && b.checkOut);
    }

    const batch = db.batch();
    let blockedCount = 0;
    let skippedCount = 0;

    for (const ym of monthKeys) {
      const docId = `${propertyId}_${ym}`;
      const docRef = db.collection('availability').doc(docId);
      const doc = availDocs[ym];
      const existingData = doc.exists ? doc.data() : null;
      const [year, month] = ym.split('-').map(Number);

      const updates: Record<string, any> = {};

      for (const day of byMonth[ym]) {
        if (!block) {
          // Check guards for unblocking
          if (existingData?.holds?.[day]) { skippedCount++; continue; }
          if (existingData?.externalBlocks?.[day]) { skippedCount++; continue; }

          const dayDate = new Date(year, month - 1, day);
          const hasBooking = activeBookings.some(b => dayDate >= b.checkIn && dayDate < b.checkOut);
          if (hasBooking) { skippedCount++; continue; }
        }

        updates[`available.${day}`] = !block;
        blockedCount++;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = FieldValue.serverTimestamp();
        if (doc.exists) {
          batch.update(docRef, updates);
        } else {
          batch.set(docRef, {
            propertyId,
            month: ym,
            available: {},
            holds: {},
            externalBlocks: {},
            ...updates,
          });
        }
      }
    }

    await batch.commit();

    availLogger.info('Date range toggled', { propertyId, blockedCount, skippedCount, block });
    revalidatePath('/admin/calendar');
    return { success: true, blockedCount, skippedCount };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, blockedCount: 0, skippedCount: 0, error: error.message };
    }
    availLogger.error('Error toggling date range', error as Error, { propertyId });
    return { success: false, blockedCount: 0, skippedCount: 0, error: 'Failed to toggle dates' };
  }
}
