// Export Romanian PAST guests for a property + a personalized RO re-engagement message.
//
// This is the CLI twin of the in-app export at /admin/guests ("Re-engagement export").
// Both share the pure logic in src/lib/guest-reengagement.ts so they never drift.
// (The admin version also excludes unsubscribed guests; this CLI export does not.)
//
// USAGE:
//   npx tsx scripts/export-romanian-guests.ts [property-slug]
//   e.g.  npx tsx scripts/export-romanian-guests.ts prahova-mountain-chalet
//         npx tsx scripts/export-romanian-guests.ts coltei-apartment-bucharest
//
// OUTPUT: ~/Downloads/romanian-guests-<property-slug>.csv
//   Columns: First Name, Last Name, Last Check-in Date, Phone Number, Message
//
// ============================================================================
// CONFIG — edit per campaign
// ============================================================================
import {
  DEFAULT_RO_MESSAGE_TEMPLATE,
  isRomanian,
  normalizeRoPhone,
  buildReengagementCsv,
  buildReengagementMessage,
  seasonPhraseRO,
  tidyFirstName,
  type ReengagementContact,
} from '../src/lib/guest-reengagement';

const CONFIG = {
  // Default property if none is passed on the command line.
  propertySlug: 'prahova-mountain-chalet',

  // Base URL for the shareable guest calendar (the per-property guest token is read live
  // from Firestore and appended). Change for a property on a different domain.
  calendarBaseUrl: 'https://prahova-chalet.ro',

  // Message text. Placeholders: {name}, {phrase}, {link}. Defaults to the shared template;
  // override here for a one-off campaign without touching the shared module.
  messageTemplate: DEFAULT_RO_MESSAGE_TEMPLATE,
};
// ============================================================================

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

admin.initializeApp({ credential: admin.credential.cert(path.resolve(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH!)) });
const db = admin.firestore();

const NOW = new Date(); // drives both the past-stay cutoff and the time phrasing

function parseDate(raw: any): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'object' && '_seconds' in raw) return new Date(raw._seconds * 1000);
  if (raw.toDate) return raw.toDate();
  if (typeof raw === 'string') { const d = new Date(raw); return isNaN(d.getTime()) ? null : d; }
  return null;
}

async function main() {
  const propertySlug = process.argv[2] || CONFIG.propertySlug;
  const todayStr = NOW.toISOString().slice(0, 10);

  const propDoc = await db.collection('properties').doc(propertySlug).get();
  if (!propDoc.exists) { console.error(`Property '${propertySlug}' not found.`); process.exit(1); }
  const token = propDoc.data()?.guestCalendarToken;
  if (!token) { console.error(`Property '${propertySlug}' has no guestCalendarToken.`); process.exit(1); }
  const calendarLink = `${CONFIG.calendarBaseUrl.replace(/\/$/, '')}/calendar/${token}`;

  const snap = await db.collection('bookings').where('propertyId', '==', propertySlug).get();

  type Rec = ReengagementContact & { key: string; t: number };
  const candidates: Rec[] = [];
  let droppedNoPhone = 0, droppedNoOrFutureDate = 0;

  snap.forEach((doc) => {
    const d = doc.data();
    if (d.status === 'cancelled') return;
    const gi = d.guestInfo || {};
    const rawPhone = (gi.phone || '').trim();
    if (!isRomanian(gi.country, rawPhone)) return;
    if (!rawPhone) { droppedNoPhone++; return; }

    const checkIn = parseDate(d.checkInDate);
    const ci = checkIn ? checkIn.toISOString().slice(0, 10) : '';
    if (!ci || ci > todayStr) { droppedNoOrFutureDate++; return; }

    const { norm } = normalizeRoPhone(rawPhone);
    candidates.push({
      firstName: (gi.firstName || '').trim(),
      lastName: (gi.lastName || '').trim(),
      lastCheckIn: ci,
      phone: rawPhone,
      key: norm || `${(gi.firstName || '').toLowerCase()}|${(gi.lastName || '').toLowerCase()}`,
      t: checkIn!.getTime(),
    });
  });

  const byKey = new Map<string, Rec>();
  for (const r of candidates) {
    const e = byKey.get(r.key);
    if (!e || r.t >= e.t) byKey.set(r.key, r);
  }
  const contacts: ReengagementContact[] = [...byKey.values()]
    .sort((a, b) => b.t - a.t)
    .map(({ firstName, lastName, lastCheckIn, phone }) => ({ firstName, lastName, lastCheckIn, phone }));

  const csv = buildReengagementCsv(contacts, { template: CONFIG.messageTemplate, link: calendarLink, now: NOW });
  const outCsv = path.join(os.homedir(), 'Downloads', `romanian-guests-${propertySlug}.csv`);
  fs.writeFileSync(outCsv, csv, 'utf8');

  console.log(`Property: ${propertySlug}`);
  console.log(`Calendar link: ${calendarLink}`);
  console.log(`Run date (cutoff for "past"): ${todayStr}`);
  console.log(`Unique Romanian PAST guests written: ${contacts.length}`);
  console.log(`Dropped (no phone): ${droppedNoPhone}`);
  console.log(`Dropped (no check-in date or upcoming/future stay): ${droppedNoOrFutureDate}`);
  console.log(`\nCSV: ${outCsv}`);
  console.log('\n--- Sample messages ---\n');
  [0, Math.floor(contacts.length / 2), contacts.length - 1].forEach((i) => {
    const c = contacts[i];
    if (c) console.log(buildReengagementMessage(CONFIG.messageTemplate, {
      name: tidyFirstName(c.firstName) || c.firstName,
      phrase: seasonPhraseRO(new Date(c.lastCheckIn), NOW),
      link: calendarLink,
    }) + '\n');
  });
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
