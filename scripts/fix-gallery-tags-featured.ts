// One-time script: Fix featured flags (remove outdoor false positives),
// add room category tags to all images, update maxImages to 6
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set');
  process.exit(1);
}

const serviceAccount = require(path.resolve(process.cwd(), serviceAccountPath));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const PROPERTY_ID = 'prahova-mountain-chalet';

// Tags per image (indexed by sortOrder)
const IMAGE_TAGS: string[][] = [
  /* 0  */ ['exterior'],
  /* 1  */ ['exterior'],
  /* 2  */ ['exterior', 'garden'],
  /* 3  */ ['garden'],
  /* 4  */ ['garden'],
  /* 5  */ ['outdoor', 'bbq'],
  /* 6  */ ['garden'],
  /* 7  */ ['garden', 'hammock'],
  /* 8  */ ['outdoor', 'playground', 'kids'],
  /* 9  */ ['garden', 'hammock'],
  /* 10 */ ['garden', 'playground'],
  /* 11 */ ['terrace', 'outdoor'],
  /* 12 */ ['bedroom', 'interior'],
  /* 13 */ ['bedroom', 'interior'],
  /* 14 */ ['living-room', 'interior'],
  /* 15 */ ['kitchen', 'interior'],
  /* 16 */ ['bedroom', 'interior', 'balcony'],
  /* 17 */ ['dining', 'interior'],
  /* 18 */ ['bedroom', 'kids', 'interior'],
  /* 19 */ ['bedroom', 'kids', 'interior'],
  /* 20 */ ['living-room', 'interior', 'fireplace'],
  /* 21 */ ['bedroom', 'interior'],
  /* 22 */ ['bedroom', 'interior'],
  /* 23 */ ['interior', 'hallway'],
  /* 24 */ ['outdoor', 'forest'],
  /* 25 */ ['terrace', 'outdoor'],
  /* 26 */ ['bathroom', 'interior'],
  /* 27 */ ['garden', 'outdoor'],
  /* 28 */ ['kids', 'interior', 'playroom'],
  /* 29 */ ['bathroom', 'interior'],
];

// Only truly interior images should be featured
const FEATURED_INDICES = new Set([12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 26, 28, 29]);

async function main() {
  // --- Step 1: Update images with tags and fix featured flags ---
  const propRef = db.collection('properties').doc(PROPERTY_ID);
  const propDoc = await propRef.get();

  if (!propDoc.exists) {
    console.error(`Property ${PROPERTY_ID} not found`);
    process.exit(1);
  }

  const images = propDoc.data()!.images as any[];
  console.log(`Updating ${images.length} images with tags and fixing featured flags...\n`);

  let featuredCount = 0;
  const updatedImages = images.map((img: any, i: number) => {
    const updated = { ...img, tags: IMAGE_TAGS[i] || [] };
    if (FEATURED_INDICES.has(i)) {
      updated.isFeatured = true;
      featuredCount++;
    } else {
      delete updated.isFeatured;
    }
    return updated;
  });

  // Show changes
  updatedImages.forEach((img: any, i: number) => {
    console.log(
      String(i).padStart(2),
      img.isFeatured ? 'FEAT' : '    ',
      JSON.stringify(img.tags).padEnd(40),
      '|', img.alt
    );
  });

  await propRef.update({ images: updatedImages });
  console.log(`\nUpdated images: ${featuredCount} featured, all tagged.`);

  // --- Step 2: Update maxImages from 8 to 6 ---
  const overridesRef = db.collection('propertyOverrides').doc(PROPERTY_ID);
  await overridesRef.update({ 'homepage.gallery.maxImages': 6 });
  console.log('Updated homepage.gallery.maxImages to 6.');

  // Verify
  const verify = await overridesRef.get();
  console.log('Verified maxImages:', verify.data()?.homepage?.gallery?.maxImages);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });
