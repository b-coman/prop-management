// Drop-in replacement for the Google Apps Script automation endpoint that powered
// the iOS Shortcuts ("Comarnic Monthly Message", "Checkin/out Lights & Heating",
// "Checkin/out Message", "Reservation Change Message").
//
// Three operations, all matching the Apps Script output format byte-for-byte so the
// existing Shortcuts can be repointed at this URL with no edits to their logic.
//
// Auth: static token via ?token=... (compared against AUTOMATION_TOKEN env var).
//
// URLs:
//   GET /api/automation?op=monthlyReservations&propertyId=<slug>&token=<secret>
//     → text/plain — formatted Romanian list, e.g.
//        "Luni, 22.05 va pleca Ivan Kutsis. Celelalte rezervari pentru luna mai sunt:\n22.05 - 24.05 / ..."
//
//   GET /api/automation?op=dailyCheck&propertyId=<slug>&token=<secret>
//     → application/json — { inRange, guestName, checkinDate, checkoutDate,
//       persons, adults, children, isCheckinDate, isCheckoutDate }
//
//   GET /api/automation?op=changedReservations&propertyId=<slug>&token=<secret>
//     → text/plain — "none" if nothing changed since last call; otherwise the same
//       output as monthlyReservations.
//     Server-side state lives in automationState/{propertyId} (a snapshot of
//       active-booking ids for the current Bucharest month).

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { formatBucharestDate, getBucharestDay, getBucharestMonth } from '@/lib/dates/property-times';

const logger = loggers.adminBookings;

// Romanian month / day names — must match Apps Script output exactly
const RO_MONTHS = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];
const RO_DAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- Bucharest-aware "today" helpers ----

function bucharestTodayParts(now = new Date()): { year: number; month: number; day: number } {
  const ymd = formatBucharestDate(now); // YYYY-MM-DD
  const [y, m, d] = ymd.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function bucharestDayOfWeek(d: Date): number {
  // 0..6, Sunday-first (matching JS getDay() and Apps Script's dayName index)
  // We use UTC noon of the Bucharest date as a stable anchor that doesn't shift under DST.
  const ymd = formatBucharestDate(d);
  const noon = new Date(`${ymd}T12:00:00Z`);
  return noon.getUTCDay();
}

function dateNumberFromYmd(ymd: string): string {
  return ymd.slice(8, 10); // "dd"
}

function ddMM(ymd: string): string {
  return `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;
}

// ---- Booking type ----

interface BookingDoc {
  id: string;
  guestInfo?: { firstName?: string; lastName?: string };
  numberOfGuests?: number;
  numberOfAdults?: number;
  numberOfChildren?: number;
  status?: string;
  checkInDate?: { toDate?: () => Date; _seconds?: number } | Date | string;
  checkOutDate?: { toDate?: () => Date; _seconds?: number } | Date | string;
}

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
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

function guestName(b: BookingDoc): string {
  const fn = b.guestInfo?.firstName?.trim() || '';
  const ln = b.guestInfo?.lastName?.trim() || '';
  return [fn, ln].filter(Boolean).join(' ').trim() || '(no name)';
}

function adultsOf(b: BookingDoc): number {
  return b.numberOfAdults && b.numberOfAdults > 0 ? b.numberOfAdults : (b.numberOfGuests || 1);
}
function childrenOf(b: BookingDoc): number {
  return b.numberOfChildren || 0;
}

// ---- Auth ----

function authOk(req: NextRequest): boolean {
  const expected = process.env.AUTOMATION_TOKEN;
  if (!expected) return false;
  const got = req.nextUrl.searchParams.get('token');
  return !!got && got === expected;
}

// ---- Fetch active bookings for a property ----

async function loadActiveBookings(propertyId: string): Promise<BookingDoc[]> {
  const db = await getAdminDb();
  const snap = await db.collection('bookings')
    .where('propertyId', '==', propertyId)
    .where('status', 'in', ['confirmed', 'completed', 'on-hold'])
    .get();
  const list: BookingDoc[] = [];
  snap.forEach(doc => {
    list.push({ id: doc.id, ...(doc.data() as Omit<BookingDoc, 'id'>) });
  });
  return list;
}

async function loadShareToken(propertyId: string): Promise<string | undefined> {
  const db = await getAdminDb();
  const doc = await db.collection('properties').doc(propertyId).get();
  if (!doc.exists) return undefined;
  return doc.data()?.shareCalendarToken || undefined;
}

function calendarUrl(req: NextRequest, token: string | undefined): string | undefined {
  if (!token) return undefined;
  const origin = req.nextUrl.origin;
  return `${origin}/calendar/${token}`;
}

// ============================================================
// monthlyReservations
// ============================================================

function monthlyReservationsText(bookings: BookingDoc[], now = new Date()): string {
  const today = bucharestTodayParts(now);
  const todayYmd = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
  const tomorrow = new Date(`${todayYmd}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowYmd = formatBucharestDate(tomorrow);

  const monthName = RO_MONTHS[today.month - 1];
  const firstOfNext = `${today.month === 12 ? today.year + 1 : today.year}-${String(today.month === 12 ? 1 : today.month + 1).padStart(2, '0')}-01`;

  let departureText = '';
  let otherReservationsText = '';

  // Build the list and find any "today is in some booking's range" departure note
  type Item = { ymdIn: string; ymdOut: string; booking: BookingDoc };
  const upcoming: Item[] = [];

  for (const b of bookings) {
    const ci = toDate(b.checkInDate);
    const co = toDate(b.checkOutDate);
    if (!ci || !co) continue;
    const ymdIn = formatBucharestDate(ci);
    const ymdOut = formatBucharestDate(co);

    // Departure note: today within [checkin, checkout] inclusive (Apps Script semantics)
    if (todayYmd >= ymdIn && todayYmd <= ymdOut) {
      let dayOfWeekText: string;
      if (ymdOut === todayYmd) dayOfWeekText = 'Azi';
      else if (ymdOut === tomorrowYmd) dayOfWeekText = 'Maine';
      else dayOfWeekText = capitalize(RO_DAYS[bucharestDayOfWeek(co)]);

      departureText = `${dayOfWeekText}, ${ddMM(ymdOut)} va pleca ${guestName(b)}. `;
      otherReservationsText = `Celelalte rezervari pentru luna ${monthName} sunt:\n`;
    }

    // Upcoming-this-month: checkin in [today, first-of-next-month)
    if (ymdIn >= todayYmd && ymdIn < firstOfNext) {
      upcoming.push({ ymdIn, ymdOut, booking: b });
    }
  }

  upcoming.sort((a, b) => a.ymdIn.localeCompare(b.ymdIn));

  const lines = upcoming.map(({ ymdIn, ymdOut, booking }) => {
    const adults = adultsOf(booking);
    const children = childrenOf(booking);
    const adultWord = adults === 1 ? 'adult' : 'adulti';
    const childrenWord = children === 0 ? '' : children === 1 ? 'copil' : 'copii';
    let s = `${ddMM(ymdIn)} - ${ddMM(ymdOut)} / ${guestName(booking)} (${adults} ${adultWord}`;
    if (childrenWord) s += ` + ${children} ${childrenWord}`;
    s += ')';
    return s;
  });

  return `${departureText}${otherReservationsText}${lines.join('\n')}`;
}

async function monthlyReservations(propertyId: string, calUrl?: string): Promise<NextResponse> {
  const bookings = await loadActiveBookings(propertyId);
  const text = monthlyReservationsText(bookings);
  const withUrl = calUrl ? `${text}\n\n${calUrl}` : text;
  return new NextResponse(withUrl, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

// ============================================================
// dailyCheck
// ============================================================

function formatRoDate(d: Date): string {
  // "luni, 22 mai" — matches Apps Script formatDate()
  const ymd = formatBucharestDate(d);
  const dow = bucharestDayOfWeek(d);
  const dn = dateNumberFromYmd(ymd);
  const monthIdx = parseInt(ymd.slice(5, 7), 10) - 1;
  return `${RO_DAYS[dow]}, ${dn} ${RO_MONTHS[monthIdx]}`;
}

interface DailyCheckResponse {
  inRange: 'yes' | 'no';
  guestName: string;
  checkinDate: string;
  checkoutDate: string;
  persons: number | string;
  adults: number | string;
  children: number | string;
  isCheckinDate: 'yes' | 'no';
  isCheckoutDate: 'yes' | 'no';
  calendarUrl?: string;
}

async function dailyCheck(propertyId: string, calUrl?: string): Promise<NextResponse> {
  const bookings = await loadActiveBookings(propertyId);
  const today = bucharestTodayParts();
  const todayYmd = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;

  const result: DailyCheckResponse = {
    inRange: 'no',
    guestName: '',
    checkinDate: '',
    checkoutDate: '',
    persons: '',
    adults: '',
    children: '',
    isCheckinDate: 'no',
    isCheckoutDate: 'no',
  };

  for (const b of bookings) {
    const ci = toDate(b.checkInDate);
    const co = toDate(b.checkOutDate);
    if (!ci || !co) continue;
    const ymdIn = formatBucharestDate(ci);
    const ymdOut = formatBucharestDate(co);
    if (todayYmd >= ymdIn && todayYmd <= ymdOut) {
      result.inRange = 'yes';
      result.guestName = guestName(b);
      result.checkinDate = formatRoDate(ci);
      result.checkoutDate = formatRoDate(co);
      result.persons = b.numberOfGuests ?? '';
      result.adults = b.numberOfAdults ?? '';
      result.children = b.numberOfChildren ?? '';
      if (todayYmd === ymdIn) result.isCheckinDate = 'yes';
      if (todayYmd === ymdOut) result.isCheckoutDate = 'yes';
      break;
    }
  }

  if (calUrl) result.calendarUrl = calUrl;
  return NextResponse.json(result);
}

// ============================================================
// changedReservations
// ============================================================

interface AutomationState {
  // Set of identity strings for bookings whose check-in is in the current Bucharest month.
  // Format: "<id>|<status>|<checkInDate-Bucharest>|<checkOutDate-Bucharest>"
  // Captures status changes (cancel) and date changes too.
  lastSnapshot?: string[];
  lastSnapshotMonth?: string; // YYYY-MM — when this changes, treat as fresh init
  lastUpdatedAt?: FirebaseFirestore.Timestamp;
}

function snapshotKey(b: BookingDoc): string | null {
  const ci = toDate(b.checkInDate);
  const co = toDate(b.checkOutDate);
  if (!ci || !co) return null;
  return `${b.id}|${b.status || ''}|${formatBucharestDate(ci)}|${formatBucharestDate(co)}`;
}

async function changedReservations(propertyId: string, calUrl?: string): Promise<NextResponse> {
  const db = await getAdminDb();
  const stateRef = db.collection('automationState').doc(propertyId);

  const today = bucharestTodayParts();
  const monthKey = `${today.year}-${String(today.month).padStart(2, '0')}`;

  // Load all property bookings — we need to detect cancellations too.
  // Status filter intentionally INCLUDES 'cancelled' here so cancellations are visible
  // in the snapshot and trigger a diff next call.
  const snap = await db.collection('bookings')
    .where('propertyId', '==', propertyId)
    .get();

  const currentSnapshot = new Set<string>();
  for (const doc of snap.docs) {
    const b = { id: doc.id, ...(doc.data() as Omit<BookingDoc, 'id'>) };
    const ci = toDate(b.checkInDate);
    if (!ci) continue;
    if (getBucharestMonth(ci) !== monthKey) continue;
    const k = snapshotKey(b);
    if (k) currentSnapshot.add(k);
  }
  const currentArr = [...currentSnapshot].sort();

  // Read existing state
  const stateDoc = await stateRef.get();
  const state: AutomationState = stateDoc.exists ? (stateDoc.data() as AutomationState) : {};

  // First-time init: store and return "none" (matches Apps Script behavior on missing oldReservations)
  if (!stateDoc.exists || state.lastSnapshotMonth !== monthKey) {
    await stateRef.set({
      lastSnapshot: currentArr,
      lastSnapshotMonth: monthKey,
      lastUpdatedAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
    });
    return new NextResponse('none', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // Compare
  const prev = new Set(state.lastSnapshot || []);
  let changed = false;
  for (const k of currentSnapshot) if (!prev.has(k)) { changed = true; break; }
  if (!changed) {
    for (const k of prev) if (!currentSnapshot.has(k)) { changed = true; break; }
  }

  // Always update the snapshot (matches Apps Script — every call refreshes oldReservations)
  await stateRef.set({
    lastSnapshot: currentArr,
    lastSnapshotMonth: monthKey,
    lastUpdatedAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
  });

  if (!changed) {
    return new NextResponse('none', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // Changed → return the same monthlyReservations text
  const activeBookings = await loadActiveBookings(propertyId);
  const text = monthlyReservationsText(activeBookings);
  const withUrl = calUrl ? `${text}\n\n${calUrl}` : text;
  return new NextResponse(withUrl, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

// ============================================================
// Route handler
// ============================================================

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const op = req.nextUrl.searchParams.get('op');
  const propertyId = req.nextUrl.searchParams.get('propertyId');
  if (!propertyId) {
    return new NextResponse('Missing propertyId', { status: 400 });
  }

  try {
    const shareToken = await loadShareToken(propertyId);
    const calUrl = calendarUrl(req, shareToken);
    switch (op) {
      case 'monthlyReservations':
        return await monthlyReservations(propertyId, calUrl);
      case 'dailyCheck':
        return await dailyCheck(propertyId, calUrl);
      case 'changedReservations':
        return await changedReservations(propertyId, calUrl);
      default:
        return new NextResponse('Invalid operation', { status: 400 });
    }
  } catch (err) {
    logger.error('Automation endpoint error', err as Error, { op, propertyId });
    return new NextResponse('Internal error', { status: 500 });
  }
}
