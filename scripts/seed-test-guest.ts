// Seed (or delete) a single self-test guest so you appear in the campaign
// audience picker and can run the message step end-to-end with your own number.
//
// It writes ONE clearly-marked guest doc (isTestGuest: true) and touches NO
// bookings. The doc id is deterministic (`selftest-<digits>`) so re-runs are
// idempotent and cleanup is a one-liner.
//
// Usage:
//   npx tsx scripts/seed-test-guest.ts <phoneE164> [--name="Your Name"] [--lang=ro|en] [--property=<slug>]
//   npx tsx scripts/seed-test-guest.ts <phoneE164> --delete
//
// Examples:
//   npx tsx scripts/seed-test-guest.ts +40712345678 --name="Bogdan" --lang=ro
//   npx tsx scripts/seed-test-guest.ts +40712345678 --delete
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(path.resolve(serviceAccountPath)) });
const db = admin.firestore();

function argValue(flag: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1).replace(/^["']|["']$/g, '') : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const phoneRaw = args.find((a) => !a.startsWith('--'));
  if (!phoneRaw) {
    console.error('Provide your phone in E.164, e.g. +40712345678');
    process.exit(1);
  }
  // Normalize to +<digits> (must match what wa.me will dial).
  const digits = phoneRaw.replace(/[^\d]/g, '');
  const e164 = phoneRaw.trim().startsWith('+') ? `+${digits}` : `+${digits}`;
  const docId = `selftest-${digits}`;
  const ref = db.collection('guests').doc(docId);

  if (args.includes('--delete')) {
    await ref.delete();
    console.log(`Deleted test guest ${docId}.`);
    return;
  }

  const name = argValue('--name') || 'Self Test';
  const lang = (argValue('--lang') || 'ro') === 'en' ? 'en' : 'ro';
  const property = argValue('--property') || 'prahova-mountain-chalet';

  await ref.set(
    {
      firstName: name,
      lastName: '(self-test)',
      phone: e164,
      normalizedPhone: e164,
      language: lang,
      country: lang === 'ro' ? 'RO' : undefined,
      propertyIds: [property],       // ← how the picker scopes guests to a property
      totalBookings: 1,
      totalSpent: 0,
      lastStayDate: admin.firestore.Timestamp.fromDate(new Date('2025-08-15')),
      isTestGuest: true,             // marker for easy identification / cleanup
      // Deliberately absent → keeps the guest ELIGIBLE:
      //   unsubscribed / channelConsent  → not opted out
      //   bookingIds                     → no active future booking
      //   lastCampaignAt                 → not frequency-capped
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`✅ Seeded eligible test guest:`);
  console.log(`   id        ${docId}`);
  console.log(`   name      ${name} (self-test)`);
  console.log(`   phone     ${e164}`);
  console.log(`   language  ${lang}`);
  console.log(`   property  ${property}`);
  console.log(`\nIt will show up (eligible) in the picker at /admin/campaigns/new for that property.`);
  console.log(`Clean up afterwards:  npx tsx scripts/seed-test-guest.ts ${e164} --delete`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
