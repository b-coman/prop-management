#!/usr/bin/env npx tsx
/**
 * caption-gallery — backfill each gallery photo with a rich vision `aiDescription` (season, mood,
 * features, people, fitting angles) so the ad/page selectors reason over what's ACTUALLY in each
 * photo. A vision model looks at every image. Re-runnable (skips already-described unless --force);
 * writes back after each image so it's resumable. Read-only on Meta; writes only property.images.
 *
 * Usage:
 *   npx tsx scripts/caption-gallery.ts [--property slug] [--limit N] [--force] [--dry]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
process.env.ANTHROPIC_API_KEY = execSync('gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY --project=rentalspot-fzwom', { encoding: 'utf8' }).trim();

import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { describeImage, mediaTypeFromUrl } from '@/services/growth/galleryVision';
import type { PropertyImage } from '@/types';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const property = arg('property', 'prahova-mountain-chalet')!;
const limit = arg('limit') ? Number(arg('limit')) : Infinity;
const force = process.argv.includes('--force');
const dry = process.argv.includes('--dry');

(async () => {
  const db = await getAdminDb();
  const ref = db.collection('properties').doc(property);
  const snap = await ref.get();
  if (!snap.exists) { console.error(`property ${property} not found`); process.exit(1); }
  const images = (snap.data()?.images ?? []) as PropertyImage[];

  const todo = images
    .map((img, idx) => ({ img, idx }))
    .filter(({ img }) => img.storagePath && (force || !img.aiDescription))
    .slice(0, limit);

  console.log(`${property}: ${images.length} images · ${todo.length} to describe${dry ? ' (DRY RUN — no writes)' : ''}\n`);

  let done = 0;
  for (const { img, idx } of todo) {
    const url = img.url;
    try {
      const res = await fetch(url);
      if (!res.ok) { console.log(`  ✖ ${idx} fetch ${res.status}`); continue; }
      const bytes = Buffer.from(await res.arrayBuffer());
      const mediaType = mediaTypeFromUrl(url);
      const desc = await describeImage(bytes.toString('base64'), mediaType);
      if (!desc) { console.log(`  ✖ ${idx} no description returned`); continue; }
      done += 1;
      const fname = (img.storagePath ?? '').split('/').pop();
      console.log(`  ✓ ${idx} ${fname}\n      ${desc.summary}\n      season=${desc.season} · mood=${desc.mood} · people=${desc.people} · fits=[${desc.fitsAngles.join(', ')}]`);
      if (!dry) {
        images[idx] = { ...img, aiDescription: desc };
        await ref.update({ images }); // write-after-each → resumable
      }
    } catch (e) {
      console.log(`  ✖ ${idx} ${String(e).slice(0, 120)}`);
    }
  }
  console.log(`\ndone: ${done}/${todo.length} described${dry ? ' (dry)' : ' and saved'}.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
