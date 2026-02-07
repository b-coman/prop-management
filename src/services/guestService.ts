'use server';

import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { Booking, Guest, CurrencyCode, LanguageCode } from '@/types';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { normalizePhone } from '@/lib/sanitize';

const logger = loggers.guest;

/**
 * Parse a Firestore date field that may be Timestamp, {_seconds}, Date, or string.
 */
function parseFirestoreDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (raw instanceof AdminTimestamp) return raw.toDate();
  if (typeof raw === 'object' && raw !== null && '_seconds' in raw) {
    return new Date((raw as { _seconds: number })._seconds * 1000);
  }
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Find a guest by normalized phone number.
 */
export async function findGuestByPhone(phone: string): Promise<Guest | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  try {
    const db = await getAdminDb();
    const snapshot = await db
      .collection('guests')
      .where('normalizedPhone', '==', normalized)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Guest;
  } catch (error) {
    logger.error('Error finding guest by phone', error as Error, { phone: normalized });
    return null;
  }
}

/**
 * Upsert a guest record from a booking.
 * Deduplicates by: 1) normalized email, 2) normalized phone (fallback).
 * Creates or updates aggregates.
 * Will NOT overwrite unsubscribed: true on existing records.
 */
export async function upsertGuestFromBooking(booking: Booking): Promise<string | null> {
  const email = booking.guestInfo?.email?.toLowerCase().trim() || undefined;
  const phone = booking.guestInfo?.phone || undefined;
  const normalized = phone ? normalizePhone(phone) : undefined;

  if (!email && !phone) {
    logger.warn('Cannot upsert guest: no email or phone on booking', { bookingId: booking.id });
    return null;
  }

  try {
    const db = await getAdminDb();
    const guestsRef = db.collection('guests');

    // Layered dedup: email first, then phone
    let existingSnap = null;
    if (email) {
      const snap = await guestsRef.where('email', '==', email).limit(1).get();
      if (!snap.empty) existingSnap = snap;
    }
    if (!existingSnap && normalized) {
      const snap = await guestsRef.where('normalizedPhone', '==', normalized).limit(1).get();
      if (!snap.empty) existingSnap = snap;
    }

    const bookingDate = parseFirestoreDate(booking.createdAt) || new Date();
    const checkOutDate = parseFirestoreDate(booking.checkOutDate);
    const total = booking.pricing?.total || 0;
    const currency = booking.pricing?.currency || 'RON';
    const language = booking.language || 'en';
    const source = booking.source || undefined;

    if (existingSnap) {
      // Update existing guest
      const guestDoc = existingSnap.docs[0];
      const guestData = guestDoc.data();

      const updateData: Record<string, unknown> = {
        bookingIds: FieldValue.arrayUnion(booking.id),
        propertyIds: FieldValue.arrayUnion(booking.propertyId),
        totalBookings: FieldValue.increment(1),
        totalSpent: FieldValue.increment(total),
        lastBookingDate: bookingDate,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Fill in missing fields (don't overwrite existing)
      if (!guestData.firstName && booking.guestInfo.firstName) {
        updateData.firstName = booking.guestInfo.firstName;
      }
      if (!guestData.lastName && booking.guestInfo.lastName) {
        updateData.lastName = booking.guestInfo.lastName;
      }
      if (!guestData.phone && phone) {
        updateData.phone = phone;
      }
      if (!guestData.normalizedPhone && normalized) {
        updateData.normalizedPhone = normalized;
      }
      // Fill in email if guest didn't have one (e.g., imported guest later books directly)
      if (!guestData.email && email) {
        updateData.email = email;
      }

      // Track booking sources
      if (source) {
        updateData.sources = FieldValue.arrayUnion(source);
      }

      // Update lastStayDate if this booking is completed
      if (booking.status === 'completed' && checkOutDate) {
        updateData.lastStayDate = checkOutDate;
      }

      // Do NOT overwrite unsubscribed: true
      // (we simply don't touch the unsubscribed field on update)

      await guestDoc.ref.update(updateData);
      logger.info('Updated existing guest', { guestId: guestDoc.id, email, phone: normalized, bookingId: booking.id });
      return guestDoc.id;
    } else {
      // Create new guest
      const newGuest: Record<string, unknown> = {
        firstName: booking.guestInfo.firstName || '',
        lastName: booking.guestInfo.lastName || undefined,
        language: language as LanguageCode,
        bookingIds: [booking.id],
        propertyIds: [booking.propertyId],
        totalBookings: 1,
        totalSpent: total,
        currency: currency as CurrencyCode,
        firstBookingDate: bookingDate,
        lastBookingDate: bookingDate,
        lastStayDate: booking.status === 'completed' && checkOutDate ? checkOutDate : undefined,
        reviewSubmitted: false,
        tags: [],
        unsubscribed: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Only set fields that have values
      if (email) newGuest.email = email;
      if (phone) newGuest.phone = phone;
      if (normalized) newGuest.normalizedPhone = normalized;
      if (source) newGuest.sources = [source];

      const docRef = await guestsRef.add(newGuest);
      logger.info('Created new guest', { guestId: docRef.id, email, phone: normalized, bookingId: booking.id });
      return docRef.id;
    }
  } catch (error) {
    logger.error('Error upserting guest from booking', error as Error, {
      bookingId: booking.id,
      email,
    });
    return null;
  }
}

/**
 * Find a guest by email address.
 */
export async function findGuestByEmail(email: string): Promise<Guest | null> {
  try {
    const db = await getAdminDb();
    const snapshot = await db
      .collection('guests')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Guest;
  } catch (error) {
    logger.error('Error finding guest by email', error as Error, { email });
    return null;
  }
}

/**
 * Get a guest by document ID.
 */
export async function getGuestById(guestId: string): Promise<Guest | null> {
  try {
    const db = await getAdminDb();
    const doc = await db.collection('guests').doc(guestId).get();

    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Guest;
  } catch (error) {
    logger.error('Error getting guest by ID', error as Error, { guestId });
    return null;
  }
}

/**
 * Fetch all guests. Uses convertTimestampsToISOStrings for serialization.
 */
export async function fetchAllGuests(): Promise<Guest[]> {
  try {
    const { convertTimestampsToISOStrings } = await import('@/lib/utils');
    const db = await getAdminDb();
    const snapshot = await db
      .collection('guests')
      .orderBy('lastBookingDate', 'desc')
      .get();

    return snapshot.docs.map((doc) =>
      convertTimestampsToISOStrings({ id: doc.id, ...doc.data() }) as Guest
    );
  } catch (error) {
    logger.error('Error fetching all guests', error as Error);
    return [];
  }
}

/**
 * Update guest tags.
 */
export async function updateGuestTags(guestId: string, tags: string[]): Promise<void> {
  try {
    const db = await getAdminDb();
    await db.collection('guests').doc(guestId).update({
      tags,
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info('Updated guest tags', { guestId, tags });
  } catch (error) {
    logger.error('Error updating guest tags', error as Error, { guestId });
    throw error;
  }
}

/**
 * Set guest unsubscribe status.
 */
export async function setGuestUnsubscribed(email: string, unsubscribed: boolean): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const db = await getAdminDb();
    const snapshot = await db
      .collection('guests')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    if (snapshot.empty) {
      // Create a minimal guest record for the unsubscribe
      await db.collection('guests').add({
        email: normalizedEmail,
        firstName: '',
        language: 'en',
        bookingIds: [],
        propertyIds: [],
        totalBookings: 0,
        totalSpent: 0,
        currency: 'EUR',
        firstBookingDate: FieldValue.serverTimestamp(),
        lastBookingDate: FieldValue.serverTimestamp(),
        reviewSubmitted: false,
        tags: [],
        unsubscribed,
        unsubscribedAt: unsubscribed ? FieldValue.serverTimestamp() : null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      logger.info('Created minimal guest record for unsubscribe', { email: normalizedEmail });
    } else {
      const guestDoc = snapshot.docs[0];
      await guestDoc.ref.update({
        unsubscribed,
        unsubscribedAt: unsubscribed ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      logger.info('Updated guest unsubscribe status', { guestId: guestDoc.id, unsubscribed });
    }
  } catch (error) {
    logger.error('Error setting guest unsubscribed', error as Error, { email: normalizedEmail });
    throw error;
  }
}

/**
 * Check if a guest email is unsubscribed.
 */
export async function isGuestUnsubscribed(email: string): Promise<boolean> {
  try {
    const guest = await findGuestByEmail(email);
    return guest?.unsubscribed === true;
  } catch (error) {
    logger.error('Error checking guest unsubscribed', error as Error, { email });
    return false;
  }
}

/**
 * Backfill guests from all confirmed/completed bookings.
 * Idempotent — safe to run multiple times.
 */
export async function backfillGuestsFromBookings(): Promise<{ processed: number; created: number; updated: number }> {
  logger.info('Starting guest backfill from bookings');
  const db = await getAdminDb();

  let processed = 0;
  let created = 0;
  let updated = 0;

  // Query confirmed and completed bookings
  const statuses = ['confirmed', 'completed'];
  for (const status of statuses) {
    const snapshot = await db
      .collection('bookings')
      .where('status', '==', status)
      .get();

    for (const doc of snapshot.docs) {
      const booking = { id: doc.id, ...doc.data() } as Booking;
      processed++;

      const email = booking.guestInfo?.email?.toLowerCase().trim();
      const phone = booking.guestInfo?.phone;

      // Need at least email or phone to identify a guest
      if (!email && !phone) continue;

      // Check if guest already has this booking (by email or phone)
      let existingGuest: Guest | null = null;
      if (email) {
        existingGuest = await findGuestByEmail(email);
      }
      if (!existingGuest && phone) {
        existingGuest = await findGuestByPhone(phone);
      }
      if (existingGuest?.bookingIds?.includes(booking.id)) {
        continue; // Already processed
      }

      const guestId = await upsertGuestFromBooking(booking);
      if (guestId) {
        if (existingGuest) {
          updated++;
        } else {
          created++;
        }
      }
    }
  }

  logger.info('Guest backfill completed', { processed, created, updated });
  return { processed, created, updated };
}
