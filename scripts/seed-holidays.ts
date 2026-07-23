#!/usr/bin/env npx tsx
/**
 * seed-holidays — populate the `holidays` collection with Romanian public holidays and the
 * official school-year calendar.
 *
 * These are FETCHED FACTS, never computed. Romania uses Orthodox (Julian) Easter and the school
 * calendar is set by ministerial order — deriving either in code is how you poison every
 * downstream occasion decision. Sources are recorded per row.
 *
 * Schema: docs/implementation/firestore-pricing-structure.md §5, plus three additive fields
 * (`bridge-day` type, `source`, `official`). Doc id: {countryCode}_{slug}_{year}.
 *
 * Usage:
 *   npx tsx scripts/seed-holidays.ts --dry-run     # print what would be written
 *   npx tsx scripts/seed-holidays.ts               # write (idempotent, merge)
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '../src/lib/firebaseAdminSafe';

const DRY = process.argv.includes('--dry-run');

const SRC_HOL_2026 = 'https://zilelibere.com/zilelibere2026.html';
const SRC_HOL_2027 = 'https://zilelibere.com/zilelibere2027.html';
const SRC_SCHOOL = 'https://www.edupedu.ro/oficial-calendarul-anului-scolar-2026-2027-publicat-in-monitorul-oficial-cursurile-incep-pe-7-septembrie-si-se-incheie-pe-18-iunie/';

type Row = {
  slug: string; name: string; startDate: string; endDate: string;
  type: 'major' | 'minor' | 'school-break' | 'bridge-day';
  source: string; official: boolean; notes?: string;
};

// `major` = creates a real travel window (multi-day, or a day that bridges into a weekend).
// `minor` = a legal day off that historically does not move leisure demand on its own.
const ROWS: Row[] = [
  // ---------------- 2026 public holidays ----------------
  { slug: 'anul-nou', name: 'Anul Nou', startDate: '2026-01-01', endDate: '2026-01-02', type: 'major', source: SRC_HOL_2026, official: true, notes: 'Thu-Fri' },
  { slug: 'boboteaza', name: 'Boboteaza', startDate: '2026-01-06', endDate: '2026-01-06', type: 'minor', source: SRC_HOL_2026, official: true, notes: 'Tue' },
  { slug: 'sf-ioan', name: 'Sfantul Ioan Botezatorul', startDate: '2026-01-07', endDate: '2026-01-07', type: 'minor', source: SRC_HOL_2026, official: true, notes: 'Wed' },
  { slug: 'ziua-unirii', name: 'Ziua Unirii Principatelor Romane', startDate: '2026-01-24', endDate: '2026-01-24', type: 'minor', source: SRC_HOL_2026, official: true, notes: 'Sat — falls on a weekend' },
  { slug: 'paste', name: 'Pastele ortodox', startDate: '2026-04-10', endDate: '2026-04-13', type: 'major', source: SRC_HOL_2026, official: true, notes: 'Fri-Mon, 4-day window' },
  { slug: 'ziua-muncii', name: 'Ziua Muncii', startDate: '2026-05-01', endDate: '2026-05-01', type: 'major', source: SRC_HOL_2026, official: true, notes: 'Fri — 3-day weekend' },
  { slug: 'rusalii', name: 'Rusalii', startDate: '2026-05-31', endDate: '2026-06-01', type: 'major', source: SRC_HOL_2026, official: true, notes: 'Sun-Mon; 1 Jun is also Ziua Copilului — family window' },
  { slug: 'sf-maria', name: 'Adormirea Maicii Domnului', startDate: '2026-08-15', endDate: '2026-08-15', type: 'minor', source: SRC_HOL_2026, official: true, notes: 'Sat — falls on a weekend' },
  { slug: 'sf-andrei-ziua-nationala', name: 'Sfantul Andrei + Ziua Nationala', startDate: '2026-11-30', endDate: '2026-12-01', type: 'major', source: SRC_HOL_2026, official: true, notes: 'Mon+Tue after a weekend = 4-day window Sat 28 Nov -> Tue 1 Dec. November is the weakest autumn month; this is its only anchor.' },
  { slug: 'craciun', name: 'Craciunul', startDate: '2026-12-25', endDate: '2026-12-26', type: 'major', source: SRC_HOL_2026, official: true, notes: 'Fri-Sat' },

  // ---------------- 2027 public holidays ----------------
  { slug: 'anul-nou', name: 'Anul Nou', startDate: '2027-01-01', endDate: '2027-01-02', type: 'major', source: SRC_HOL_2027, official: true, notes: 'Fri-Sat' },
  { slug: 'boboteaza', name: 'Boboteaza', startDate: '2027-01-06', endDate: '2027-01-06', type: 'minor', source: SRC_HOL_2027, official: true, notes: 'Wed' },
  { slug: 'sf-ioan', name: 'Sfantul Ioan Botezatorul', startDate: '2027-01-07', endDate: '2027-01-07', type: 'minor', source: SRC_HOL_2027, official: true, notes: 'Thu' },
  { slug: 'ziua-unirii', name: 'Ziua Unirii Principatelor Romane', startDate: '2027-01-24', endDate: '2027-01-24', type: 'minor', source: SRC_HOL_2027, official: true, notes: 'Sun' },
  { slug: 'paste', name: 'Pastele ortodox', startDate: '2027-04-30', endDate: '2027-05-03', type: 'major', source: SRC_HOL_2027, official: true, notes: 'Fri-Mon; overlaps Ziua Muncii (Sat 1 May) — a single long window' },
  { slug: 'ziua-muncii', name: 'Ziua Muncii', startDate: '2027-05-01', endDate: '2027-05-01', type: 'minor', source: SRC_HOL_2027, official: true, notes: 'Sat — absorbed into the Easter window' },
  { slug: 'ziua-copilului', name: 'Ziua Copilului', startDate: '2027-06-01', endDate: '2027-06-01', type: 'minor', source: SRC_HOL_2027, official: true, notes: 'Tue' },
  { slug: 'rusalii', name: 'Rusalii', startDate: '2027-06-20', endDate: '2027-06-21', type: 'major', source: SRC_HOL_2027, official: true, notes: 'Sun-Mon — 3-day window' },
  { slug: 'sf-maria', name: 'Adormirea Maicii Domnului', startDate: '2027-08-15', endDate: '2027-08-15', type: 'minor', source: SRC_HOL_2027, official: true, notes: 'Sun' },
  { slug: 'sf-andrei-ziua-nationala', name: 'Sfantul Andrei + Ziua Nationala', startDate: '2027-11-30', endDate: '2027-12-01', type: 'major', source: SRC_HOL_2027, official: true, notes: 'Tue+Wed — midweek, weaker than 2026' },
  { slug: 'craciun', name: 'Craciunul', startDate: '2027-12-25', endDate: '2027-12-26', type: 'major', source: SRC_HOL_2027, official: true, notes: 'Sat-Sun' },

  // ---------------- school year 2026-2027 (Monitorul Oficial) ----------------
  { slug: 'scoala-start', name: 'Inceputul cursurilor 2026-2027', startDate: '2026-09-07', endDate: '2026-09-07', type: 'school-break', source: SRC_SCHOOL, official: true, notes: 'Marker, not a break. Courses run 7 Sep 2026 -> 18 Jun 2027 (36 weeks). Anything before this date sells on "before school starts".' },
  { slug: 'vacanta-toamna', name: 'Vacanta de toamna', startDate: '2026-10-24', endDate: '2026-11-01', type: 'school-break', source: SRC_SCHOOL, official: true, notes: '9 days. The main autumn family window.' },
  { slug: 'vacanta-iarna', name: 'Vacanta de iarna', startDate: '2026-12-23', endDate: '2027-01-10', type: 'school-break', source: SRC_SCHOOL, official: true, notes: '19 days, contains Craciun (Fri-Sat) and Anul Nou.' },
  { slug: 'vacanta-mobila-fereastra', name: 'Vacanta mobila (fereastra)', startDate: '2027-02-15', endDate: '2027-03-07', type: 'school-break', source: SRC_SCHOOL, official: true, notes: 'NOT a 3-week break. Each county picks ONE week inside this window; Bucuresti\'s choice is the one that matters for Prahova. Treat as uncertain until the county decision is known.' },
  { slug: 'vacanta-primavara', name: 'Vacanta de primavara', startDate: '2027-04-24', endDate: '2027-05-04', type: 'school-break', source: SRC_SCHOOL, official: true, notes: '11 days, wraps the Orthodox Easter window (30 Apr - 3 May).' },
  { slug: 'vacanta-vara', name: 'Vacanta de vara', startDate: '2027-06-19', endDate: '2027-09-05', type: 'school-break', source: SRC_SCHOOL, official: true, notes: 'Courses end 18 Jun 2027.' },
];

async function main() {
  const db = await getAdminDb();
  const col = db.collection('holidays');
  let written = 0;

  for (const r of ROWS) {
    const year = Number(r.startDate.slice(0, 4));
    const id = `RO_${r.slug}_${year}`;
    const doc = {
      id, name: r.name, countryCode: 'RO', year,
      startDate: r.startDate, endDate: r.endDate,
      type: r.type, source: r.source, official: r.official,
      notes: r.notes ?? '',
    };
    if (DRY) {
      console.log(`${id.padEnd(38)} ${r.startDate} → ${r.endDate}  [${r.type}]`);
    } else {
      await col.doc(id).set(doc, { merge: true });
      written++;
    }
  }

  if (DRY) console.log(`\n${ROWS.length} rows (dry run — nothing written).`);
  else console.log(`Seeded ${written} holiday rows into \`holidays\`.`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
