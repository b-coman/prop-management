#!/usr/bin/env npx tsx
/**
 * ingest-property-photos — add local photo files to a property's image library,
 * producing exactly what the admin upload path produces.
 *
 * The admin uploader (`processImageForUpload` + `uploadPropertyImage`) runs in
 * the browser on canvas, so there was no way to add a photo from disk without
 * hand-rolling the record and getting a tier or a header wrong. This mirrors
 * that pipeline with sharp:
 *
 *   full   2048px   the original, only a lightbox ships this
 *   display 1000px  what every guest-facing card and grid renders
 *   thumb   400px   admin pickers
 *   + a 20px blurDataURL inlined on the record
 *   + `public, max-age=31536000, immutable` on every object
 *
 * Tier widths are read from src/lib/image-utils.ts so they cannot drift.
 *
 * It deliberately does NOT write aiDescription. That belongs to the vision
 * layer: run `npx tsx scripts/caption-gallery.ts` afterwards and every new photo
 * gets described by the same model and prompt as the rest of the catalog. The
 * caption-gallery cron would pick them up on its own too.
 *
 * Input is a JSON manifest so the alt text and tags are reviewable before
 * anything is written:
 *
 *   [{ "file": "/abs/path.jpg",
 *      "alt": { "en": "...", "ro": "..." },
 *      "tags": ["exterior", "autumn"],
 *      "showInGallery": true,
 *      "isFeatured": false }]
 *
 * A manifest entry may carry `replaces: "<storagePath or uuid>"`. The named
 * image is removed from the record and its Storage objects deleted once the new
 * one is safely in. That matters because the ad photo pool is every image with
 * a storagePath (admin/ads/actions.ts) with no showInGallery filter, so leaving
 * a superseded version behind means the selector can still pick it. An edited
 * photo that fixed exactly what made the original weak should retire it.
 *
 * Usage:
 *   npx tsx scripts/ingest-property-photos.ts --manifest photos.json [--property slug]
 *   npx tsx scripts/ingest-property-photos.ts --manifest photos.json --apply
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as admin from 'firebase-admin';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { IMAGE_TIERS } from '../src/lib/image-utils';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BLUR_WIDTH = 20;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const slug = arg('property', 'prahova-mountain-chalet')!;
const manifestPath = arg('manifest');
const apply = process.argv.includes('--apply');

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
  process.exit(1);
}
if (!manifestPath) {
  console.error('--manifest <file.json> is required');
  process.exit(1);
}

const bucketName =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'rentalspot-fzwom.firebasestorage.app';

admin.initializeApp({
  credential: admin.credential.cert(path.resolve(serviceAccountPath)),
  storageBucket: bucketName,
});

interface ManifestEntry {
  file: string;
  alt: { en: string; ro: string };
  tags?: string[];
  showInGallery?: boolean;
  isFeatured?: boolean;
  /** storagePath (or just the uuid) of an image this one supersedes. */
  replaces?: string;
}

async function uploadTier(
  bucket: ReturnType<ReturnType<typeof admin.storage>['bucket']>,
  buf: Buffer,
  storagePath: string
): Promise<string> {
  const token = randomUUID();
  await bucket.file(storagePath).save(buf, {
    contentType: 'image/webp',
    metadata: { cacheControl: CACHE_CONTROL, metadata: { firebaseStorageDownloadTokens: token } },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

async function main() {
  const entries: ManifestEntry[] = JSON.parse(await fs.readFile(manifestPath!, 'utf8'));
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const ref = db.collection('properties').doc(slug);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`property ${slug} not found`);
    process.exit(1);
  }
  const existing: any[] = snap.data()?.images || [];
  const existingTags = new Set(existing.flatMap((i) => i.tags || []));

  console.log(`Property : ${slug}`);
  console.log(`Existing : ${existing.length} images`);
  console.log(`Adding   : ${entries.length}`);
  console.log(`Mode     : ${apply ? 'APPLY' : 'DRY RUN (no writes)'}\n`);

  // Tags drive the gallery filter pills. A typo mints a new pill with one photo
  // behind it, so surface anything that isn't already in the property's vocabulary.
  for (const e of entries) {
    const novel = (e.tags || []).filter((t) => !existingTags.has(t));
    if (novel.length) console.log(`  NOTE new tag(s) ${novel.join(', ')} on ${path.basename(e.file)}`);
  }

  const added: any[] = [];
  let maxSort = existing.reduce((m, i) => Math.max(m, i.sortOrder ?? 0), 0);

  for (const e of entries) {
    const src = await fs.readFile(e.file);
    const base = sharp(src).rotate(); // honour EXIF before any resize
    const meta = await base.clone().metadata();

    const id = randomUUID();
    const p = (suffix: string) => `properties/${slug}/images/${id}${suffix}.webp`;

    const [fullBuf, displayBuf, thumbBuf, blurBuf] = await Promise.all([
      base.clone().resize({ width: IMAGE_TIERS.full.maxWidth, withoutEnlargement: true })
        .webp({ quality: Math.round(IMAGE_TIERS.full.quality * 100), effort: 6 }).toBuffer(),
      base.clone().resize({ width: IMAGE_TIERS.display.maxWidth, withoutEnlargement: true })
        .webp({ quality: Math.round(IMAGE_TIERS.display.quality * 100), effort: 6 }).toBuffer(),
      base.clone().resize({ width: IMAGE_TIERS.thumbnail.maxWidth, withoutEnlargement: true })
        .webp({ quality: Math.round(IMAGE_TIERS.thumbnail.quality * 100), effort: 6 }).toBuffer(),
      base.clone().resize({ width: BLUR_WIDTH }).webp({ quality: 40 }).toBuffer(),
    ]);

    console.log(
      `  ${path.basename(e.file).slice(0, 46).padEnd(46)} ${meta.width}x${meta.height} -> ` +
        `full ${Math.round(fullBuf.length / 1024)}KB / display ${Math.round(displayBuf.length / 1024)}KB / thumb ${Math.round(thumbBuf.length / 1024)}KB`
    );

    if (!apply) continue;

    const [url, displayUrl, thumbnailUrl] = await Promise.all([
      uploadTier(bucket, fullBuf, p('')),
      uploadTier(bucket, displayBuf, p('_display')),
      uploadTier(bucket, thumbBuf, p('_thumb')),
    ]);

    added.push({
      url,
      displayUrl,
      thumbnailUrl,
      storagePath: p(''),
      displayStoragePath: p('_display'),
      thumbnailStoragePath: p('_thumb'),
      blurDataURL: `data:image/webp;base64,${blurBuf.toString('base64')}`,
      alt: e.alt,
      tags: e.tags || [],
      showInGallery: e.showInGallery ?? true,
      isFeatured: e.isFeatured ?? false,
      sortOrder: ++maxSort,
    });
  }

  // Retire superseded images only after every new one uploaded cleanly, so a
  // failure halfway through can never leave the property with neither version.
  const retiring = entries.map((e) => e.replaces).filter(Boolean) as string[];
  const isRetired = (img: any) =>
    retiring.some((r) => img.storagePath === r || (img.storagePath || '').includes(r));
  const kept = existing.filter((img) => !isRetired(img));
  const removed = existing.filter(isRetired);

  for (const img of removed) {
    console.log(`  RETIRING ${img.storagePath}`);
    if (!apply) continue;
    for (const path of [img.storagePath, img.displayStoragePath, img.thumbnailStoragePath]) {
      if (!path) continue;
      await bucket.file(path).delete().catch(() => {
        /* already gone */
      });
    }
  }

  if (apply && added.length) {
    await ref.update({ images: [...kept, ...added] });
    console.log(`\n  Firestore updated: ${existing.length} -> ${kept.length + added.length} images` +
      (removed.length ? ` (${removed.length} retired)` : ''));
    console.log('  Next: npx tsx scripts/caption-gallery.ts --property ' + slug);
  } else if (!apply) {
    console.log('\nRe-run with --apply to upload and write.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
