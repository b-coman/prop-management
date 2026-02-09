/**
 * Generate blurDataURL for all property images in Firestore.
 * Downloads each thumbnail, creates a tiny blurred base64 version using sharp.
 * Usage: npx tsx scripts/generate-blur-placeholders.ts [--dry-run]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';
import * as https from 'https';
import sharp from 'sharp';

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

function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function generateBlurDataURL(imageBuffer: Buffer): Promise<string> {
  const blurred = await sharp(imageBuffer)
    .resize(10, undefined, { fit: 'inside' }) // 10px wide, preserve aspect ratio
    .blur(2)
    .jpeg({ quality: 40 })
    .toBuffer();

  return `data:image/jpeg;base64,${blurred.toString('base64')}`;
}

async function main() {
  const docRef = db.collection('properties').doc(SLUG);
  const snap = await docRef.get();
  if (!snap.exists) {
    console.error(`Document properties/${SLUG} not found`);
    process.exit(1);
  }

  const data = snap.data()!;
  const images = (data.images || []) as any[];

  console.log(`Processing ${images.length} images...\n`);

  let generated = 0;
  let skipped = 0;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];

    // Skip if already has blur data
    if (img.blurDataURL) {
      console.log(`#${i}: already has blurDataURL, skipping`);
      skipped++;
      continue;
    }

    const url = img.thumbnailUrl || img.url;
    try {
      const buf = await downloadImage(url);
      const blurDataURL = await generateBlurDataURL(buf);
      images[i].blurDataURL = blurDataURL;
      generated++;
      console.log(`#${i}: generated blurDataURL (${blurDataURL.length} chars)`);
    } catch (e: any) {
      console.error(`#${i}: FAILED - ${e.message}`);
    }
  }

  console.log(`\n${generated} generated, ${skipped} skipped`);

  if (dryRun) {
    console.log('\n=== DRY RUN — no changes written ===');
    // Show a sample
    if (images[0]?.blurDataURL) {
      console.log('\nSample blurDataURL (image #0):');
      console.log(images[0].blurDataURL.substring(0, 80) + '...');
    }
  } else {
    await docRef.update({ images });
    console.log('\n=== Blur placeholders saved to Firestore ===');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
