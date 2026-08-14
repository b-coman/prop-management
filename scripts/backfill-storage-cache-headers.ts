/**
 * Backfill Cache-Control on existing property images in Firebase Storage.
 *
 * Storage returns `private, max-age=0` when no cacheControl metadata is set.
 * `private` also blocks CDN caching, so every property photo was re-downloaded
 * on every single pageview. New uploads get the right header from
 * `src/lib/storage-upload.ts`; this fixes everything already in the bucket.
 *
 * Safe to re-run: objects already carrying the target value are skipped.
 * Metadata-only — object bytes, names and download tokens are untouched, so
 * existing URLs keep working.
 *
 * Usage:
 *   npx tsx scripts/backfill-storage-cache-headers.ts            # dry run
 *   npx tsx scripts/backfill-storage-cache-headers.ts --apply    # write
 *   npx tsx scripts/backfill-storage-cache-headers.ts --apply --prefix properties/coltei-apartment-bucharest/
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

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

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const prefixIdx = args.indexOf('--prefix');
  const prefix = prefixIdx >= 0 ? args[prefixIdx + 1] : 'properties/';

  const bucket = admin.storage().bucket();

  console.log(`Bucket : ${bucketName}`);
  console.log(`Prefix : ${prefix}`);
  console.log(`Mode   : ${apply ? 'APPLY (writing metadata)' : 'DRY RUN (no writes)'}`);
  console.log('');

  const [files] = await bucket.getFiles({ prefix });
  if (files.length === 0) {
    console.log('No objects found under that prefix.');
    process.exit(0);
  }

  let alreadyOk = 0;
  let toFix = 0;
  let fixed = 0;
  let failed = 0;
  let bytesAffected = 0;
  const perProperty: Record<string, { count: number; bytes: number }> = {};

  for (const file of files) {
    const current = file.metadata.cacheControl;
    const size = Number(file.metadata.size || 0);

    if (current === CACHE_CONTROL) {
      alreadyOk++;
      continue;
    }

    toFix++;
    bytesAffected += size;

    // properties/{slug}/images/... -> slug
    const slug = file.name.split('/')[1] || '(unknown)';
    perProperty[slug] = perProperty[slug] || { count: 0, bytes: 0 };
    perProperty[slug].count++;
    perProperty[slug].bytes += size;

    if (!apply) {
      console.log(
        `  WOULD SET  ${file.name}  (${Math.round(size / 1024)} KB, was: ${current || 'unset'})`
      );
      continue;
    }

    try {
      await file.setMetadata({ cacheControl: CACHE_CONTROL });
      fixed++;
      console.log(`  SET  ${file.name}  (${Math.round(size / 1024)} KB)`);
    } catch (err) {
      failed++;
      console.error(`  FAIL ${file.name}: ${(err as Error).message}`);
    }
  }

  console.log('');
  console.log('--- per property ---');
  for (const [slug, s] of Object.entries(perProperty).sort()) {
    console.log(`  ${slug.padEnd(34)} ${String(s.count).padStart(4)} objects  ${Math.round(s.bytes / 1024)} KB`);
  }

  console.log('');
  console.log('--- summary ---');
  console.log(`  objects scanned      : ${files.length}`);
  console.log(`  already correct      : ${alreadyOk}`);
  console.log(`  needing the header   : ${toFix}`);
  if (apply) {
    console.log(`  updated              : ${fixed}`);
    console.log(`  failed               : ${failed}`);
  }
  console.log(`  bytes now cacheable  : ${Math.round(bytesAffected / 1024 / 1024)} MB`);
  if (!apply && toFix > 0) {
    console.log('');
    console.log('Re-run with --apply to write these.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
