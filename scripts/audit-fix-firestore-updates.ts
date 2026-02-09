/**
 * One-off script to apply website audit fixes to Firestore.
 * Steps 7-9 from the audit fix plan:
 *   7. Repurpose "Book Now" → "House Rules" (menuItems + booking page)
 *   8. Sync footer quickLinks with nav
 *   9. Remove broken host avatar imageUrl
 *
 * Usage: npx tsx scripts/audit-fix-firestore-updates.ts [--dry-run]
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

async function main() {
  const docRef = db.collection('propertyOverrides').doc(SLUG);
  const snap = await docRef.get();
  if (!snap.exists) {
    console.error(`Document propertyOverrides/${SLUG} not found`);
    process.exit(1);
  }

  const data = snap.data()!;

  // ─── Step 7: Rename "Book Now" to "House Rules" ───
  console.log('\n--- Step 7: Repurpose "Book Now" → "House Rules" ---');

  // 7a. Update menuItems
  const menuItems = (data.menuItems || []) as any[];
  const bookingMenuItem = menuItems.find((m: any) => m.url === '/booking');
  if (bookingMenuItem) {
    bookingMenuItem.label = { en: 'House Rules', ro: 'Regulile Casei' };
    delete bookingMenuItem.isButton; // No longer needs button styling
    console.log('  menuItems: renamed "Book Now" → "House Rules"');
  } else {
    console.log('  menuItems: /booking item not found, skipping');
  }

  // 7b. Update booking page: remove booking-form from visibleBlocks, update header
  const booking = data.booking || {};
  booking.visibleBlocks = ['booking-header', 'booking-policies'];
  console.log('  booking.visibleBlocks: removed "booking-form"');

  if (booking['booking-header']) {
    booking['booking-header'].title = {
      en: 'House Rules & Policies',
      ro: 'Regulile Casei',
    };
    booking['booking-header'].subtitle = {
      en: 'Please review our house rules before your stay',
      ro: 'Vă rugăm să citiți regulile casei înainte de sejur',
    };
    console.log('  booking-header: updated title and subtitle');
  }

  // ─── Step 8: Sync footer quickLinks with nav ───
  console.log('\n--- Step 8: Sync footer quickLinks with nav ---');

  const footer = data.footer || {};
  footer.quickLinks = [
    { label: { en: 'Home', ro: 'Acasă' }, url: '/' },
    { label: { en: 'About the Chalet', ro: 'Despre Cabană' }, url: '/details' },
    { label: { en: 'Where We Are', ro: 'Unde Suntem' }, url: '/location' },
    { label: { en: 'Photo Gallery', ro: 'Galerie Foto' }, url: '/gallery' },
    { label: { en: 'House Rules', ro: 'Regulile Casei' }, url: '/booking' },
  ];
  console.log('  footer.quickLinks: set to match nav items');

  // Keep existing contactInfo
  console.log(`  footer.contactInfo: keeping existing (${footer.contactInfo?.email}, ${footer.contactInfo?.phone})`);

  // ─── Step 9: Remove broken host avatar imageUrl ───
  console.log('\n--- Step 9: Remove broken host avatar ---');

  const homepage = data.homepage || {};
  const host = homepage.host || {};
  if (host.imageUrl) {
    console.log(`  host.imageUrl was: "${host.imageUrl}"`);
    delete host.imageUrl;
    console.log('  host.imageUrl: removed (will show clean fallback icon)');
  } else {
    console.log('  host.imageUrl: already absent, nothing to do');
  }
  homepage.host = host;

  // ─── Bonus: Remove dummy amenities: ["aaaa"] from details ───
  console.log('\n--- Bonus: Clean up dummy amenities data ---');
  const details = data.details || {};
  const amenitiesBlock = details.amenities || {};
  if (amenitiesBlock.categories) {
    let cleaned = false;
    for (const cat of amenitiesBlock.categories) {
      if (cat.amenityRefs && Array.isArray(cat.amenityRefs)) {
        // If category has amenityRefs, remove old plain amenities array
        if (cat.amenities) {
          console.log(`  Removing dummy amenities from category "${cat.name?.en}": ${JSON.stringify(cat.amenities)}`);
          delete cat.amenities;
          cleaned = true;
        }
      }
    }
    if (!cleaned) console.log('  No dummy amenities data found');
    details.amenities = amenitiesBlock;
  }

  // ─── Apply updates ───
  const updateData = {
    menuItems,
    booking,
    footer,
    homepage,
    details,
  };

  if (dryRun) {
    console.log('\n=== DRY RUN — no changes written ===');
    console.log('Would update with:', JSON.stringify(updateData, null, 2));
  } else {
    await docRef.set(updateData, { merge: true });
    console.log('\n=== All updates applied successfully ===');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
