#!/usr/bin/env npx tsx
/**
 * set-gallery-visibility — show or hide specific property photos in the website
 * gallery, without touching anything else on the record.
 *
 * Gallery membership and library membership are different questions. The
 * library feeds the ad/post selector, which reasons over aiDescription and
 * benefits from having, say, a summer AND an autumn version of the same corner.
 * The gallery is a curated set a guest scrolls: two photos of the same corner
 * read as padding there. So a photo can and often should be in the library but
 * not the gallery. This flips only the gallery side.
 *
 * Identify images by any unique fragment of their storagePath (the uuid is
 * easiest). Archived images are refused, since showing one would contradict the
 * archive.
 *
 * Usage:
 *   npx tsx scripts/set-gallery-visibility.ts --show <uuid> [<uuid> ...]
 *   npx tsx scripts/set-gallery-visibility.ts --hide <uuid> --apply
 *   npx tsx scripts/set-gallery-visibility.ts --show <uuid> --apply --property slug
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const argv = process.argv.slice(2);
const flagIdx = (n: string) => argv.indexOf(`--${n}`);
const propIdx = flagIdx('property');
const slug = propIdx >= 0 ? argv[propIdx + 1] : 'prahova-mountain-chalet';
const apply = argv.includes('--apply');

const mode = argv.includes('--show') ? 'show' : argv.includes('--hide') ? 'hide' : null;
if (!mode) {
  console.error('one of --show / --hide is required');
  process.exit(1);
}
// everything after the mode flag that is not another flag or its value
const start = flagIdx(mode) + 1;
const ids: string[] = [];
for (let i = start; i < argv.length; i++) {
  if (argv[i].startsWith('--')) break;
  ids.push(argv[i]);
}
if (ids.length === 0) {
  console.error(`--${mode} needs at least one storagePath fragment (uuid)`);
  process.exit(1);
}

const sa = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!sa) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(path.resolve(sa)) });

(async () => {
  const ref = admin.firestore().collection('properties').doc(slug);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`property ${slug} not found`);
    process.exit(1);
  }
  const images: any[] = snap.data()?.images || [];
  const target = mode === 'show';

  console.log(`Property : ${slug}`);
  console.log(`Action   : ${mode} ${ids.length} image(s)`);
  console.log(`Mode     : ${apply ? 'APPLY' : 'DRY RUN'}\n`);

  let changed = 0;
  let missing: string[] = [];
  const next = images.map((img) => {
    const hit = ids.find((id) => (img.storagePath || '').includes(id));
    if (!hit) return img;
    if (img.archived) {
      console.log(`  REFUSED ${hit}: archived, un-archive it first`);
      return img;
    }
    if (img.showInGallery === target) {
      console.log(`  no change ${hit}: already ${target ? 'shown' : 'hidden'}`);
      return img;
    }
    console.log(`  ${target ? 'SHOW' : 'HIDE'} ${hit}  ${(img.aiDescription?.summary || '').slice(0, 62)}`);
    changed++;
    return { ...img, showInGallery: target };
  });
  missing = ids.filter((id) => !images.some((i) => (i.storagePath || '').includes(id)));
  missing.forEach((m) => console.log(`  NOT FOUND ${m}`));

  const visible = next.filter((i) => i.showInGallery !== false && !i.archived).length;
  console.log(`\n  gallery would hold ${visible} of ${next.length} images`);

  if (!apply) {
    console.log('\n  dry run; re-run with --apply');
    process.exit(0);
  }
  if (changed === 0) {
    console.log('  nothing to write');
    process.exit(0);
  }
  await ref.update({ images: next });
  console.log(`  written (${changed} changed)`);
  process.exit(missing.length ? 1 : 0);
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
