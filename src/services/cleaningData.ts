// src/services/cleaningData.ts
// Reads what the cleaning messages and the cleaning watch work from: a property's stays (with the
// agreed arrival/departure times), the nights an OTA calendar blocks, and the standard times.
// Shared by /api/automation (the cleaner's messages) and the cleaning watch, so both see the same.

import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { addDays, type CleaningStay } from '@/lib/cleaning-schedule';
import { resolvePropertyTime } from '@/lib/dates/property-times';
import type { StandardTimes } from '@/lib/cleaning-watch';

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    const v = value as { toDate?: () => Date; _seconds?: number };
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v._seconds === 'number') return new Date(v._seconds * 1000);
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Every active stay of the property, and the OTA-blocked nights from a month before `fromYmd` to
 * the day after `toYmd`. A month back covers an unentered reservation that started before the period.
 */
export async function loadCleaningInputs(propertyId: string, fromYmd: string, toYmd: string) {
  const db = await getAdminDb();
  const snap = await db.collection('bookings')
    .where('propertyId', '==', propertyId)
    .where('status', 'in', ['confirmed', 'completed', 'on-hold'])
    .get();
  const stays: CleaningStay[] = [];
  snap.forEach(doc => {
    const b = doc.data();
    const checkIn = toDate(b.checkInDate);
    const checkOut = toDate(b.checkOutDate);
    if (!checkIn || !checkOut) return;
    stays.push({
      checkIn,
      checkOut,
      guests: b.numberOfGuests,
      adults: b.numberOfAdults,
      children: b.numberOfChildren,
      arrivalTime: b.arrivalTime,
      departureTime: b.departureTime,
    });
  });

  const monthKeys = new Set<string>();
  for (let day = addDays(fromYmd, -31); day <= addDays(toYmd, 1); day = addDays(day, 1)) monthKeys.add(day.slice(0, 7));
  const otaBlockedNights: string[] = [];
  for (const monthKey of monthKeys) {
    const doc = await db.collection('availability').doc(`${propertyId}_${monthKey}`).get();
    const externalBlocks = (doc.exists ? doc.data()?.externalBlocks : null) || {};
    for (const day of Object.keys(externalBlocks)) otaBlockedNights.push(`${monthKey}-${day.padStart(2, '0')}`);
  }
  return { stays, otaBlockedNights };
}

/** The property's standard check-in / check-out as "HH:MM". */
export async function loadStandardTimes(propertyId: string): Promise<StandardTimes> {
  const db = await getAdminDb();
  const property = (await db.collection('properties').doc(propertyId).get()).data() || null;
  const hm = (t: { hours: number; minutes: number }) => `${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}`;
  return {
    checkIn: hm(resolvePropertyTime(property, 'checkin')),
    checkOut: hm(resolvePropertyTime(property, 'checkout')),
  };
}
