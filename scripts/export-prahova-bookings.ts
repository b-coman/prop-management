/**
 * One-off analytics export: all bookings for Prahova Mountain Chalet.
 * Writes a UTF-8 CSV (with BOM for Excel) to the user's Downloads folder.
 * Usage: npx tsx scripts/export-prahova-bookings.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
admin.initializeApp({ credential: admin.credential.cert(path.resolve(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH!)) });
const db = admin.firestore();

const PROPERTY = 'prahova-mountain-chalet';
const MS_DAY = 86400000;

function tsToDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v._seconds === 'number') return new Date(v._seconds * 1000);
  if (v instanceof Date) return v;
  if (typeof v === 'string') { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  if (typeof v.toDate === 'function') return v.toDate();
  return null;
}

// Format a Date as YYYY-MM-DD in Bucharest local time (property timezone).
const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
});
function fmtDate(d: Date | null): string {
  return d ? dateFmt.format(d) : '';
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

(async () => {
  const snap = await db.collection('bookings').where('propertyId', '==', PROPERTY).get();

  type Row = Record<string, unknown> & { _checkIn: Date | null };
  const rows: Row[] = [];

  snap.forEach(doc => {
    const b = doc.data();
    const ci = tsToDate(b.checkInDate);
    const co = tsToDate(b.checkOutDate);
    const p = b.pricing || {};
    const nights = p.numberOfNights ?? (ci && co ? Math.round((co.getTime() - ci.getTime()) / MS_DAY) : null);
    const total = typeof p.total === 'number' ? p.total : null;
    const revPerNight = total != null && nights ? Math.round((total / nights) * 100) / 100 : null;

    // Booking (reservation) date: prefer real bookedAt, fall back to createdAt (set per-booking on import).
    const bookedAt = tsToDate(b.bookedAt);
    const createdAt = tsToDate(b.createdAt);
    const bookingDate = bookedAt ?? createdAt;
    const bookingDateBasis = bookedAt ? 'bookedAt' : (createdAt ? 'createdAt' : '');

    const name = [b.guestInfo?.firstName, b.guestInfo?.lastName].filter(Boolean).join(' ').trim();

    rows.push({
      _checkIn: ci,
      'Booking ID': doc.id,
      'Guest Name': name,
      'Country': b.guestInfo?.country || '',
      'Source': b.source || '',
      'Status': b.status || '',
      'Check-in': fmtDate(ci),
      'Check-out': fmtDate(co),
      'Nights': nights ?? '',
      'Guests': b.numberOfGuests ?? '',
      'Adults': b.numberOfAdults ?? '',
      'Children': b.numberOfChildren ?? '',
      'Base Rate/Night (RON)': p.baseRate ?? '',
      'Cleaning Fee (RON)': p.cleaningFee ?? '',
      'Discount (RON)': p.discountAmount ?? '',
      'Revenue Total (RON)': total ?? '',
      'Revenue/Night (RON)': revPerNight ?? '',
      'Currency': p.currency || '',
      'Payment Status': b.paymentInfo?.status || '',
      'Booking Date': fmtDate(bookingDate),
      'Booking Date Basis': bookingDateBasis,
      'Imported': b.imported ? 'yes' : 'no',
      'External ID': b.externalId || '',
      'Notes': b.notes || '',
    });
  });

  // Sort by check-in date ascending (nulls last)
  rows.sort((a, b) => {
    const ta = a._checkIn ? a._checkIn.getTime() : Infinity;
    const tb = b._checkIn ? b._checkIn.getTime() : Infinity;
    return ta - tb;
  });

  const headers = Object.keys(rows[0]).filter(h => h !== '_checkIn');
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map(h => csvCell(r[h])).join(','));
  }

  const outPath = path.join(os.homedir(), 'Downloads', 'prahova-mountain-chalet-bookings-2026-07-07.csv');
  fs.writeFileSync(outPath, '﻿' + lines.join('\n') + '\n', 'utf8');

  // ---- Console summary (realized = excludes cancelled) ----
  const realized = rows.filter(r => r['Status'] !== 'cancelled');
  const sum = (arr: Row[], key: string) => arr.reduce((s, r) => s + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0);
  const bySource: Record<string, { n: number; nights: number; rev: number }> = {};
  for (const r of realized) {
    const s = r['Source'] as string;
    bySource[s] ??= { n: 0, nights: 0, rev: 0 };
    bySource[s].n++;
    bySource[s].nights += (r['Nights'] as number) || 0;
    bySource[s].rev += (r['Revenue Total (RON)'] as number) || 0;
  }

  console.log(`\nWrote ${rows.length} bookings to:\n  ${outPath}\n`);
  console.log(`Realized (excl. cancelled): ${realized.length} bookings`);
  console.log(`  Total nights:   ${sum(realized, 'Nights')}`);
  console.log(`  Total guests:   ${sum(realized, 'Guests')}`);
  console.log(`  Total revenue:  ${sum(realized, 'Revenue Total (RON)').toLocaleString('en-US')} RON`);
  console.log(`  Avg revenue/booking: ${Math.round(sum(realized, 'Revenue Total (RON)') / realized.length)} RON`);
  console.log(`  Avg revenue/night:   ${Math.round(sum(realized, 'Revenue Total (RON)') / sum(realized, 'Nights'))} RON`);
  console.log('\nBy source (realized):');
  Object.entries(bySource).sort((a, b) => b[1].rev - a[1].rev).forEach(([s, v]) => {
    console.log(`  ${s.padEnd(13)} ${String(v.n).padStart(3)} bookings | ${String(v.nights).padStart(4)} nights | ${v.rev.toLocaleString('en-US').padStart(9)} RON`);
  });
  process.exit(0);
})();
