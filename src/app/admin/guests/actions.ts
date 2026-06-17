'use server';

import { z } from 'zod';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { normalizePhone } from '@/lib/sanitize';
import { normalizeCountryCode } from '@/lib/country-utils';
import type { Guest, Booking } from '@/types';
import {
  requireAdmin,
  requireSuperAdmin,
  handleAuthError,
  AuthorizationError,
  requirePropertyAccess,
} from '@/lib/authorization';
import {
  isRomanian,
  normalizeRoPhone,
  type ReengagementContact,
} from '@/lib/guest-reengagement';
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

const updateContactSchema = z.object({
  guestId: z.string().min(1),
  email: z.string().email().or(z.literal('')).optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  language: z.enum(['en', 'ro']),
});

export async function updateGuestContactAction(
  guestId: string,
  data: { email?: string; phone?: string; country?: string; language: 'en' | 'ro' }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }

  const parsed = updateContactSchema.safeParse({ guestId, ...data });
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

    const updates: Record<string, unknown> = {
      language: parsed.data.language,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Email: normalize or set null
    const emailVal = parsed.data.email?.trim().toLowerCase();
    updates.email = emailVal || null;

    // Phone: normalize or set null
    const rawPhone = parsed.data.phone?.trim();
    if (rawPhone) {
      const normalized = normalizePhone(rawPhone);
      updates.phone = rawPhone;
      updates.normalizedPhone = normalized || null;
    } else {
      updates.phone = null;
      updates.normalizedPhone = null;
    }

    // Country: normalize or set null
    const rawCountry = parsed.data.country?.trim();
    if (rawCountry) {
      updates.country = normalizeCountryCode(rawCountry) || rawCountry;
    } else {
      updates.country = null;
    }

    await docRef.update(updates);

    revalidatePath('/admin/guests');
    revalidatePath(`/admin/guests/${guestId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    logger.error('Error updating guest contact', error as Error, { guestId });
    return { success: false, error: 'Failed to update contact info.' };
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

/** Parse a Firestore date field (admin Timestamp | {_seconds} | Date | ISO string). */
function parseBookingDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as { toDate?: () => Date; _seconds?: number };
    if (typeof o.toDate === 'function') return o.toDate();
    if (typeof o._seconds === 'number') return new Date(o._seconds * 1000);
  }
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Build the re-engagement contact list for a property: past (non-cancelled) bookings whose
 * guest is Romanian and has a phone, deduped to the most recent stay per phone, excluding
 * anyone marked unsubscribed in the guests CRM. Returns raw contacts + the branded guest
 * calendar link; the message text is composed client-side so the admin can edit it per send.
 */
export async function fetchReengagementContactsAction(propertyId: string): Promise<{
  success: boolean;
  contacts?: ReengagementContact[];
  unsubscribedExcluded?: number;
  noPhoneExcluded?: number;
  calendarLink?: string | null;
  error?: string;
}> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      const e = handleAuthError(error);
      return { success: false, error: e.error };
    }
    throw error;
  }

  try {
    const db = await getAdminDb();

    // Unsubscribed contacts (by normalized phone + email) — to be excluded for compliance.
    const unsubSnap = await db.collection('guests').where('unsubscribed', '==', true).get();
    const unsubPhones = new Set<string>();
    const unsubEmails = new Set<string>();
    unsubSnap.forEach((doc) => {
      const g = doc.data();
      if (g.normalizedPhone) unsubPhones.add(g.normalizedPhone);
      if (g.phone) { const n = normalizePhone(g.phone); if (n) unsubPhones.add(n); }
      if (g.email) unsubEmails.add(String(g.email).toLowerCase().trim());
    });

    const snap = await db.collection('bookings').where('propertyId', '==', propertyId).get();
    const todayStr = new Date().toISOString().slice(0, 10);

    type Rec = ReengagementContact & { key: string; t: number };
    const candidates: Rec[] = [];
    const unsubExcludedKeys = new Set<string>();
    let noPhoneExcluded = 0;

    snap.forEach((doc) => {
      const d = doc.data();
      if (d.status === 'cancelled') return;
      const gi = d.guestInfo || {};
      const rawPhone = (gi.phone || '').trim();
      if (!isRomanian(gi.country, rawPhone)) return;
      if (!rawPhone) { noPhoneExcluded++; return; }

      const sanitized = normalizePhone(rawPhone);
      const emailKey = (gi.email || '').toLowerCase().trim();
      if ((sanitized && unsubPhones.has(sanitized)) || (emailKey && unsubEmails.has(emailKey))) {
        unsubExcludedKeys.add(sanitized || emailKey);
        return;
      }

      const checkIn = parseBookingDate(d.checkInDate);
      const ci = checkIn ? checkIn.toISOString().slice(0, 10) : '';
      if (!ci || ci > todayStr) return; // PAST stays only

      const { norm } = normalizeRoPhone(rawPhone);
      candidates.push({
        firstName: (gi.firstName || '').trim(),
        lastName: (gi.lastName || '').trim(),
        lastCheckIn: ci,
        phone: rawPhone,
        key: norm || `${(gi.firstName || '').toLowerCase()}|${(gi.lastName || '').toLowerCase()}`,
        t: checkIn!.getTime(),
      });
    });

    // Dedup by phone identity, keep most recent past stay
    const byKey = new Map<string, Rec>();
    for (const r of candidates) {
      const e = byKey.get(r.key);
      if (!e || r.t >= e.t) byKey.set(r.key, r);
    }
    const contacts: ReengagementContact[] = [...byKey.values()]
      .sort((a, b) => b.t - a.t)
      .map(({ firstName, lastName, lastCheckIn, phone }) => ({ firstName, lastName, lastCheckIn, phone }));

    // Branded guest calendar link from the property's custom domain (multi-property safe)
    const propDoc = await db.collection('properties').doc(propertyId).get();
    const p = propDoc.data() || {};
    const token = p.guestCalendarToken;
    let calendarLink: string | null = null;
    if (token) {
      const base = p.useCustomDomain && p.customDomain ? `https://${p.customDomain}` : '';
      calendarLink = `${base}/calendar/${token}`;
    }

    return {
      success: true,
      contacts,
      unsubscribedExcluded: unsubExcludedKeys.size,
      noPhoneExcluded,
      calendarLink,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      const e = handleAuthError(error);
      return { success: false, error: e.error };
    }
    logger.error('Error fetching re-engagement contacts', error as Error, { propertyId });
    return { success: false, error: 'Failed to load contacts.' };
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
