// READ-ONLY audit of how checkInDate / checkOutDate are stored across the bookings collection.
//
// Outputs:
//   - Summary table to stdout (counts by convention, status, source)
//   - Detail CSV: scripts/booking-date-audit.csv
//   - Outliers report to stdout (anything not matching expected conventions)
//
// Usage: npx tsx scripts/audit-booking-dates.ts
//   Optional: --property=<slug> to filter to a single property
//   Optional: --upcoming-only to limit to bookings with checkInDate >= today
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

type Convention =
  | 'utc-midnight'              // 00:00 UTC — guest flow / admin form (parseISO)
  | 'bucharest-midnight-eest'   // 21:00 UTC = 00:00 Bucharest in summer (UTC+3)
  | 'bucharest-midnight-eet'    // 22:00 UTC = 00:00 Bucharest in winter (UTC+2)
  | 'bucharest-midnight'        // 00:00 in Bucharest TZ (any season) — superset, used when DST is ambiguous
  | 'has-time'                  // Real time-of-day (not midnight in any common TZ)
  | 'string'                    // Stored as string, not Timestamp
  | 'null'                      // Missing
  | 'unknown';                  // Anything else

interface DateClassification {
  convention: Convention;
  utcIso: string | null;
  bucharestIso: string | null;
  utcHour: number | null;
  bucharestHour: number | null;
  rawType: string;
  rawValue: string;
}

const NULL_CLASSIFICATION: DateClassification = {
  convention: 'null',
  utcIso: null,
  bucharestIso: null,
  utcHour: null,
  bucharestHour: null,
  rawType: 'null',
  rawValue: '',
};

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

const bucharestFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatBucharest(d: Date): string {
  // en-CA gives YYYY-MM-DD, then ", HH:MM"
  return bucharestFormatter.format(d).replace(', ', ' ');
}

function bucharestHourMinute(d: Date): { hour: number; minute: number } {
  const parts = bucharestFormatter.formatToParts(d);
  let hour = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
  // Intl.DateTimeFormat with en-CA + hour12:false returns "24" for midnight on some Node versions
  if (hour === 24) hour = 0;
  return { hour, minute };
}

function classify(value: unknown): DateClassification {
  if (value == null) return NULL_CLASSIFICATION;

  const rawType =
    value instanceof admin.firestore.Timestamp ? 'Timestamp'
    : value instanceof Date ? 'Date'
    : typeof value === 'string' ? 'string'
    : typeof value === 'object' && '_seconds' in (value as Record<string, unknown>) ? 'object{_seconds}'
    : typeof value;

  const rawValue =
    value instanceof admin.firestore.Timestamp ? `Timestamp(${value.seconds}.${value.nanoseconds})`
    : typeof value === 'string' ? value
    : JSON.stringify(value);

  const d = toDate(value);
  if (!d) {
    return {
      convention: 'unknown',
      utcIso: null,
      bucharestIso: null,
      utcHour: null,
      bucharestHour: null,
      rawType,
      rawValue,
    };
  }

  const utcHour = d.getUTCHours();
  const utcMinute = d.getUTCMinutes();
  const utcSecond = d.getUTCSeconds();
  const { hour: buHour, minute: buMinute } = bucharestHourMinute(d);

  let convention: Convention;
  if (typeof value === 'string') {
    convention = 'string';
  } else if (utcHour === 0 && utcMinute === 0 && utcSecond === 0) {
    convention = 'utc-midnight';
  } else if (buHour === 0 && buMinute === 0) {
    // Local midnight in Bucharest, regardless of DST
    if (utcHour === 21) convention = 'bucharest-midnight-eest';
    else if (utcHour === 22) convention = 'bucharest-midnight-eet';
    else convention = 'bucharest-midnight';
  } else {
    convention = 'has-time';
  }

  return {
    convention,
    utcIso: d.toISOString(),
    bucharestIso: formatBucharest(d),
    utcHour,
    bucharestHour: buHour,
    rawType,
    rawValue,
  };
}

interface BookingRow {
  id: string;
  propertyId: string;
  status: string;
  source: string;
  imported: boolean;
  guestName: string;
  checkIn: DateClassification;
  checkOut: DateClassification;
  conventionsMatch: boolean;
  isFuture: boolean;
  isActive: boolean;
  isPast: boolean;
  createdAt: string;
}

function isFuture(d: Date | null, today: Date): boolean {
  if (!d) return false;
  return d.getTime() > today.getTime();
}

async function main() {
  console.log('Reading bookings collection (this may take a moment)...');

  let query: FirebaseFirestore.Query = db.collection('bookings');
  if (propertyFilter) {
    query = query.where('propertyId', '==', propertyFilter);
    console.log(`Filtering to propertyId == ${propertyFilter}`);
  }

  const snapshot = await query.get();
  console.log(`Read ${snapshot.size} bookings.\n`);

  const today = new Date();
  const rows: BookingRow[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const checkIn = classify(data.checkInDate);
    const checkOut = classify(data.checkOutDate);
    const checkInDate = toDate(data.checkInDate);
    const checkOutDate = toDate(data.checkOutDate);

    const future = isFuture(checkInDate, today);
    const active = checkInDate != null && checkOutDate != null
      && checkInDate.getTime() <= today.getTime()
      && checkOutDate.getTime() > today.getTime();
    const past = checkOutDate != null && checkOutDate.getTime() <= today.getTime();

    if (upcomingOnly && !future && !active) continue;

    const guestName = [data.guestInfo?.firstName, data.guestInfo?.lastName]
      .filter(Boolean).join(' ') || '(no name)';

    const createdAtDate = toDate(data.createdAt);

    rows.push({
      id: doc.id,
      propertyId: data.propertyId || '',
      status: data.status || '',
      source: data.source || '',
      imported: !!data.imported,
      guestName,
      checkIn,
      checkOut,
      conventionsMatch: checkIn.convention === checkOut.convention,
      isFuture: future,
      isActive: active,
      isPast: past,
      createdAt: createdAtDate ? createdAtDate.toISOString() : '',
    });
  }

  // ---- Summary tables ----

  const tally = (key: (r: BookingRow) => string) => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(key(r), (counts.get(key(r)) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  };

  console.log('===========================================');
  console.log(`TOTAL BOOKINGS ANALYZED: ${rows.length}`);
  if (upcomingOnly) console.log('(filter: upcoming/active only)');
  console.log('===========================================\n');

  console.log('--- checkInDate convention ---');
  for (const [k, v] of tally(r => r.checkIn.convention)) console.log(`  ${k.padEnd(28)} ${v}`);
  console.log('');

  console.log('--- checkOutDate convention ---');
  for (const [k, v] of tally(r => r.checkOut.convention)) console.log(`  ${k.padEnd(28)} ${v}`);
  console.log('');

  console.log('--- Convention by source ---');
  const bySource = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const s = r.source || '(none)';
    if (!bySource.has(s)) bySource.set(s, new Map());
    const m = bySource.get(s)!;
    const k = r.checkIn.convention;
    m.set(k, (m.get(k) || 0) + 1);
  }
  for (const [src, m] of [...bySource.entries()].sort()) {
    console.log(`  source = ${src}:`);
    for (const [k, v] of [...m.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(28)} ${v}`);
    }
  }
  console.log('');

  console.log('--- Convention by status ---');
  const byStatus = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const s = r.status || '(none)';
    if (!byStatus.has(s)) byStatus.set(s, new Map());
    const m = byStatus.get(s)!;
    const k = r.checkIn.convention;
    m.set(k, (m.get(k) || 0) + 1);
  }
  for (const [st, m] of [...byStatus.entries()].sort()) {
    console.log(`  status = ${st}:`);
    for (const [k, v] of [...m.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(28)} ${v}`);
    }
  }
  console.log('');

  console.log('--- Future / Active bookings by convention ---');
  const futureRows = rows.filter(r => r.isFuture || r.isActive);
  console.log(`  total future + active: ${futureRows.length}`);
  for (const [k, v] of tally(r => r.checkIn.convention).map(([k, _]) => [k, futureRows.filter(r => r.checkIn.convention === k).length] as [string, number]).filter(([_, v]) => v > 0)) {
    console.log(`    ${k.padEnd(28)} ${v}`);
  }
  console.log('');

  // ---- Outliers ----

  const mismatched = rows.filter(r => !r.conventionsMatch);
  if (mismatched.length > 0) {
    console.log(`!!! ${mismatched.length} bookings have DIFFERENT conventions for checkIn vs checkOut`);
    for (const r of mismatched.slice(0, 10)) {
      console.log(`  ${r.id}  ${r.guestName.padEnd(28)}  in=${r.checkIn.convention}  out=${r.checkOut.convention}  utc(${r.checkIn.utcIso} → ${r.checkOut.utcIso})`);
    }
    if (mismatched.length > 10) console.log(`  ... and ${mismatched.length - 10} more (see CSV)`);
    console.log('');
  } else {
    console.log('All bookings have matching conventions for checkIn and checkOut.\n');
  }

  const unexpected = rows.filter(r =>
    r.checkIn.convention === 'unknown' ||
    r.checkIn.convention === 'has-time' ||
    r.checkIn.convention === 'string' ||
    (r.checkIn.convention === 'bucharest-midnight' && r.checkIn.utcHour !== 21 && r.checkIn.utcHour !== 22)
  );
  if (unexpected.length > 0) {
    console.log(`!!! ${unexpected.length} bookings have UNEXPECTED conventions (not utc-midnight or bucharest-midnight-eet/eest)`);
    for (const r of unexpected.slice(0, 10)) {
      console.log(`  ${r.id}  ${r.guestName.padEnd(28)}  conv=${r.checkIn.convention}  type=${r.checkIn.rawType}  raw=${r.checkIn.rawValue}`);
    }
    if (unexpected.length > 10) console.log(`  ... and ${unexpected.length - 10} more (see CSV)`);
    console.log('');
  } else {
    console.log('No unexpected conventions found.\n');
  }

  // ---- CSV ----

  const csvPath = path.resolve(process.cwd(), 'scripts', 'booking-date-audit.csv');
  const header = [
    'id', 'propertyId', 'status', 'source', 'imported', 'guestName',
    'isFuture', 'isActive', 'isPast', 'createdAt', 'conventionsMatch',
    'checkIn_convention', 'checkIn_utc', 'checkIn_bucharest', 'checkIn_utcHour', 'checkIn_buHour', 'checkIn_rawType',
    'checkOut_convention', 'checkOut_utc', 'checkOut_bucharest', 'checkOut_utcHour', 'checkOut_buHour', 'checkOut_rawType',
  ].join(',');

  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [header];
  for (const r of rows) {
    lines.push([
      r.id, r.propertyId, r.status, r.source, r.imported, r.guestName,
      r.isFuture, r.isActive, r.isPast, r.createdAt, r.conventionsMatch,
      r.checkIn.convention, r.checkIn.utcIso, r.checkIn.bucharestIso, r.checkIn.utcHour, r.checkIn.bucharestHour, r.checkIn.rawType,
      r.checkOut.convention, r.checkOut.utcIso, r.checkOut.bucharestIso, r.checkOut.utcHour, r.checkOut.bucharestHour, r.checkOut.rawType,
    ].map(escape).join(','));
  }

  fs.writeFileSync(csvPath, lines.join('\n'));
  console.log(`CSV written: ${csvPath}`);
  console.log(`(${rows.length} rows)`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
