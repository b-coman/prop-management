'use server';

import { z } from 'zod';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import type { Guest, Booking } from '@/types';
import {
  requireAdmin,
  requireSuperAdmin,
  handleAuthError,
  AuthorizationError,
  requirePropertyAccess,
} from '@/lib/authorization';
import { revalidatePath } from 'next/cache';

const logger = loggers.guest;

export async function fetchGuestsAction(): Promise<Guest[]> {
  try {
    const user = await requireAdmin();
    const db = await getAdminDb();
    const snapshot = await db
      .collection('guests')
      .orderBy('lastBookingDate', 'desc')
      .get();

    const allGuests: Guest[] = snapshot.docs.map((doc) =>
      convertTimestampsToISOStrings({ id: doc.id, ...doc.data() }) as Guest
    );

    if (user.role === 'super_admin') {
      return allGuests;
    }

    // Filter by property access
    return allGuests.filter((g) =>
      g.propertyIds?.some((pid) => user.managedProperties.includes(pid))
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchGuestsAction');
      return [];
    }
    logger.error('Error fetching guests', error as Error);
    return [];
  }
}

const updateTagsSchema = z.object({
  guestId: z.string().min(1),
  tags: z.array(z.string()),
});

export async function updateGuestTagsAction(
  guestId: string,
  tags: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }

  const parsed = updateTagsSchema.safeParse({ guestId, tags });
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' };
  }

  try {
    const db = await getAdminDb();
    const docRef = db.collection('guests').doc(parsed.data.guestId);
    const existing = await docRef.get();

    if (!existing.exists) {
      return { success: false, error: 'Guest not found.' };
    }

    await docRef.update({
      tags: parsed.data.tags,
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath('/admin/guests');
    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    logger.error('Error updating guest tags', error as Error, { guestId });
    return { success: false, error: 'Failed to update tags.' };
  }
}

export async function fetchGuestDetailAction(
  guestId: string
): Promise<{ guest: Guest; bookings: Booking[] } | null> {
  try {
    await requireAdmin();
    const db = await getAdminDb();

    const guestDoc = await db.collection('guests').doc(guestId).get();
    if (!guestDoc.exists) return null;

    const guest = convertTimestampsToISOStrings({
      id: guestDoc.id,
      ...guestDoc.data(),
    }) as Guest;

    // Fetch associated bookings
    let bookings: Booking[] = [];
    if (guest.bookingIds && guest.bookingIds.length > 0) {
      // Fetch in batches of 10 (Firestore 'in' limit for arrays)
      const batchSize = 10;
      for (let i = 0; i < guest.bookingIds.length; i += batchSize) {
        const batch = guest.bookingIds.slice(i, i + batchSize);
        const batchDocs = await Promise.all(
          batch.map((bid) => db.collection('bookings').doc(bid).get())
        );
        for (const bDoc of batchDocs) {
          if (bDoc.exists) {
            bookings.push(
              convertTimestampsToISOStrings({
                id: bDoc.id,
                ...bDoc.data(),
              }) as Booking
            );
          }
        }
      }
    }

    return { guest, bookings };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchGuestDetailAction');
      return null;
    }
    logger.error('Error fetching guest detail', error as Error, { guestId });
    return null;
  }
}

export async function checkIsSuperAdmin(): Promise<boolean> {
  try {
    const user = await requireAdmin();
    return user.role === 'super_admin';
  } catch {
    return false;
  }
}

export async function backfillGuestsAction(): Promise<{
  success: boolean;
  processed?: number;
  created?: number;
  updated?: number;
  error?: string;
}> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      const authErr = handleAuthError(error);
      return { success: false, error: authErr.error };
    }
    throw error;
  }

  try {
    const { backfillGuestsFromBookings } = await import('@/services/guestService');
    const result = await backfillGuestsFromBookings();
    revalidatePath('/admin/guests');
    return { success: true, ...result };
  } catch (error) {
    logger.error('Error during guest backfill', error as Error);
    return { success: false, error: 'Backfill failed.' };
  }
}
