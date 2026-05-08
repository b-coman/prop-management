// Public-facing calendar data fetcher. Looks up which property a share token belongs to
// and returns calendar data with PII filtered for the housekeeping use case:
//   - Shown: first + last name, persons/adults/children, notes, dates
//   - Hidden: phone, email, source, payment, amounts, internal IDs
//
// Auth is the URL token alone — no user session.

import 'server-only';
import { getAdminDb, Timestamp } from '@/lib/firebaseAdminSafe';
import { formatBucharestDate, iterateBucharestStayDays } from '@/lib/dates/property-times';
import { getDaysInMonth } from 'date-fns';

export type PublicDayStatus = 'available' | 'booked' | 'on-hold' | 'external-block' | 'manual-block';

export interface PublicDayData {
  day: number;
  status: PublicDayStatus;
  bookingId?: string;
  bookingDetails?: {
    guestName: string;
    checkIn: string;  // YYYY-MM-DD Bucharest
    checkOut: string;
    persons?: number;
    adults?: number;
    children?: number;
    notes?: string;
    nights: number;
  };
  externalFeedName?: string;
  bookingPosition?: 'start' | 'middle' | 'end' | 'single';
  checkoutBooking?: {
    bookingId: string;
    guestName: string;
    barColor: 'emerald' | 'amber';
  };
}

export interface PublicMonthData {
  month: string; // YYYY-MM
  days: Record<number, PublicDayData>;
}

export interface PublicCalendarData {
  propertyName: string;
  months: PublicMonthData[];
}

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && value !== null) {
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

function nightsBetween(checkIn: Date, checkOut: Date): number {
  let count = 0;
  for (const _ of iterateBucharestStayDays(checkIn, checkOut)) count++;
  return count;
}

/**
 * Resolve a share token to a property doc. Returns null if no property has this token.
 */
export async function resolvePropertyByToken(token: string): Promise<{ propertyId: string; propertyName: string } | null> {
  if (!token) return null;
  const db = await getAdminDb();
  const snap = await db.collection('properties')
    .where('shareCalendarToken', '==', token)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data();
  return {
    propertyId: doc.id,
    propertyName: typeof data.name === 'string' ? data.name : 'Property',
  };
}

/**
 * Fetch public calendar data for a property — current month and N months ahead.
 */
export async function fetchPublicCalendarData(propertyId: string, propertyName: string, monthsAhead: number = 2): Promise<PublicCalendarData> {
  const db = await getAdminDb();
  const now = new Date();

  // Build list of YYYY-MM keys (Bucharest)
  const todayBucharest = formatBucharestDate(now);
  const [todayY, todayM] = todayBucharest.split('-').map(Number);
  const monthKeys: string[] = [];
  for (let i = 0; i <= monthsAhead; i++) {
    const targetMonth = todayM + i;
    const y = todayY + Math.floor((targetMonth - 1) / 12);
    const m = ((targetMonth - 1) % 12) + 1;
    monthKeys.push(`${y}-${String(m).padStart(2, '0')}`);
  }

  // Fetch availability docs in parallel
  const availDocs = await Promise.all(
    monthKeys.map(mk => db.collection('availability').doc(`${propertyId}_${mk}`).get())
  );

  // Fetch all active bookings for this property (one query covers all months)
  const bookingsSnap = await db.collection('bookings')
    .where('propertyId', '==', propertyId)
    .where('status', 'in', ['confirmed', 'completed', 'on-hold'])
    .get();

  // Build per-booking stay-day map (Bucharest local)
  interface BookingInfo {
    id: string;
    guestName: string;
    checkIn: Date;
    checkOut: Date;
    status: string;
    persons?: number;
    adults?: number;
    children?: number;
    notes?: string;
    stayDays: Set<string>; // "YYYY-MM:dd"
  }
  const bookings: BookingInfo[] = [];
  for (const doc of bookingsSnap.docs) {
    const data = doc.data();
    const ci = toDate(data.checkInDate);
    const co = toDate(data.checkOutDate);
    if (!ci || !co) continue;
    const stayDays = new Set<string>();
    for (const { day, monthKey } of iterateBucharestStayDays(ci, co)) {
      stayDays.add(`${monthKey}:${day}`);
    }
    const fn = data.guestInfo?.firstName?.trim() || '';
    const ln = data.guestInfo?.lastName?.trim() || '';
    bookings.push({
      id: doc.id,
      guestName: [fn, ln].filter(Boolean).join(' ').trim() || 'Guest',
      checkIn: ci,
      checkOut: co,
      status: data.status,
      persons: data.numberOfGuests,
      adults: data.numberOfAdults,
      children: data.numberOfChildren,
      notes: data.notes || undefined,
      stayDays,
    });
  }

  // Fetch iCal feeds (for feed name resolution)
  const feedsSnap = await db.collection('icalFeeds')
    .where('propertyId', '==', propertyId)
    .get();
  const feedNames = new Map<string, string>();
  for (const doc of feedsSnap.docs) {
    feedNames.set(doc.id, (doc.data().name as string) || 'External');
  }

  // Build per-month data
  const months: PublicMonthData[] = [];
  for (let mi = 0; mi < monthKeys.length; mi++) {
    const mk = monthKeys[mi];
    const [y, m] = mk.split('-').map(Number);
    const daysInMonth = getDaysInMonth(new Date(y, m - 1));
    const availData = availDocs[mi].exists ? availDocs[mi].data()! : null;
    const availableMap = (availData?.available || {}) as Record<string, boolean>;
    const externalBlocksMap = (availData?.externalBlocks || {}) as Record<string, string | null>;
    const holdsMap = (availData?.holds || {}) as Record<string, string | null>;

    const days: Record<number, PublicDayData> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${mk}:${d}`;
      const matching = bookings.filter(b => b.stayDays.has(key));
      const dayBooking = matching[0];

      let status: PublicDayStatus = 'available';
      const dayData: PublicDayData = { day: d, status };

      if (holdsMap[d] && dayBooking) {
        status = 'on-hold';
        dayData.status = status;
        dayData.bookingId = dayBooking.id;
        dayData.bookingDetails = {
          guestName: dayBooking.guestName,
          checkIn: formatBucharestDate(dayBooking.checkIn),
          checkOut: formatBucharestDate(dayBooking.checkOut),
          persons: dayBooking.persons,
          adults: dayBooking.adults,
          children: dayBooking.children,
          notes: dayBooking.notes,
          nights: nightsBetween(dayBooking.checkIn, dayBooking.checkOut),
        };
      } else if (availableMap[d] === false && dayBooking) {
        status = 'booked';
        dayData.status = status;
        dayData.bookingId = dayBooking.id;
        dayData.bookingDetails = {
          guestName: dayBooking.guestName,
          checkIn: formatBucharestDate(dayBooking.checkIn),
          checkOut: formatBucharestDate(dayBooking.checkOut),
          persons: dayBooking.persons,
          adults: dayBooking.adults,
          children: dayBooking.children,
          notes: dayBooking.notes,
          nights: nightsBetween(dayBooking.checkIn, dayBooking.checkOut),
        };
      } else if (availableMap[d] === false && externalBlocksMap[d]) {
        status = 'external-block';
        dayData.status = status;
        dayData.externalFeedName = feedNames.get(externalBlocksMap[d] as string) || 'External';
      } else if (availableMap[d] === false) {
        status = 'manual-block';
        dayData.status = status;
      }

      days[d] = dayData;
    }

    // Booking position (start/middle/end/single) for booked/on-hold cells, plus checkoutBooking tail
    for (const b of bookings) {
      let lastDayInMonth = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        if (b.stayDays.has(`${mk}:${d}`)) lastDayInMonth = d;
      }
      // Position for each day in this month
      for (let d = 1; d <= daysInMonth; d++) {
        if (!b.stayDays.has(`${mk}:${d}`)) continue;
        const dayEntry = days[d];
        if (dayEntry.bookingId !== b.id) continue;

        const prevKey = d > 1 ? `${mk}:${d - 1}` : prevMonthLastDayKey(y, m, b);
        const nextKey = d < daysInMonth ? `${mk}:${d + 1}` : nextMonthFirstDayKey(y, m, b);
        const prevBooked = b.stayDays.has(prevKey);
        const nextBooked = b.stayDays.has(nextKey);
        if (!prevBooked && !nextBooked) dayEntry.bookingPosition = 'single';
        else if (!prevBooked) dayEntry.bookingPosition = 'start';
        else if (!nextBooked) dayEntry.bookingPosition = 'end';
        else dayEntry.bookingPosition = 'middle';
      }
      // Checkout tail: lastDayInMonth + 1, only if booking ends here
      if (lastDayInMonth > 0 && lastDayInMonth < daysInMonth) {
        const nextKey = `${mk}:${lastDayInMonth + 1}`;
        if (!b.stayDays.has(nextKey) && days[lastDayInMonth + 1]) {
          days[lastDayInMonth + 1].checkoutBooking = {
            bookingId: b.id,
            guestName: b.guestName,
            barColor: b.status === 'on-hold' ? 'amber' : 'emerald',
          };
        }
      }
    }

    months.push({ month: mk, days });
  }

  return { propertyName, months };
}

function prevMonthLastDayKey(year: number, month: number, b: { stayDays: Set<string> }): string {
  const prevY = month === 1 ? year - 1 : year;
  const prevM = month === 1 ? 12 : month - 1;
  const lastDay = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
  return `${prevY}-${String(prevM).padStart(2, '0')}:${lastDay}`;
}

function nextMonthFirstDayKey(year: number, month: number, _b: { stayDays: Set<string> }): string {
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  return `${nextY}-${String(nextM).padStart(2, '0')}:1`;
}
