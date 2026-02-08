/**
 * One-time script to normalize country fields in Firestore to ISO 3166-1 alpha-2 codes.
 *
 * Processes:
 * 1. bookings collection: normalizes guestInfo.country
 * 2. guests collection: normalizes country
 *
 * Usage:
 *   npx tsx scripts/normalize-countries.ts          # dry run (default)
 *   npx tsx scripts/normalize-countries.ts --apply   # actually write changes
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

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

// Inline the normalization logic to avoid import path issues in scripts
const COUNTRY_MAP: Record<string, string> = {
  RO: 'Romania', DE: 'Germany', FR: 'France', GB: 'United Kingdom',
  IT: 'Italy', ES: 'Spain', NL: 'Netherlands', AT: 'Austria',
  BE: 'Belgium', CH: 'Switzerland', PL: 'Poland', HU: 'Hungary',
  CZ: 'Czech Republic', IL: 'Israel', US: 'United States', CA: 'Canada',
  SE: 'Sweden', DK: 'Denmark', NO: 'Norway', IE: 'Ireland',
  GR: 'Greece', PT: 'Portugal', BG: 'Bulgaria', HR: 'Croatia',
  UA: 'Ukraine', TR: 'Turkey', JP: 'Japan', KR: 'South Korea',
  AU: 'Australia', AR: 'Argentina', CL: 'Chile', CY: 'Cyprus',
  FI: 'Finland', MD: 'Moldova', SA: 'Saudi Arabia', TH: 'Thailand',
  AE: 'UAE', SK: 'Slovakia', SI: 'Slovenia', RS: 'Serbia',
  ME: 'Montenegro', BA: 'Bosnia and Herzegovina', MK: 'North Macedonia',
  AL: 'Albania', LT: 'Lithuania', LV: 'Latvia', EE: 'Estonia',
  MT: 'Malta', LU: 'Luxembourg', IS: 'Iceland', NZ: 'New Zealand',
  BR: 'Brazil', MX: 'Mexico', IN: 'India', CN: 'China',
  SG: 'Singapore', ZA: 'South Africa',
};

const NAME_TO_CODE: Record<string, string> = {};
for (const [code, name] of Object.entries(COUNTRY_MAP)) {
  NAME_TO_CODE[name.toLowerCase()] = code;
}

const CODE_CORRECTIONS: Record<string, string> = { UK: 'GB', UC: 'UA' };

function normalizeCountryCode(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();
  if (CODE_CORRECTIONS[upper]) return CODE_CORRECTIONS[upper];
  if (COUNTRY_MAP[upper]) return upper;
  const fromName = NAME_TO_CODE[trimmed.toLowerCase()];
  if (fromName) return fromName;
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return undefined;
}

const dryRun = !process.argv.includes('--apply');

async function main() {
  if (dryRun) {
    console.log('=== DRY RUN (pass --apply to write changes) ===\n');
  } else {
    console.log('=== APPLYING CHANGES ===\n');
  }

  // 1. Normalize bookings
  console.log('--- Bookings ---');
  const bookingsSnap = await db.collection('bookings').get();
  let bookingsUpdated = 0;
  let bookingsSkipped = 0;

  for (const doc of bookingsSnap.docs) {
    const data = doc.data();
    const country = data.guestInfo?.country;
    if (!country) { bookingsSkipped++; continue; }

    const normalized = normalizeCountryCode(country);
    if (!normalized || normalized === country) { bookingsSkipped++; continue; }

    console.log(`  booking ${doc.id}: "${country}" → "${normalized}"`);
    if (!dryRun) {
      await doc.ref.update({ 'guestInfo.country': normalized });
    }
    bookingsUpdated++;
  }

  console.log(`  Total: ${bookingsSnap.size} bookings, ${bookingsUpdated} updated, ${bookingsSkipped} skipped\n`);

  // 2. Normalize guests
  console.log('--- Guests ---');
  const guestsSnap = await db.collection('guests').get();
  let guestsUpdated = 0;
  let guestsSkipped = 0;

  for (const doc of guestsSnap.docs) {
    const data = doc.data();
    const country = data.country;
    if (!country) { guestsSkipped++; continue; }

    const normalized = normalizeCountryCode(country);
    if (!normalized || normalized === country) { guestsSkipped++; continue; }

    console.log(`  guest ${doc.id} (${data.firstName} ${data.lastName || ''}): "${country}" → "${normalized}"`);
    if (!dryRun) {
      await doc.ref.update({ country: normalized });
    }
    guestsUpdated++;
  }

  console.log(`  Total: ${guestsSnap.size} guests, ${guestsUpdated} updated, ${guestsSkipped} skipped\n`);

  console.log('Done.');
}

main().catch(console.error).finally(() => process.exit(0));
