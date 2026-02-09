// One-time script: Remove hardcoded gallery images from propertyOverrides
// so the renderer falls back to property.images (30 real Firebase Storage photos)
// Closes #83
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

async function main() {
  const docRef = db.collection('propertyOverrides').doc('prahova-mountain-chalet');
  const doc = await docRef.get();

  if (!doc.exists) {
    console.error('Document not found: propertyOverrides/prahova-mountain-chalet');
    process.exit(1);
  }

  const data = doc.data()!;
  const currentImages = data.gallery?.['full-gallery']?.images;

  if (!currentImages) {
    console.log('No images field found in gallery.full-gallery — nothing to do.');
    process.exit(0);
  }

  console.log(`Current gallery.full-gallery has ${currentImages.length} override images.`);
  console.log('Removing images field so renderer falls back to property.images...');

  await docRef.update({
    'gallery.full-gallery.images': admin.firestore.FieldValue.delete(),
  });

  // Verify
  const updated = await docRef.get();
  const updatedImages = updated.data()?.gallery?.['full-gallery']?.images;

  if (updatedImages === undefined) {
    console.log('Success: gallery.full-gallery.images removed.');
    console.log('Remaining full-gallery keys:', Object.keys(updated.data()?.gallery?.['full-gallery'] || {}));
  } else {
    console.error('Error: images field still present after update.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
