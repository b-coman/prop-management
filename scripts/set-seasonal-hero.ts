#!/usr/bin/env npx tsx
/**
 * set-seasonal-hero — point a season at a hero image for one property.
 *
 * The hero renders `seasonalBackgrounds[currentSeason()] || backgroundImage`
 * (see src/lib/season.ts), so a season left unset simply falls through to the
 * year-round image and a property that sets none behaves as it always did.
 *
 * Writes with a field path so it touches ONLY that one key. propertyOverrides
 * documents are edited from the admin UI too, and a whole-document write here
 * would silently discard whatever was changed there since this ran.
 *
 * Usage:
 *   npx tsx scripts/set-seasonal-hero.ts --season autumn --image /images/.../x.jpg
 *   npx tsx scripts/set-seasonal-hero.ts --season autumn --image ... --apply
 *   npx tsx scripts/set-seasonal-hero.ts --season autumn --clear --apply
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SEASONS = ['winter', 'spring', 'summer', 'autumn'];

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const slug = arg('property', 'prahova-mountain-chalet')!;
const season = arg('season');
const image = arg('image');
const clear = process.argv.includes('--clear');
const apply = process.argv.includes('--apply');

if (!season || !SEASONS.includes(season)) {
  console.error(`--season must be one of: ${SEASONS.join(', ')}`);
  process.exit(1);
}
if (!clear && !image) {
  console.error('--image <path-or-url> is required (or --clear to remove)');
  process.exit(1);
}

const sa = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!sa) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(path.resolve(sa)) });

(async () => {
  const db = admin.firestore();
  const ref = db.collection('propertyOverrides').doc(slug);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`propertyOverrides/${slug} not found`);
    process.exit(1);
  }
  const hero = (snap.data() as any)?.homepage?.hero || {};

  console.log(`Property : ${slug}`);
  console.log(`Season   : ${season}`);
  console.log(`Mode     : ${apply ? 'APPLY' : 'DRY RUN'}\n`);
  console.log(`  year-round backgroundImage : ${hero.backgroundImage}`);
  console.log(`  seasonalBackgrounds before : ${JSON.stringify(hero.seasonalBackgrounds ?? null)}`);

  const next = { ...(hero.seasonalBackgrounds || {}) };
  if (clear) delete next[season];
  else next[season] = image;
  console.log(`  seasonalBackgrounds after  : ${JSON.stringify(next)}`);

  if (!apply) {
    console.log('\n  dry run; re-run with --apply');
    process.exit(0);
  }

  await ref.update({ 'homepage.hero.seasonalBackgrounds': next });
  const after = ((await ref.get()).data() as any)?.homepage?.hero;
  console.log(`\n  written. verified: ${JSON.stringify(after.seasonalBackgrounds)}`);
  console.log(`  year-round image untouched: ${after.backgroundImage}`);
  process.exit(0);
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
