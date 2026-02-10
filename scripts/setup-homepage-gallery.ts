// One-time script: Tag interior images as featured + configure homepage gallery block
// Closes #84
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
  process.exit(1);
}

const serviceAccount = require(path.resolve(process.cwd(), serviceAccountPath));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const PROPERTY_ID = 'prahova-mountain-chalet';

// Interior keywords to match against alt text
const INTERIOR_KEYWORDS = [
  'bedroom', 'kitchen', 'living room', 'bathroom', 'dining',
  'interior', 'staircase', 'hallway', 'fireplace', 'bunk bed',
  'play area', 'indoor',
];

async function main() {
  // --- Step 1: Tag interior images as isFeatured on property doc ---
  const propRef = db.collection('properties').doc(PROPERTY_ID);
  const propDoc = await propRef.get();

  if (!propDoc.exists) {
    console.error(`Property ${PROPERTY_ID} not found`);
    process.exit(1);
  }

  const images = propDoc.data()!.images as Array<{
    alt?: string;
    isFeatured?: boolean;
    sortOrder?: number;
    [key: string]: unknown;
  }>;

  console.log(`Found ${images.length} images on property`);

  let featuredCount = 0;
  const updatedImages = images.map((img) => {
    const alt = (img.alt || '').toLowerCase();
    const isInterior = INTERIOR_KEYWORDS.some((kw) => alt.includes(kw));
    if (isInterior) {
      featuredCount++;
      return { ...img, isFeatured: true };
    }
    // Clear isFeatured if it was set on non-interior images
    const { isFeatured, ...rest } = img;
    return rest;
  });

  console.log(`Tagged ${featuredCount} interior images as featured:`);
  updatedImages.forEach((img, i) => {
    if (img.isFeatured) {
      console.log(`  [${i}] ${img.alt}`);
    }
  });

  await propRef.update({ images: updatedImages });
  console.log('Updated property images.\n');

  // --- Step 2: Add gallery config to homepage overrides ---
  const overridesRef = db.collection('propertyOverrides').doc(PROPERTY_ID);

  const galleryConfig = {
    title: { en: 'Inside the Chalet', ro: 'In interiorul Cabanei' },
    maxImages: 8,
    viewAllUrl: '/gallery',
    viewAllText: { en: 'View All Photos', ro: 'Vezi Toate Fotografiile' },
  };

  // Add gallery to visibleBlocks if not present, and set gallery config
  const overridesDoc = await overridesRef.get();
  const visibleBlocks = overridesDoc.data()?.homepage?.visibleBlocks;
  const updates: Record<string, unknown> = {
    'homepage.gallery': galleryConfig,
  };
  if (visibleBlocks && !visibleBlocks.includes('gallery')) {
    const ctaIndex = visibleBlocks.indexOf('cta');
    if (ctaIndex >= 0) {
      visibleBlocks.splice(ctaIndex, 0, 'gallery');
    } else {
      visibleBlocks.push('gallery');
    }
    updates['homepage.visibleBlocks'] = visibleBlocks;
  }

  await overridesRef.update(updates);

  // Verify
  const updated = await overridesRef.get();
  const homeGallery = updated.data()?.homepage?.gallery;
  console.log('Homepage gallery config set:', JSON.stringify(homeGallery, null, 2));
  console.log('visibleBlocks:', updated.data()?.homepage?.visibleBlocks);
  console.log('\nDone! The homepage gallery block will now show featured interior images.');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
