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
  notes?: string;
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
  // Cloud Run sets `host` to the internal hostname (0.0.0.0:8080).
  // The public-facing domain comes via x-forwarded-host (e.g., prahova-chalet.ro).
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto');
  if (forwardedHost) {
    const proto = forwardedProto || 'https';
    return `${proto}://${forwardedHost}/calendar/${token}`;
  }
  // Fallback to the request's own origin (works for local dev + non-proxied requests)
  return `${req.nextUrl.origin}/calendar/${token}`;
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

function appendCalendarLink(text: string, calUrl?: string): string {
  if (!calUrl) return text;
  return `${text}\n\nAveti aici calendarul complet: ${calUrl}`;
}

async function monthlyReservations(propertyId: string, calUrl?: string): Promise<NextResponse> {
  const bookings = await loadActiveBookings(propertyId);
  const text = monthlyReservationsText(bookings);
  return new NextResponse(appendCalendarLink(text, calUrl), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
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

// Per-booking snapshot record. Stored in automationState/{propertyId}.lastSnapshot.
interface BookingRecord {
  id: string;
  status: string;
  guestName: string;
  checkIn: string;   // YYYY-MM-DD Bucharest
  checkOut: string;  // YYYY-MM-DD Bucharest
  adults: number;
  children: number;
  persons: number;
  notes: string;
}

interface AutomationState {
  lastSnapshot?: BookingRecord[];
  lastSnapshotMonth?: string;
  lastUpdatedAt?: FirebaseFirestore.Timestamp;
}

function buildBookingRecord(b: BookingDoc): BookingRecord | null {
  const ci = toDate(b.checkInDate);
  const co = toDate(b.checkOutDate);
  if (!ci || !co) return null;
  return {
    id: b.id,
    status: b.status || '',
    guestName: guestName(b),
    checkIn: formatBucharestDate(ci),
    checkOut: formatBucharestDate(co),
    adults: adultsOf(b),
    children: childrenOf(b),
    persons: b.numberOfGuests || 0,
    notes: (b.notes || '').trim(),
  };
}

// ---- Romanian formatting helpers ----

function ddMMfromYmd(ymd: string): string {
  return `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;
}

function personsLabel(adults: number, children: number): string {
  const a = Math.max(adults, 1);
  const adultWord = a === 1 ? 'adult' : 'adulti';
  if (children <= 0) return `${a} ${adultWord}`;
  const childWord = children === 1 ? 'copil' : 'copii';
  return `${a} ${adultWord} + ${children} ${childWord}`;
}

function rangeLabel(r: BookingRecord): string {
  return `${ddMMfromYmd(r.checkIn)} - ${ddMMfromYmd(r.checkOut)}`;
}

// ---- Diff classification ----

type ChangeEvent =
  | { kind: 'new'; r: BookingRecord }
  | { kind: 'cancelled'; r: BookingRecord }
  | { kind: 'dates'; old: BookingRecord; cur: BookingRecord }
  | { kind: 'persons'; old: BookingRecord; cur: BookingRecord }
  | { kind: 'notes'; old: BookingRecord; cur: BookingRecord };

function diffBooking(oldR: BookingRecord, curR: BookingRecord): ChangeEvent[] {
  const events: ChangeEvent[] = [];

  // Cancellation takes precedence: confirmed/on-hold/completed → cancelled
  if (curR.status === 'cancelled' && oldR.status !== 'cancelled') {
    events.push({ kind: 'cancelled', r: curR });
    return events;
  }

  // Skip silent transition: confirmed → completed (natural end of stay, not a real change)
  const isSilentStatusFlip = oldR.status === 'confirmed' && curR.status === 'completed';

  // Date changes (compared as Bucharest YYYY-MM-DD strings)
  if (oldR.checkIn !== curR.checkIn || oldR.checkOut !== curR.checkOut) {
    events.push({ kind: 'dates', old: oldR, cur: curR });
  }

  // Person count changes
  if (oldR.adults !== curR.adults || oldR.children !== curR.children) {
    events.push({ kind: 'persons', old: oldR, cur: curR });
  }

  // Notes changes
  if (oldR.notes !== curR.notes) {
    events.push({ kind: 'notes', old: oldR, cur: curR });
  }

  // If the only change is the silent confirmed→completed status flip and nothing else changed,
  // suppress this booking from the change list.
  if (events.length === 0 && isSilentStatusFlip) return [];

  return events;
}

function formatChangeEvent(ev: ChangeEvent): string {
  switch (ev.kind) {
    case 'new':
      return `Rezervare nouă: ${ev.r.guestName}, ${rangeLabel(ev.r)} (${personsLabel(ev.r.adults, ev.r.children)})`;
    case 'cancelled':
      return `Rezervare anulată: ${ev.r.guestName}, ${rangeLabel(ev.r)}`;
    case 'dates':
      return `Modificare dată — ${ev.cur.guestName}: era ${rangeLabel(ev.old)}, acum ${rangeLabel(ev.cur)}`;
    case 'persons':
      return `Modificare oaspeți — ${ev.cur.guestName} (${rangeLabel(ev.cur)}): era ${personsLabel(ev.old.adults, ev.old.children)}, acum ${personsLabel(ev.cur.adults, ev.cur.children)}`;
    case 'notes':
      if (!ev.cur.notes) return `Notă ștearsă — ${ev.cur.guestName} (${rangeLabel(ev.cur)})`;
      return `Notă actualizată — ${ev.cur.guestName} (${rangeLabel(ev.cur)}): ${ev.cur.notes}`;
  }
}

async function changedReservations(propertyId: string, calUrl?: string): Promise<NextResponse> {
  const db = await getAdminDb();
  const stateRef = db.collection('automationState').doc(propertyId);

  const today = bucharestTodayParts();
  const monthKey = `${today.year}-${String(today.month).padStart(2, '0')}`;

  // Pull ALL property bookings (incl. cancelled) so cancellations are visible in the snapshot
  const snap = await db.collection('bookings')
    .where('propertyId', '==', propertyId)
    .get();

  const currentMap = new Map<string, BookingRecord>();
  for (const doc of snap.docs) {
    const b = { id: doc.id, ...(doc.data() as Omit<BookingDoc, 'id'>) };
    const ci = toDate(b.checkInDate);
    if (!ci) continue;
    if (getBucharestMonth(ci) !== monthKey) continue;
    const r = buildBookingRecord(b);
    if (r) currentMap.set(r.id, r);
  }

  // Read existing snapshot
  const stateDoc = await stateRef.get();
  const state: AutomationState = stateDoc.exists ? (stateDoc.data() as AutomationState) : {};
  const writeSnapshot = async () => {
    await stateRef.set({
      lastSnapshot: [...currentMap.values()],
      lastSnapshotMonth: monthKey,
      lastUpdatedAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
    });
  };

  // First-time init OR month boundary OR legacy snapshot shape: store and return "none".
  // Legacy detection: pre-migration snapshot was string[]; new shape is BookingRecord[].
  // If the first item lacks an `id` field, it's the old shape — re-initialize cleanly.
  const isLegacyShape = !!state.lastSnapshot?.length && typeof state.lastSnapshot[0] !== 'object';
  if (!stateDoc.exists || state.lastSnapshotMonth !== monthKey || isLegacyShape) {
    await writeSnapshot();
    return new NextResponse('none', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const prevMap = new Map<string, BookingRecord>();
  for (const r of state.lastSnapshot || []) {
    if (r && typeof r === 'object' && r.id) prevMap.set(r.id, r);
  }

  // Build event list
  const events: ChangeEvent[] = [];
  for (const [id, curR] of currentMap) {
    const oldR = prevMap.get(id);
    if (!oldR) {
      // New booking — but skip if it appeared already cancelled (not interesting)
      if (curR.status !== 'cancelled') events.push({ kind: 'new', r: curR });
      continue;
    }
    events.push(...diffBooking(oldR, curR));
  }
  for (const [id, oldR] of prevMap) {
    if (!currentMap.has(id)) {
      // Disappeared from the dataset — treat as cancellation (truly cancelled, deleted, or moved out of month)
      events.push({ kind: 'cancelled', r: oldR });
    }
  }

  // Always refresh snapshot
  await writeSnapshot();

  if (events.length === 0) {
    return new NextResponse('none', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // Build Romanian message
  const lines = events.map(formatChangeEvent);
  const header = events.length === 1
    ? 'Buna dimineata! O modificare la rezervări:'
    : 'Buna dimineata! Modificări la rezervări:';
  const text = `${header}\n${lines.map(l => `- ${l}`).join('\n')}`;
  return new NextResponse(appendCalendarLink(text, calUrl), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
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
