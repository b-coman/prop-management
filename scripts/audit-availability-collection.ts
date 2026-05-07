// READ-ONLY audit of the `availability` collection.
//
// Cross-checks against the `bookings` collection to find:
//   1. Days marked unavailable but with no explanation (orphans)
//   2. Bookings whose truth-days (Bucharest-local) aren't fully blocked in availability (coverage gaps)
//   3. Bookings where the writer's day-key (getUTCDate) disagrees with Bucharest-local truth
//      (this is the "off-by-one" data corruption affecting Bucharest-midnight bookings)
//   4. External-block entries pointing to feedIds that don't exist
//   5. Days blocked by both a real booking and an external feed (deduplication question)
//
// Outputs:
//   - Summary tables to stdout
//   - Detail CSV: scripts/availability-audit-blocked-days.csv (per blocked day)
//   - Detail CSV: scripts/availability-audit-booking-coverage.csv (per booking)
//
// Usage: npx tsx scripts/audit-availability-collection.ts
//   Optional: --property=<slug>
//   Optional: --upcoming-only (only check months from current month onward)
//
// This script does NOT write to Firestore.

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(path.resolve(serviceAccountPath)),
});

const db = admin.firestore();

const args = process.argv.slice(2);
const propertyFilter = args.find(a => a.startsWith('--property='))?.split('=')[1];
const upcomingOnly = args.includes('--upcoming-only');

// ---- Date helpers ----

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (value instanceof admin.firestore.Timestamp) return value.toDate();
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && '_seconds' in (value as Record<string, unknown>)) {
    return new Date((value as { _seconds: number })._seconds * 1000);
  }
  return null;
}

const bucharestDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function bucharestDateOnly(d: Date): string {
  return bucharestDateFormatter.format(d); // YYYY-MM-DD
}

/**
 * "Truth" days a guest occupies, interpreted in Europe/Bucharest TZ.
 * Returns Map<"YYYY-MM", Set<dayNumber>>.
 */
function truthDays(checkIn: Date, checkOut: Date): Map<string, Set<number>> {
  const result = new Map<string, Set<number>>();
  const startStr = bucharestDateOnly(checkIn); // YYYY-MM-DD
  const endStr = bucharestDateOnly(checkOut);  // YYYY-MM-DD (exclusive)

  if (startStr >= endStr) return result;

  // Use noon UTC of each Bucharest day to step safely through DST transitions.
  // We anchor by parsing the string back as UTC noon.
  let cur = new Date(`${startStr}T12:00:00Z`);
  while (true) {
    const curStr = bucharestDateOnly(cur);
    if (curStr >= endStr) break;
    const [y, m, d] = curStr.split('-').map(Number);
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    if (!result.has(monthKey)) result.set(monthKey, new Set());
    result.get(monthKey)!.add(d);
    cur = new Date(cur.getTime() + 86400000);
  }
  return result;
}

/**
 * Days that bookingService.ts:590 would write, mimicked on a UTC server (Cloud Run).
 * Uses getUTCDate() after UTC-startOfDay, eachDayOfInterval through checkOut-1.
 */
function writerDays(checkIn: Date, checkOut: Date): Map<string, Set<number>> {
  const result = new Map<string, Set<number>>();
  if (checkOut.getTime() <= checkIn.getTime()) return result;

  // startOfDay in UTC for both check-in and (check-out minus one day)
  const startMs = Date.UTC(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate());
  const checkOutMinus1 = new Date(checkOut.getTime() - 86400000);
  const endMs = Date.UTC(checkOutMinus1.getUTCFullYear(), checkOutMinus1.getUTCMonth(), checkOutMinus1.getUTCDate());

  for (let ms = startMs; ms <= endMs; ms += 86400000) {
    const d = new Date(ms);
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const day = d.getUTCDate();
    if (!result.has(monthKey)) result.set(monthKey, new Set());
    result.get(monthKey)!.add(day);
  }
  return result;
}

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function setDiff(a: Set<number>, b: Set<number>): number[] {
  const out: number[] = [];
  for (const v of a) if (!b.has(v)) out.push(v);
  return out.sort((x, y) => x - y);
}

// ---- Main ----

interface BookingLite {
  id: string;
  propertyId: string;
  status: string;
  source: string;
  imported: boolean;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  truth: Map<string, Set<number>>;
  writer: Map<string, Set<number>>;
}

interface AvailabilityDoc {
  id: string;
  propertyId: string;
  month: string; // YYYY-MM
  available: Record<string, boolean>;
  holds: Record<string, string | null>;
  externalBlocks: Record<string, string | null>;
}

async function main() {
  const today = new Date();
  const todayMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;

  console.log('Reading collections...');

  // 1. Bookings
  let bookingsQuery: FirebaseFirestore.Query = db.collection('bookings')
    .where('status', 'in', ['confirmed', 'completed', 'on-hold']);
  if (propertyFilter) bookingsQuery = bookingsQuery.where('propertyId', '==', propertyFilter);
  const bookingsSnapshot = await bookingsQuery.get();
  console.log(`  ${bookingsSnapshot.size} active bookings`);

  // 2. Availability docs
  let availSnapshot: FirebaseFirestore.QuerySnapshot;
  if (propertyFilter) {
    const prefix = `${propertyFilter}_`;
    availSnapshot = await db.collection('availability')
      .where(admin.firestore.FieldPath.documentId(), '>=', prefix)
      .where(admin.firestore.FieldPath.documentId(), '<', prefix + '')
      .get();
  } else {
    availSnapshot = await db.collection('availability').get();
  }
  console.log(`  ${availSnapshot.size} availability docs`);

  // 3. iCal feeds (for feedId -> name lookup)
  const feedsSnapshot = await db.collection('icalFeeds').get();
  const feedNames = new Map<string, string>();
  for (const doc of feedsSnapshot.docs) {
    feedNames.set(doc.id, (doc.data().name as string) || 'External');
  }
  console.log(`  ${feedsSnapshot.size} iCal feeds`);
  console.log('');

  // ---- Build BookingLite ----

  const bookings: BookingLite[] = [];
  for (const doc of bookingsSnapshot.docs) {
    const data = doc.data();
    const checkIn = toDate(data.checkInDate);
    const checkOut = toDate(data.checkOutDate);
    if (!checkIn || !checkOut) continue;
    const guestName = [data.guestInfo?.firstName, data.guestInfo?.lastName].filter(Boolean).join(' ') || '(no name)';
    bookings.push({
      id: doc.id,
      propertyId: data.propertyId || '',
      status: data.status || '',
      source: data.source || '',
      imported: !!data.imported,
      guestName,
      checkIn,
      checkOut,
      truth: truthDays(checkIn, checkOut),
      writer: writerDays(checkIn, checkOut),
    });
  }

  // ---- Build AvailabilityDoc list ----

  const availDocs: AvailabilityDoc[] = [];
  for (const doc of availSnapshot.docs) {
    const data = doc.data();
    const id = doc.id;
    // Doc id format: <propertyId>_<YYYY-MM>
    const lastUnderscore = id.lastIndexOf('_');
    const propertyId = lastUnderscore > 0 ? id.substring(0, lastUnderscore) : (data.propertyId || '');
    const month = lastUnderscore > 0 ? id.substring(lastUnderscore + 1) : (data.month || '');
    if (upcomingOnly && month < todayMonth) continue;
    availDocs.push({
      id,
      propertyId,
      month,
      available: data.available || {},
      holds: data.holds || {},
      externalBlocks: data.externalBlocks || {},
    });
  }

  // ---- Index bookings by (propertyId, month) for cross-reference ----

  const bookingsByPropertyMonth = new Map<string, BookingLite[]>();
  for (const b of bookings) {
    for (const month of b.truth.keys()) {
      const key = `${b.propertyId}|${month}`;
      if (!bookingsByPropertyMonth.has(key)) bookingsByPropertyMonth.set(key, []);
      bookingsByPropertyMonth.get(key)!.push(b);
    }
    for (const month of b.writer.keys()) {
      const key = `${b.propertyId}|${month}`;
      if (!bookingsByPropertyMonth.has(key)) bookingsByPropertyMonth.set(key, []);
      const arr = bookingsByPropertyMonth.get(key)!;
      if (!arr.includes(b)) arr.push(b);
    }
  }

  // ---- Walk availability docs and classify each blocked day ----

  interface BlockedDayRow {
    propertyId: string;
    month: string;
    day: number;
    holdBookingId: string;
    externalFeedId: string;
    externalFeedName: string;
    matchingBookings_truth: string;   // booking ids that have this day in their truth set
    matchingBookings_writer: string;  // booking ids that have this day in their writer set
    classification: string; // 'hold' | 'external' | 'booking-truth' | 'booking-writer-only' | 'orphan' | 'multi'
  }

  const blockedRows: BlockedDayRow[] = [];

  for (const ad of availDocs) {
    const propertyBookings = bookingsByPropertyMonth.get(`${ad.propertyId}|${ad.month}`) || [];

    for (const [dayStr, isAvailable] of Object.entries(ad.available)) {
      if (isAvailable !== false) continue;
      const day = parseInt(dayStr, 10);
      if (isNaN(day)) continue;

      const holdId = ad.holds[dayStr] || '';
      const extId = ad.externalBlocks[dayStr] || '';
      const extName = extId ? (feedNames.get(extId) || '(unknown feed)') : '';

      const matchTruth = propertyBookings.filter(b => b.truth.get(ad.month)?.has(day)).map(b => b.id);
      const matchWriter = propertyBookings.filter(b => b.writer.get(ad.month)?.has(day)).map(b => b.id);

      let cls: string;
      if (holdId) cls = 'hold';
      else if (matchTruth.length > 0 && matchWriter.length > 0) cls = 'booking-truth+writer';
      else if (matchTruth.length > 0) cls = 'booking-truth-only';
      else if (matchWriter.length > 0) cls = 'booking-writer-only';
      else if (extId) cls = 'external';
      else cls = 'orphan';

      // Multi flag: more than one independent reason
      const reasons = [holdId ? 1 : 0, extId ? 1 : 0, (matchTruth.length + matchWriter.length) > 0 ? 1 : 0];
      const reasonCount = reasons.reduce((a, b) => a + b, 0);
      if (reasonCount > 1) cls = `multi(${cls})`;

      blockedRows.push({
        propertyId: ad.propertyId,
        month: ad.month,
        day,
        holdBookingId: holdId,
        externalFeedId: extId,
        externalFeedName: extName,
        matchingBookings_truth: matchTruth.join(';'),
        matchingBookings_writer: matchWriter.join(';'),
        classification: cls,
      });
    }
  }

  // ---- Per-booking coverage check ----

  interface CoverageRow {
    bookingId: string;
    propertyId: string;
    status: string;
    source: string;
    imported: boolean;
    guestName: string;
    checkInUTC: string;
    checkOutUTC: string;
    truthDays: string;       // "2026-05: 22,23"
    writerDays: string;      // "2026-05: 21,22"
    truthEqualsWriter: boolean;
    truthBlockedDays: string;     // days actually blocked by availability map (intersect truth with available[d]==false)
    truthMissingDays: string;     // truth days NOT blocked in availability (coverage gap)
    writerBlockedDays: string;
    writerExtraDays: string;      // writer days NOT in truth (i.e. wrongly blocked days that aren't really stays)
    severity: string;             // 'ok' | 'off-by-one' | 'gap' | 'misalignment'
  }

  const availLookup = new Map<string, AvailabilityDoc>();
  for (const ad of availDocs) availLookup.set(`${ad.propertyId}|${ad.month}`, ad);

  function isBlocked(propertyId: string, month: string, day: number): boolean {
    const ad = availLookup.get(`${propertyId}|${month}`);
    if (!ad) return false;
    return ad.available[String(day)] === false;
  }

  function flatten(map: Map<string, Set<number>>): string {
    return [...map.entries()].sort().map(([m, s]) => `${m}:${[...s].sort((a, b) => a - b).join(',')}`).join(' ');
  }

  const coverageRows: CoverageRow[] = [];

  for (const b of bookings) {
    if (upcomingOnly) {
      const lastMonth = [...b.truth.keys()].sort().pop() || '';
      if (lastMonth && lastMonth < todayMonth) continue;
    }

    const truthBlocked: Map<string, Set<number>> = new Map();
    const truthMissing: Map<string, Set<number>> = new Map();
    for (const [m, s] of b.truth.entries()) {
      truthBlocked.set(m, new Set());
      truthMissing.set(m, new Set());
      for (const d of s) {
        if (isBlocked(b.propertyId, m, d)) truthBlocked.get(m)!.add(d);
        else truthMissing.get(m)!.add(d);
      }
    }

    const writerBlocked: Map<string, Set<number>> = new Map();
    const writerExtra: Map<string, Set<number>> = new Map();
    for (const [m, s] of b.writer.entries()) {
      writerBlocked.set(m, new Set());
      writerExtra.set(m, new Set());
      const truthForMonth = b.truth.get(m) || new Set();
      for (const d of s) {
        if (isBlocked(b.propertyId, m, d)) writerBlocked.get(m)!.add(d);
        if (!truthForMonth.has(d)) writerExtra.get(m)!.add(d);
      }
    }

    const truthEqualsWriter = (() => {
      const am = [...b.truth.keys()].sort();
      const bm = [...b.writer.keys()].sort();
      if (am.length !== bm.length || am.some((k, i) => k !== bm[i])) return false;
      for (const m of am) {
        if (!setsEqual(b.truth.get(m)!, b.writer.get(m)!)) return false;
      }
      return true;
    })();

    const totalMissing = [...truthMissing.values()].reduce((a, s) => a + s.size, 0);
    const totalExtra = [...writerExtra.values()].reduce((a, s) => a + s.size, 0);

    let severity: string;
    if (truthEqualsWriter && totalMissing === 0) severity = 'ok';
    else if (!truthEqualsWriter) severity = 'off-by-one';
    else if (totalMissing > 0) severity = 'gap';
    else severity = 'misalignment';

    coverageRows.push({
      bookingId: b.id,
      propertyId: b.propertyId,
      status: b.status,
      source: b.source,
      imported: b.imported,
      guestName: b.guestName,
      checkInUTC: b.checkIn.toISOString(),
      checkOutUTC: b.checkOut.toISOString(),
      truthDays: flatten(b.truth),
      writerDays: flatten(b.writer),
      truthEqualsWriter,
      truthBlockedDays: flatten(truthBlocked),
      truthMissingDays: flatten(truthMissing),
      writerBlockedDays: flatten(writerBlocked),
      writerExtraDays: flatten(writerExtra),
      severity,
    });
  }

  // ---- Summaries ----

  console.log('===========================================');
  console.log('AVAILABILITY DOCS');
  console.log('===========================================');
  console.log(`Total docs: ${availDocs.length}`);
  console.log(`Total blocked days across all docs: ${blockedRows.length}`);
  console.log('');

  console.log('--- Blocked-day classification ---');
  const cTally = new Map<string, number>();
  for (const r of blockedRows) cTally.set(r.classification, (cTally.get(r.classification) || 0) + 1);
  for (const [k, v] of [...cTally.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(35)} ${v}`);
  }
  console.log('');

  const orphans = blockedRows.filter(r => r.classification === 'orphan');
  if (orphans.length > 0) {
    console.log(`!!! ORPHANS: ${orphans.length} blocked days with NO source (no hold, no external block, no matching booking)`);
    for (const r of orphans.slice(0, 10)) {
      console.log(`  ${r.propertyId}_${r.month} day=${r.day}`);
    }
    if (orphans.length > 10) console.log(`  ... and ${orphans.length - 10} more (see CSV)`);
    console.log('');
  } else {
    console.log('No orphan blocked days.\n');
  }

  const writerOnly = blockedRows.filter(r => r.classification.includes('booking-writer-only'));
  if (writerOnly.length > 0) {
    console.log(`!!! WRITER-ONLY: ${writerOnly.length} days blocked because the bookingService writer wrote them, but Bucharest-local truth says NO booking is on this day`);
    console.log(`    (These are likely DAY-21 blocks that should be DAY-22 blocks — symptom of imported-booking off-by-one)`);
    for (const r of writerOnly.slice(0, 10)) {
      console.log(`  ${r.propertyId}_${r.month} day=${r.day}  bookings=${r.matchingBookings_writer}`);
    }
    if (writerOnly.length > 10) console.log(`  ... and ${writerOnly.length - 10} more (see CSV)`);
    console.log('');
  }

  console.log('===========================================');
  console.log('BOOKING COVERAGE');
  console.log('===========================================');
  console.log(`Total bookings checked: ${coverageRows.length}`);
  console.log('');

  console.log('--- Coverage severity ---');
  const sTally = new Map<string, number>();
  for (const r of coverageRows) sTally.set(r.severity, (sTally.get(r.severity) || 0) + 1);
  for (const [k, v] of [...sTally.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${v}`);
  }
  console.log('');

  const offByOne = coverageRows.filter(r => r.severity === 'off-by-one');
  if (offByOne.length > 0) {
    console.log(`!!! OFF-BY-ONE: ${offByOne.length} bookings where writer-days != truth-days`);
    console.log(`    (These are bookings where the bookingService writer would block the WRONG calendar day)`);
    for (const r of offByOne.slice(0, 10)) {
      console.log(`  ${r.bookingId}  ${r.guestName.padEnd(28)}  truth=${r.truthDays}  writer=${r.writerDays}`);
    }
    if (offByOne.length > 10) console.log(`  ... and ${offByOne.length - 10} more (see CSV)`);
    console.log('');
  }

  const gaps = coverageRows.filter(r => r.severity === 'gap');
  if (gaps.length > 0) {
    console.log(`!!! GAPS: ${gaps.length} bookings whose truth-days are NOT all blocked in availability map`);
    for (const r of gaps.slice(0, 10)) {
      console.log(`  ${r.bookingId}  ${r.guestName.padEnd(28)}  missing=${r.truthMissingDays}`);
    }
    if (gaps.length > 10) console.log(`  ... and ${gaps.length - 10} more (see CSV)`);
    console.log('');
  }

  // ---- Future-only quick stats ----
  const futureCoverage = coverageRows.filter(r => r.checkOutUTC >= new Date().toISOString());
  if (futureCoverage.length > 0) {
    console.log('--- Future + active bookings only ---');
    console.log(`  total: ${futureCoverage.length}`);
    const fTally = new Map<string, number>();
    for (const r of futureCoverage) fTally.set(r.severity, (fTally.get(r.severity) || 0) + 1);
    for (const [k, v] of [...fTally.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(20)} ${v}`);
    }
    console.log('');
  }

  // ---- CSV outputs ----

  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const blockedCsvPath = path.resolve(process.cwd(), 'scripts', 'availability-audit-blocked-days.csv');
  const blockedHeader = ['propertyId', 'month', 'day', 'classification', 'holdBookingId', 'externalFeedId', 'externalFeedName', 'matchingBookings_truth', 'matchingBookings_writer'].join(',');
  const blockedLines = [blockedHeader, ...blockedRows.map(r => [r.propertyId, r.month, r.day, r.classification, r.holdBookingId, r.externalFeedId, r.externalFeedName, r.matchingBookings_truth, r.matchingBookings_writer].map(escape).join(','))];
  fs.writeFileSync(blockedCsvPath, blockedLines.join('\n'));
  console.log(`CSV written: ${blockedCsvPath} (${blockedRows.length} rows)`);

  const coverageCsvPath = path.resolve(process.cwd(), 'scripts', 'availability-audit-booking-coverage.csv');
  const coverageHeader = ['bookingId', 'propertyId', 'status', 'source', 'imported', 'guestName', 'checkInUTC', 'checkOutUTC', 'truthDays', 'writerDays', 'truthEqualsWriter', 'truthBlockedDays', 'truthMissingDays', 'writerBlockedDays', 'writerExtraDays', 'severity'].join(',');
  const coverageLines = [coverageHeader, ...coverageRows.map(r => [r.bookingId, r.propertyId, r.status, r.source, r.imported, r.guestName, r.checkInUTC, r.checkOutUTC, r.truthDays, r.writerDays, r.truthEqualsWriter, r.truthBlockedDays, r.truthMissingDays, r.writerBlockedDays, r.writerExtraDays, r.severity].map(escape).join(','))];
  fs.writeFileSync(coverageCsvPath, coverageLines.join('\n'));
  console.log(`CSV written: ${coverageCsvPath} (${coverageRows.length} rows)`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
