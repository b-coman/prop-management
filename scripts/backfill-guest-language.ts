// Backfill script: set language to 'en' for all guests whose country is not Romania (RO).
// Usage:
//   npx tsx scripts/backfill-guest-language.ts          # dry run (default)
//   npx tsx scripts/backfill-guest-language.ts --apply   # actually update Firestore

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

async function main() {
  const dryRun = !process.argv.includes('--apply');

  if (dryRun) {
    console.log('DRY RUN — pass --apply to actually update Firestore\n');
  }

  const snapshot = await db.collection('guests').get();
  console.log(`Total guests: ${snapshot.size}`);

  const toUpdate: Array<{ id: string; name: string; country: string; currentLang: string }> = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const country = data.country;
    const language = data.language;

    // Skip guests without a country — we can't determine anything
    if (!country) continue;

    // Skip Romanian guests — they should keep their current language
    if (country === 'RO') continue;

    // Skip guests already set to English
    if (language === 'en') continue;

    toUpdate.push({
      id: doc.id,
      name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      country,
      currentLang: language || '(none)',
    });
  }

  console.log(`Guests to update: ${toUpdate.length}\n`);

  for (const guest of toUpdate) {
    console.log(`  ${guest.name} (${guest.id}) — country=${guest.country}, lang=${guest.currentLang} → en`);
  }

  if (toUpdate.length === 0) {
    console.log('\nNothing to update.');
    return;
  }

  if (dryRun) {
    console.log('\nDRY RUN — no changes made. Pass --apply to update.');
    return;
  }

  // Batch update
  const batchSize = 500;
  let updated = 0;

  for (let i = 0; i < toUpdate.length; i += batchSize) {
    const batch = db.batch();
    const chunk = toUpdate.slice(i, i + batchSize);

    for (const guest of chunk) {
      batch.update(db.collection('guests').doc(guest.id), {
        language: 'en',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    updated += chunk.length;
    console.log(`\nCommitted batch: ${updated}/${toUpdate.length}`);
  }

  console.log(`\nDone. Updated ${updated} guests.`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
