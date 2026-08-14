/**
 * Generate the `_display` derivative for property images that predate it, and
 * write `displayUrl` / `displayStoragePath` back onto the Firestore record.
 *
 * Keep DISPLAY_MAX_WIDTH and DISPLAY_QUALITY in step with IMAGE_TIERS.display
 * in `src/lib/image-utils.ts`, which is what new uploads use. This script only
 * covers what is already in the bucket.
 *
 * Guest-facing pages render `displayUrl || url` (see `src/lib/image-src.ts`),
 * so an image this script cannot process keeps working, it just stays heavy.
 *
 * Idempotent: images that already have a `displayUrl` are skipped unless
 * --force. The original object is never modified, and a regenerated derivative
 * reuses the same object path, so nothing is orphaned.
 *
 * Usage:
 *   npx tsx scripts/backfill-display-images.ts                  # dry run, all properties
 *   npx tsx scripts/backfill-display-images.ts --apply
 *   npx tsx scripts/backfill-display-images.ts --apply --slug prahova-mountain-chalet
 *   npx tsx scripts/backfill-display-images.ts --apply --force  # after retuning the tier
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DISPLAY_MAX_WIDTH = 1000;
const DISPLAY_QUALITY = 72;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
  process.exit(1);
}

const bucketName =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'rentalspot-fzwom.firebasestorage.app';

admin.initializeApp({
  credential: admin.credential.cert(path.resolve(serviceAccountPath)),
  storageBucket: bucketName,
});

const db = admin.firestore();

/** Firebase download URL for an object, minting a token if it has none. */
async function downloadUrl(file: admin.storage.Storage extends never ? never : any): Promise<string> {
  const [meta] = await file.getMetadata();
  let token = meta?.metadata?.firebaseStorageDownloadTokens;
  if (!token) {
    token = randomUUID();
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  }
  const encoded = encodeURIComponent(file.name);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const slugIdx = args.indexOf('--slug');
  const onlySlug = slugIdx >= 0 ? args[slugIdx + 1] : null;
  // Regenerate derivatives that already exist, for when the tier is retuned.
  const force = args.includes('--force');

  const bucket = admin.storage().bucket();

  console.log(`Bucket : ${bucketName}`);
  console.log(`Scope  : ${onlySlug || 'ALL properties'}`);
  console.log(`Mode   : ${apply ? 'APPLY' : 'DRY RUN (no writes)'}${force ? ' + FORCE (regenerate existing)' : ''}`);
  console.log('');

  const snap = onlySlug
    ? await db.collection('properties').where(admin.firestore.FieldPath.documentId(), '==', onlySlug).get()
    : await db.collection('properties').get();

  let totalDone = 0;
  let totalSkipped = 0;
  let totalNoPath = 0;
  let totalFailed = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;

  for (const propDoc of snap.docs) {
    const slug = propDoc.id;
    const images: any[] = propDoc.data().images || [];
    if (images.length === 0) {
      console.log(`${slug}: no images`);
      continue;
    }

    console.log(`\n=== ${slug} (${images.length} images) ===`);
    const updated = [...images];
    let changed = false;

    for (let i = 0; i < updated.length; i++) {
      const img = updated[i];

      if (img.displayUrl && !force) {
        totalSkipped++;
        continue;
      }
      if (!img.storagePath) {
        totalNoPath++;
        console.log(`  SKIP (no storagePath, never uploaded via the pipeline): ${String(img.url).slice(0, 70)}`);
        continue;
      }

      const srcFile = bucket.file(img.storagePath);
      const [exists] = await srcFile.exists();
      if (!exists) {
        totalFailed++;
        console.log(`  FAIL (object missing): ${img.storagePath}`);
        continue;
      }

      const displayPath = img.storagePath.replace(/(\.[^.]+)$/, '_display.webp');

      if (!apply) {
        const [meta] = await srcFile.getMetadata();
        bytesBefore += Number(meta.size || 0);
        console.log(`  WOULD MAKE ${displayPath}  (from ${Math.round(Number(meta.size || 0) / 1024)} KB)`);
        continue;
      }

      try {
        const [buf] = await srcFile.download();
        bytesBefore += buf.length;

        const out = await sharp(buf)
          .rotate() // honour EXIF orientation
          .resize({ width: DISPLAY_MAX_WIDTH, withoutEnlargement: true })
          .webp({ quality: DISPLAY_QUALITY, effort: 6 })
          .toBuffer();
        bytesAfter += out.length;

        const token = randomUUID();
        const destFile = bucket.file(displayPath);
        await destFile.save(out, {
          contentType: 'image/webp',
          metadata: {
            cacheControl: CACHE_CONTROL,
            metadata: { firebaseStorageDownloadTokens: token },
          },
        });

        const url = await downloadUrl(destFile);
        updated[i] = { ...img, displayUrl: url, displayStoragePath: displayPath };
        changed = true;
        totalDone++;
        console.log(
          `  MADE ${displayPath}  ${Math.round(buf.length / 1024)} KB -> ${Math.round(out.length / 1024)} KB`
        );
      } catch (err) {
        totalFailed++;
        console.error(`  FAIL ${img.storagePath}: ${(err as Error).message}`);
      }
    }

    if (apply && changed) {
      await propDoc.ref.update({ images: updated });
      console.log(`  Firestore updated for ${slug}`);
    }
  }

  console.log('\n--- summary ---');
  console.log(`  derivatives created  : ${totalDone}`);
  console.log(`  already had one      : ${totalSkipped}`);
  console.log(`  no storagePath       : ${totalNoPath}`);
  console.log(`  failed               : ${totalFailed}`);
  if (apply && bytesAfter > 0) {
    console.log(`  source bytes         : ${Math.round(bytesBefore / 1024 / 1024)} MB`);
    console.log(`  display bytes        : ${Math.round(bytesAfter / 1024 / 1024)} MB`);
    console.log(`  reduction            : ${Math.round((1 - bytesAfter / bytesBefore) * 100)}%`);
  }
  if (!apply) console.log('\nRe-run with --apply to create these.');

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
