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
const SRC_HOL_2028 = 'https://zilelibere.com/zilelibere2028.html';
const SRC_SCHOOL_2025 = 'OMEC nr. 3463/2025 — https://idays.ro/vacante/2025-2026';
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

  // ---------------- the festive stretch (owner's observation, not law) ----------------
  // "In real terms, nobody works between Christmas and NY" — owner, 2026-09-07.
  //
  // These are the only `bridge-day` rows in the collection, and they exist because
  // `travelWindow` bridges at most 1-2 working days. Between Craciun and Anul Nou
  // there are four or five, so without these it splits one continuous holiday into
  // two three-night windows and prices the middle as ordinary winter. With them it
  // returns 24 Dec -> 3 Jan as a single 10-night stretch, which is what people
  // actually book.
  //
  // `official: false` on purpose: this is observed demand behaviour, not a legal
  // day off, and the distinction matters if anyone ever reasons about entitlement.
  // It does NOT set prices — the stretch is still sold as four priced products
  // (Christmas / Pre-New Year / New Year's Eve / Post-New Year), which is a
  // PERIOD decision, not a holiday-calendar one.
  { slug: 'punte-craciun-revelion', name: 'Punte Craciun-Revelion', startDate: '2026-12-28', endDate: '2026-12-31', type: 'bridge-day', source: 'owner observation 2026-09-07', official: false, notes: 'Mon-Thu between Craciun (Fri-Sat) and Anul Nou (Fri-Sat). Nominally working days; in practice almost nobody works them.' },
  { slug: 'punte-craciun-revelion', name: 'Punte Craciun-Revelion', startDate: '2027-12-27', endDate: '2027-12-31', type: 'bridge-day', source: 'owner observation 2026-09-07', official: false, notes: 'Mon-Fri between Craciun (Sat-Sun) and Anul Nou (Sat-Sun). Five working days on paper, none in practice.' },

  // ---------------- 2028 public holidays ----------------
  // Dates from the source; WEEKDAYS computed, not copied — the page's own weekday column disagreed
  // with the calendar on several rows (it put New Year on a Sunday and Christmas on Tue-Wed).
  { slug: 'anul-nou', name: 'Anul Nou', startDate: '2028-01-01', endDate: '2028-01-02', type: 'major', source: SRC_HOL_2028, official: true, notes: 'Sat-Sun — falls entirely on a weekend.' },
  { slug: 'boboteaza', name: 'Boboteaza', startDate: '2028-01-06', endDate: '2028-01-06', type: 'minor', source: SRC_HOL_2028, official: true, notes: 'Thu' },
  { slug: 'sf-ioan', name: 'Sfantul Ioan Botezatorul', startDate: '2028-01-07', endDate: '2028-01-07', type: 'minor', source: SRC_HOL_2028, official: true, notes: 'Fri — with Boboteaza on Thu, a four-day run into the weekend.' },
  { slug: 'ziua-unirii', name: 'Ziua Unirii Principatelor Romane', startDate: '2028-01-24', endDate: '2028-01-24', type: 'minor', source: SRC_HOL_2028, official: true, notes: 'Mon — a long weekend, unlike 2026 (Sat) and 2027 (Sun).' },
  { slug: 'paste', name: 'Pastele ortodox', startDate: '2028-04-14', endDate: '2028-04-17', type: 'major', source: SRC_HOL_2028, official: true, notes: 'Fri-Mon; Easter Sunday 16 Apr.' },
  { slug: 'ziua-muncii', name: 'Ziua Muncii', startDate: '2028-05-01', endDate: '2028-05-01', type: 'major', source: SRC_HOL_2028, official: true, notes: 'Mon — a three-day weekend, and clear of Easter this year.' },
  { slug: 'ziua-copilului', name: 'Ziua Copilului', startDate: '2028-06-01', endDate: '2028-06-01', type: 'minor', source: SRC_HOL_2028, official: true, notes: 'Thu' },
  { slug: 'rusalii', name: 'Rusalii', startDate: '2028-06-04', endDate: '2028-06-05', type: 'major', source: SRC_HOL_2028, official: true, notes: 'Sun-Mon — a three-day window.' },
  { slug: 'sf-maria', name: 'Adormirea Maicii Domnului', startDate: '2028-08-15', endDate: '2028-08-15', type: 'minor', source: SRC_HOL_2028, official: true, notes: 'Tue' },
  { slug: 'sf-andrei-ziua-nationala', name: 'Sfantul Andrei + Ziua Nationala', startDate: '2028-11-30', endDate: '2028-12-01', type: 'major', source: SRC_HOL_2028, official: true, notes: 'Thu+Fri — a four-day run into the weekend, the strongest shape this holiday takes.' },
  { slug: 'craciun', name: 'Craciunul', startDate: '2028-12-25', endDate: '2028-12-26', type: 'major', source: SRC_HOL_2028, official: true, notes: 'Mon-Tue' },

  // ---------------- school year 2025-2026 (OMEC 3463/2025) ----------------
  // Seeded late, and only from the winter break onward: the pricing horizon starts in January 2026
  // and rows before that price nothing. Their absence is why the 2026 Easter period had no anchor to
  // check against — the rule looked for a spring break the collection did not have.
  { slug: 'vacanta-iarna', name: 'Vacanta de iarna', startDate: '2025-12-20', endDate: '2026-01-07', type: 'school-break', source: SRC_SCHOOL_2025, official: true, notes: '19 days, ends 7 Jan 2026.' },
  { slug: 'vacanta-mobila-fereastra', name: 'Vacanta mobila (fereastra)', startDate: '2026-02-09', endDate: '2026-03-01', type: 'school-break', source: SRC_SCHOOL_2025, official: true, notes: 'Each county picks ONE week inside this window. Confirmed against edu.ro, which publishes the window and not the county choices.' },
  { slug: 'vacanta-primavara', name: 'Vacanta de primavara', startDate: '2026-04-04', endDate: '2026-04-14', type: 'school-break', source: SRC_SCHOOL_2025, official: true, notes: '11 days, wraps Orthodox Easter (12 Apr 2026). NOTE: the hand-drawn 2026 Easter pricing period ran 10-20 Apr, which is neither this break nor the holiday window — it is recorded as a 2026 exception.' },
  { slug: 'vacanta-vara', name: 'Vacanta de vara', startDate: '2026-06-20', endDate: '2026-09-06', type: 'school-break', source: SRC_SCHOOL_2025, official: true, notes: 'Courses ended 19 Jun 2026.' },

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
