#!/usr/bin/env npx tsx
/**
 * backfill-meta-safe-originals — give every gallery image a JPEG full-size original.
 *
 * WHY
 * ---
 * `resizeImage` in src/lib/image-utils.ts prefers WebP for every tier, so photos uploaded through
 * the admin UI land as .webp. That is right for the website and fatal for advertising: Meta's
 * /adimages endpoint refuses WebP outright — FileTypeNotSupported, subcode 1487411, verified against
 * the live ad account on 2026-08-17. It surfaced as "upload-failed:image-too-narrow", because the
 * width probe could not parse a WebP header either and an unreadable width is treated as too small.
 *
 * The site never renders the full tier: `displaySrc()` serves `displayUrl` (the 1000px WebP) and
 * falls back to `url` only when there is no derivative. So the full tier can be JPEG at no cost to
 * page weight, and every image becomes advertisable.
 *
 * WHAT IT DOES
 * ------------
 * For each image whose `storagePath` is not JPEG/PNG: re-encodes the full-size original to JPEG,
 * uploads it beside the original, and repoints `storagePath` + `url` at it. `displayStoragePath` /
 * `displayUrl` / `thumbnailUrl` are untouched — the web keeps its WebP. The old .webp original is
 * LEFT IN PLACE, never deleted: it costs pennies and it is the only way back if a conversion is bad.
 *
 * Downstream references to the old path (landingPages.gallery, adCampaigns proposal.photos /
 * composeInput.assetRefs) are reported, not rewritten — they are re-derived by their own scripts.
 *
 * Usage:
 *   npx tsx scripts/backfill-meta-safe-originals.ts [--property slug]
 *   npx tsx scripts/backfill-meta-safe-originals.ts --apply
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import sharp from 'sharp';
import { getAdminDb, getAdminStorage } from '@/lib/firebaseAdminSafe';

const P = process.argv.find((a) => a.startsWith('--property='))?.split('=')[1] ?? 'prahova-mountain-chalet';
const APPLY = process.argv.includes('--apply');
const META_OK = ['jpg', 'jpeg', 'png'];
/** Matches IMAGE_TIERS.full in src/lib/image-utils.ts, so a converted original is the same size as a fresh upload. */
const FULL_MAX_WIDTH = 2048;
const FULL_QUALITY = 85;

const extOf = (p: string) => p.toLowerCase().split('.').pop() ?? '';

(async () => {
  const db = await getAdminDb();
  const storage = await getAdminStorage();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const bucket = storage.bucket(bucketName);

  const ref = db.collection('properties').doc(P);
  const prop = (await ref.get()).data() as any;
  const images: any[] = prop.images ?? [];
  const targets = images.filter((i) => i.storagePath && !META_OK.includes(extOf(i.storagePath)));

  console.log(`\n=== ${P} ===`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`${images.length} images · ${targets.length} not advertisable\n`);
  if (!targets.length) { console.log('nothing to do'); process.exit(0); }

  const next = [...images];
  let done = 0;

  for (const img of targets) {
    const oldPath: string = img.storagePath;
    const newPath = oldPath.replace(/\.[^.]+$/, '.jpg');
    try {
      const [buf] = await bucket.file(oldPath).download();
      const out = await sharp(buf).rotate().resize({ width: FULL_MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: FULL_QUALITY, mozjpeg: true }).toBuffer();
      const meta = await sharp(out).metadata();
      if (!meta.width || meta.width < 600) { console.log(`  SKIP ${oldPath.split('/').pop()} — converts to ${meta.width}px, under Meta's 600 floor`); continue; }

      console.log(`  ${APPLY ? 'convert' : 'would convert'} ${oldPath.split('/').pop()} -> ${newPath.split('/').pop()}  ${meta.width}px  ${(out.length / 1024).toFixed(0)}KB`);
      if (!APPLY) { done++; continue; }

      // Same download-token scheme the uploader uses, so the URL shape matches every other image.
      const token = crypto.randomUUID();
      await bucket.file(newPath).save(out, {
        contentType: 'image/jpeg',
        metadata: { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000,immutable', metadata: { firebaseStorageDownloadTokens: token } },
      });
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(newPath)}?alt=media&token=${token}`;

      const idx = next.findIndex((x) => x.storagePath === oldPath);
      // Only the full tier moves. displayUrl/thumbnailUrl stay WebP — that is what the site renders.
      next[idx] = { ...next[idx], storagePath: newPath, url, originalWebpPath: oldPath };
      done++;
    } catch (e) {
      console.error(`  FAILED ${oldPath}: ${(e as Error).message}`);
    }
  }

  if (!APPLY) { console.log(`\n${done} would be converted; re-run with --apply`); process.exit(0); }

  await ref.update({ images: next });
  console.log(`\n${done} converted; property updated.`);

  // Report stale references rather than rewriting them — each has its own script that re-derives it.
  const oldPaths = new Set(targets.map((t) => t.storagePath));
  const lps = await db.collection('landingPages').where('propertyId', '==', P).get();
  for (const d of lps.docs) {
    const x = d.data() as any;
    const hits = [x.hero?.imagePath, ...(x.gallery ?? [])].filter((g: string) => oldPaths.has(g));
    if (hits.length) console.log(`  landingPages/${d.id} still references ${hits.length} old path(s) — re-run its seed script`);
  }
  const ads = await db.collection('adCampaigns').where('propertyId', '==', P).get();
  for (const d of ads.docs) {
    const x = d.data() as any;
    const hits = (x.proposal?.photos ?? []).map((p: any) => p.storagePath).filter((g: string) => oldPaths.has(g));
    if (hits.length) console.log(`  adCampaigns/${d.id} (${x.status}) still references ${hits.length} old path(s) — repoint before pushing`);
  }
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
