/**
 * Fix CTA buttons across all pages:
 * - Gallery, details, location pages have no CTA override → template default "Book Now" shows
 * - Homepage CTA has buttonUrl="/booking" which is now House Rules
 * - Fix: add CTA overrides to all pages with "Check Availability" → "/" (homepage with booking form)
 *
 * Usage: npx tsx scripts/fix-cta-buttons.ts [--dry-run]
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
const dryRun = process.argv.includes('--dry-run');
const SLUG = 'prahova-mountain-chalet';

const ctaOverride = {
  title: { en: 'Ready for Your Mountain Getaway?', ro: 'Pregătit pentru Evadarea la Munte?' },
  description: {
    en: 'Check available dates and book your stay in the Carpathian Mountains.',
    ro: 'Verifică datele disponibile și rezervă sejurul în Munții Carpați.',
  },
  buttonText: { en: 'Check Availability', ro: 'Verifică Disponibilitatea' },
  buttonUrl: '/',
  backgroundImage: '/images/properties/prahova-mountain-chalet/sfinx.jpg',
};

async function main() {
  const docRef = db.collection('propertyOverrides').doc(SLUG);
  const snap = await docRef.get();
  if (!snap.exists) {
    console.error(`Document propertyOverrides/${SLUG} not found`);
    process.exit(1);
  }

  const data = snap.data()!;
  const pagesToFix = ['homepage', 'gallery', 'details', 'location'];

  const updateData: Record<string, unknown> = {};

  for (const page of pagesToFix) {
    const pageData = data[page] || {};
    const currentCta = pageData.cta;

    if (currentCta) {
      console.log(`${page}: current CTA buttonText = "${JSON.stringify(currentCta.buttonText)}", buttonUrl = "${currentCta.buttonUrl}"`);
    } else {
      console.log(`${page}: no CTA override (using template default "Book Now")`);
    }

    // Set CTA override for this page
    updateData[`${page}.cta`] = ctaOverride;
    console.log(`  → Will set CTA to "Check Availability" → "/"`);
  }

  if (dryRun) {
    console.log('\n=== DRY RUN — no changes written ===');
    console.log('Would update:', JSON.stringify(updateData, null, 2));
  } else {
    await docRef.update(updateData);
    console.log('\n=== All CTA buttons updated successfully ===');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
