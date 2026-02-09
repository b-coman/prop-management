/**
 * Update alt text for all 30 property images in Firestore.
 * Usage: npx tsx scripts/fix-image-alt-text.ts [--dry-run]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(path.resolve(serviceAccountPath)),
});

const db = admin.firestore();
const dryRun = process.argv.includes('--dry-run');
const SLUG = 'prahova-mountain-chalet';

// Alt text indexed by sortOrder
const altTexts: string[] = [
  /* 0  */ 'Chalet exterior side view from the garden with stone walls and wooden facade',
  /* 1  */ 'Chalet front view surrounded by tall trees and lush greenery',
  /* 2  */ 'Chalet exterior with green garden and pathway leading to the entrance',
  /* 3  */ 'Sunlit garden with A-frame wooden structure among the trees',
  /* 4  */ 'A-frame wooden cabin structure in the garden surrounded by forest',
  /* 5  */ 'Traditional outdoor cooking cauldron hanging over a stone fire pit',
  /* 6  */ 'Green garden lawn with chalet visible in the background',
  /* 7  */ 'Hillside garden with hammock and views of the surrounding nature',
  /* 8  */ 'Wooden playground with swing set and slide for children',
  /* 9  */ 'Hammock hanging between trees in the shaded garden',
  /* 10 */ 'Wooden swing frame in the garden with forest backdrop',
  /* 11 */ 'Covered terrace pergola with outdoor dining area',
  /* 12 */ 'Main bedroom with double bed, warm lighting and wooden walls',
  /* 13 */ 'Main bedroom view showing cozy decor and natural wood finishes',
  /* 14 */ 'Living room with spiral staircase leading to the upper floor',
  /* 15 */ 'Modern kitchen with appliances and wooden countertops',
  /* 16 */ 'Bedroom with double bed and private balcony with mountain views',
  /* 17 */ 'Dining area with table and chairs near the terrace access',
  /* 18 */ 'Kids bedroom with colorful bunk bed, desk and wall decorations',
  /* 19 */ 'Close-up of the kids bunk bed with colorful bedding and toys',
  /* 20 */ 'Living room with fireplace, TV and comfortable seating area',
  /* 21 */ 'Guest bedroom with double bed and traditional Romanian rug',
  /* 22 */ 'Guest bedroom from a different angle showing wooden interior',
  /* 23 */ 'Interior staircase and hallway with warm wood paneling',
  /* 24 */ 'Forest path near the chalet surrounded by tall trees',
  /* 25 */ 'Outdoor terrace with wicker chairs for relaxing',
  /* 26 */ 'Bathroom with shower and modern fixtures',
  /* 27 */ 'Garden view through the trees with dappled sunlight',
  /* 28 */ 'Kids play area with toys, indoor swing and colorful decorations',
  /* 29 */ 'Bathroom interior with bathtub and tiled walls',
];

async function main() {
  const docRef = db.collection('properties').doc(SLUG);
  const snap = await docRef.get();
  if (!snap.exists) {
    console.error(`Document properties/${SLUG} not found`);
    process.exit(1);
  }

  const data = snap.data()!;
  const images = (data.images || []) as any[];

  console.log(`Found ${images.length} images, ${altTexts.length} alt texts prepared\n`);

  if (images.length !== altTexts.length) {
    console.error(`Mismatch: ${images.length} images vs ${altTexts.length} alt texts`);
    process.exit(1);
  }

  let changed = 0;
  for (let i = 0; i < images.length; i++) {
    const oldAlt = images[i].alt || '';
    const newAlt = altTexts[i];
    if (oldAlt !== newAlt) {
      images[i].alt = newAlt;
      changed++;
      console.log(`#${i}: "${oldAlt}" → "${newAlt}"`);
    } else {
      console.log(`#${i}: unchanged`);
    }
  }

  console.log(`\n${changed} images updated`);

  if (dryRun) {
    console.log('\n=== DRY RUN — no changes written ===');
  } else {
    await docRef.update({ images });
    console.log('\n=== Alt text updated successfully ===');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
