'use server';

import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { loggers } from '@/lib/logger';
import type { HousekeepingContact, HousekeepingMessage } from '@/types';

const logger = loggers.housekeeping;

// ============================================================================
// Property name helper
// ============================================================================

async function getPropertyName(propertyId: string): Promise<string> {
  try {
    const db = await getAdminDb();
    const doc = await db.collection('properties').doc(propertyId).get();
    if (!doc.exists) return propertyId;
    const name = doc.data()?.name;
    if (!name) return propertyId;
    if (typeof name === 'string') return name;
    return name.en || name.ro || propertyId;
  } catch {
    return propertyId;
  }
}

// ============================================================================
// Date helpers
// ============================================================================

function parseFirestoreDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof AdminTimestamp) return raw.toDate();
  if (typeof raw === 'object' && raw !== null && '_seconds' in raw) {
    return new Date((raw as { _seconds: number })._seconds * 1000);
  }
  if (typeof raw === 'string') return new Date(raw);
  if (raw instanceof Date) return raw;
  return null;
}

function formatDD_MM(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${d}.${m}`;
}

const ROMANIAN_MONTHS = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];

// ============================================================================
// Booking query
// ============================================================================

interface BookingInfo {
  id: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  numberOfAdults: number;
  numberOfChildren: number;
  propertyId: string;
  status: string;
}

async function getBookingsForProperty(
  propertyId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<BookingInfo[]> {
  const db = await getAdminDb();
  const snapshot = await db
    .collection('bookings')
    .where('propertyId', '==', propertyId)
    .where('status', 'in', ['confirmed', 'completed'])
    .get();

  const bookings: BookingInfo[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const checkIn = parseFirestoreDate(data.checkInDate);
    const checkOut = parseFirestoreDate(data.checkOutDate);
    if (!checkIn || !checkOut) continue;

    // Filter by date range if provided
    if (fromDate && checkOut <= fromDate) continue;
    if (toDate && checkIn > toDate) continue;

    const guestName = [data.guestInfo?.firstName, data.guestInfo?.lastName]
      .filter(Boolean)
      .join(' ') || 'Unknown';

    const numberOfAdults = data.numberOfAdults || data.numberOfGuests || 1;
    const numberOfChildren = data.numberOfChildren || 0;

    bookings.push({
      id: doc.id,
      guestName,
      checkIn,
      checkOut,
      numberOfAdults,
      numberOfChildren,
      propertyId,
      status: data.status,
    });
  }

  // Sort by check-in ascending
  bookings.sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
  return bookings;
}

// ============================================================================
// Guest count formatting
// ============================================================================

function formatGuestCount(adults: number, children: number, language: 'ro' | 'en'): string {
  if (language === 'ro') {
    let parts: string[] = [];
    if (adults === 1) {
      parts.push('1 adult');
    } else {
      parts.push(`${adults} adulti`);
    }
    if (children > 0) {
      if (children === 1) {
        parts.push('1 copil');
      } else {
        parts.push(`${children} copii`);
      }
    }
    return parts.join(', ');
  }

  // English
  let parts: string[] = [];
  parts.push(`${adults} adult${adults !== 1 ? 's' : ''}`);
  if (children > 0) {
    parts.push(`${children} child${children !== 1 ? 'ren' : ''}`);
  }
  return parts.join(', ');
}

// ============================================================================
// Message builders
// ============================================================================

export async function buildMonthlyScheduleMessage(
  propertyId: string,
  month: Date,
  language: 'ro' | 'en' = 'ro'
): Promise<string> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const propertyName = await getPropertyName(propertyId);
  const bookings = await getBookingsForProperty(propertyId, monthStart, monthEnd);
  const monthName = language === 'ro'
    ? ROMANIAN_MONTHS[monthIndex]
    : month.toLocaleString('en', { month: 'long' });

  const lines: string[] = [];
  lines.push(`[${propertyName}]`);

  if (language === 'ro') {
    lines.push(`Programul pentru luna ${monthName}:`);
    lines.push('');

    // Check if there's a current guest (checked in before today, checking out after today)
    const currentGuest = bookings.find(
      b => b.checkIn <= today && b.checkOut > today
    );
    if (currentGuest) {
      lines.push(
        `In prezent, ${currentGuest.guestName} este cazat pana pe ${formatDD_MM(currentGuest.checkOut)}.`
      );
      lines.push('');
    }

    // Upcoming bookings for this month
    const monthBookings = bookings.filter(
      b => b.checkIn >= monthStart && b.checkIn <= monthEnd
    );

    if (monthBookings.length > 0) {
      lines.push(`Rezervarile pentru luna ${monthName}:`);
      for (const b of monthBookings) {
        const guests = formatGuestCount(b.numberOfAdults, b.numberOfChildren, 'ro');
        lines.push(
          `${formatDD_MM(b.checkIn)} - ${formatDD_MM(b.checkOut)} / ${b.guestName} (${guests})`
        );
      }
    } else {
      lines.push(`Nu sunt rezervari in luna ${monthName}.`);
    }
  } else {
    lines.push(`Schedule for ${monthName}:`);
    lines.push('');

    const currentGuest = bookings.find(
      b => b.checkIn <= today && b.checkOut > today
    );
    if (currentGuest) {
      lines.push(
        `Currently, ${currentGuest.guestName} is staying until ${formatDD_MM(currentGuest.checkOut)}.`
      );
      lines.push('');
    }

    const monthBookings = bookings.filter(
      b => b.checkIn >= monthStart && b.checkIn <= monthEnd
    );

    if (monthBookings.length > 0) {
      lines.push(`Bookings for ${monthName}:`);
      for (const b of monthBookings) {
        const guests = formatGuestCount(b.numberOfAdults, b.numberOfChildren, 'en');
        lines.push(
          `${formatDD_MM(b.checkIn)} - ${formatDD_MM(b.checkOut)} / ${b.guestName} (${guests})`
        );
      }
    } else {
      lines.push(`No bookings for ${monthName}.`);
    }
  }

  return lines.join('\n');
}

export async function buildDailyNotificationMessage(
  propertyId: string,
  date: Date,
  language: 'ro' | 'en' = 'ro'
): Promise<string | null> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // Get bookings that have check-in or check-out on this date
  // We need a wider range to catch check-outs
  const rangeStart = new Date(dayStart);
  rangeStart.setDate(rangeStart.getDate() - 30);
  const rangeEnd = new Date(dayEnd);
  rangeEnd.setDate(rangeEnd.getDate() + 30);

  const bookings = await getBookingsForProperty(propertyId, rangeStart, rangeEnd);

  const checkOuts = bookings.filter(b => {
    const co = new Date(b.checkOut);
    co.setHours(0, 0, 0, 0);
    return co.getTime() === dayStart.getTime();
  });

  const checkIns = bookings.filter(b => {
    const ci = new Date(b.checkIn);
    ci.setHours(0, 0, 0, 0);
    return ci.getTime() === dayStart.getTime();
  });

  if (checkOuts.length === 0 && checkIns.length === 0) {
    return null; // Nothing happening today
  }

  const propertyName = await getPropertyName(propertyId);
  const dateStr = formatDD_MM(date);
  const parts: string[] = [`[${propertyName}]`];

  if (language === 'ro') {
    for (const co of checkOuts) {
      parts.push(`Azi, ${dateStr} pleaca ${co.guestName}.`);
    }
    for (const ci of checkIns) {
      const guests = formatGuestCount(ci.numberOfAdults, ci.numberOfChildren, 'ro');
      parts.push(
        `Azi, ${dateStr} vine ${ci.guestName} (${guests}), pana pe ${formatDD_MM(ci.checkOut)}.`
      );
    }
  } else {
    for (const co of checkOuts) {
      parts.push(`Today, ${dateStr} ${co.guestName} checks out.`);
    }
    for (const ci of checkIns) {
      const guests = formatGuestCount(ci.numberOfAdults, ci.numberOfChildren, 'en');
      parts.push(
        `Today, ${dateStr} ${ci.guestName} checks in (${guests}), until ${formatDD_MM(ci.checkOut)}.`
      );
    }
  }

  return parts.join('\n');
}

export async function buildChangeNotificationMessage(
  propertyId: string,
  bookingId: string,
  changeType: 'new' | 'cancelled',
  language: 'ro' | 'en' = 'ro'
): Promise<string | null> {
  const db = await getAdminDb();
  const bookingDoc = await db.collection('bookings').doc(bookingId).get();
  if (!bookingDoc.exists) return null;

  const data = bookingDoc.data()!;
  const checkIn = parseFirestoreDate(data.checkInDate);
  const checkOut = parseFirestoreDate(data.checkOutDate);
  if (!checkIn || !checkOut) return null;

  const propertyName = await getPropertyName(propertyId);
  const guestName = [data.guestInfo?.firstName, data.guestInfo?.lastName]
    .filter(Boolean)
    .join(' ') || 'Unknown';
  const adults = data.numberOfAdults || data.numberOfGuests || 1;
  const children = data.numberOfChildren || 0;
  const guests = formatGuestCount(adults, children, language);
  const prefix = `[${propertyName}]\n`;

  if (language === 'ro') {
    if (changeType === 'new') {
      return `${prefix}Rezervare noua: ${guestName} (${guests}), ${formatDD_MM(checkIn)} - ${formatDD_MM(checkOut)}.`;
    } else {
      return `${prefix}Rezervare anulata: ${guestName}, ${formatDD_MM(checkIn)} - ${formatDD_MM(checkOut)}.`;
    }
  } else {
    if (changeType === 'new') {
      return `${prefix}New booking: ${guestName} (${guests}), ${formatDD_MM(checkIn)} - ${formatDD_MM(checkOut)}.`;
    } else {
      return `${prefix}Booking cancelled: ${guestName}, ${formatDD_MM(checkIn)} - ${formatDD_MM(checkOut)}.`;
    }
  }
}

// ============================================================================
// Contact queries
// ============================================================================

export async function getEnabledContacts(
  propertyId: string,
  notificationType: 'notifyMonthly' | 'notifyDaily' | 'notifyChanges'
): Promise<HousekeepingContact[]> {
  const db = await getAdminDb();
  const snapshot = await db
    .collection('housekeepingContacts')
    .where('propertyId', '==', propertyId)
    .where('enabled', '==', true)
    .where(notificationType, '==', true)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as HousekeepingContact[];
}

export async function getPropertiesWithContacts(): Promise<string[]> {
  const db = await getAdminDb();
  const snapshot = await db
    .collection('housekeepingContacts')
    .where('enabled', '==', true)
    .get();

  const propertyIds = new Set<string>();
  for (const doc of snapshot.docs) {
    propertyIds.add(doc.data().propertyId);
  }
  return Array.from(propertyIds);
}

// ============================================================================
// Message logging
// ============================================================================

async function logMessage(
  message: Omit<HousekeepingMessage, 'id' | 'createdAt'>
): Promise<void> {
  try {
    const db = await getAdminDb();
    // Strip undefined values — Firestore rejects them
    const clean = Object.fromEntries(
      Object.entries(message).filter(([, v]) => v !== undefined)
    );
    await db.collection('housekeepingMessages').add({
      ...clean,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error('Failed to log housekeeping message', error as Error);
  }
}

// ============================================================================
// Sending functions
// ============================================================================

export async function sendMonthlyScheduleToProperty(
  propertyId: string,
  month?: Date
): Promise<{ sent: number; failed: number }> {
  const targetMonth = month || new Date();
  const contacts = await getEnabledContacts(propertyId, 'notifyMonthly');

  if (contacts.length === 0) {
    logger.info('No monthly contacts for property', { propertyId });
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    const messageBody = await buildMonthlyScheduleMessage(
      propertyId,
      targetMonth,
      contact.language
    );

    const { sendWhatsAppMessage } = await import('@/services/whatsappService');
    const result = await sendWhatsAppMessage(contact.phone, messageBody);

    await logMessage({
      propertyId,
      contactId: contact.id,
      contactName: contact.name,
      contactPhone: contact.phone,
      type: 'monthly',
      messageBody,
      twilioSid: result.sid,
      status: result.success ? 'sent' : 'failed',
      error: result.error,
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  logger.info('Monthly schedule sent', { propertyId, sent, failed });
  return { sent, failed };
}

export async function sendDailyNotificationToProperty(
  propertyId: string,
  date?: Date
): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const targetDate = date || new Date();
  const contacts = await getEnabledContacts(propertyId, 'notifyDaily');

  if (contacts.length === 0) {
    logger.info('No daily contacts for property', { propertyId });
    return { sent: 0, failed: 0, skipped: true };
  }

  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    const messageBody = await buildDailyNotificationMessage(
      propertyId,
      targetDate,
      contact.language
    );

    if (!messageBody) {
      return { sent: 0, failed: 0, skipped: true };
    }

    const { sendWhatsAppMessage } = await import('@/services/whatsappService');
    const result = await sendWhatsAppMessage(contact.phone, messageBody);

    await logMessage({
      propertyId,
      contactId: contact.id,
      contactName: contact.name,
      contactPhone: contact.phone,
      type: 'daily',
      messageBody,
      twilioSid: result.sid,
      status: result.success ? 'sent' : 'failed',
      error: result.error,
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  logger.info('Daily notification sent', { propertyId, sent, failed });
  return { sent, failed, skipped: false };
}

export async function sendChangeNotification(
  propertyId: string,
  bookingId: string,
  changeType: 'new' | 'cancelled'
): Promise<{ sent: number; failed: number }> {
  // Duplicate prevention: check if same bookingId+changeType was sent within the last hour
  const db = await getAdminDb();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const existingMessages = await db
    .collection('housekeepingMessages')
    .where('bookingId', '==', bookingId)
    .where('changeType', '==', changeType)
    .where('createdAt', '>=', AdminTimestamp.fromDate(oneHourAgo))
    .limit(1)
    .get();

  if (!existingMessages.empty) {
    logger.info('Duplicate change notification skipped', { propertyId, bookingId, changeType });
    return { sent: 0, failed: 0 };
  }

  const contacts = await getEnabledContacts(propertyId, 'notifyChanges');
  if (contacts.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    const messageBody = await buildChangeNotificationMessage(
      propertyId,
      bookingId,
      changeType,
      contact.language
    );

    if (!messageBody) continue;

    const { sendWhatsAppMessage } = await import('@/services/whatsappService');
    const result = await sendWhatsAppMessage(contact.phone, messageBody);

    await logMessage({
      propertyId,
      contactId: contact.id,
      contactName: contact.name,
      contactPhone: contact.phone,
      type: 'change',
      messageBody,
      twilioSid: result.sid,
      status: result.success ? 'sent' : 'failed',
      error: result.error,
      bookingId,
      changeType,
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  logger.info('Change notification sent', { propertyId, bookingId, changeType, sent, failed });
  return { sent, failed };
}
