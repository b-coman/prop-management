#!/usr/bin/env npx tsx
/**
 * comp-verify-record — the ONE write path for a verification pass.
 *
 * Takes the JSON blobs the in-page verifier returned (two per listing, at two different occupancies),
 * reconciles each pair, and stores only what survived. Nothing else may write `verifiedAt`: that
 * field is the difference between "a human confirmed this against the live listing" and "someone
 * touched the row", and it is the whole basis of the set's aging.
 *
 * **A pair that fails to reconcile is REFUSED, not stored with a caveat.** The failure it catches —
 * capacity read from a field that echoes the search — produces a number that looks perfectly
 * reasonable and makes `hostsParty` report competition that does not exist. There is no safe way to
 * half-trust it.
 *
 *   npx tsx scripts/comp-verify-record.ts --rows rows.json --dry-run
 *   npx tsx scripts/comp-verify-record.ts --rows rows.json
 *
 * rows.json is an array of the objects returned by `inPageVerifyRunner`:
 *   [{ listingId, occupancy, identity, heroPhotoUrl, photoProvenance }, ...]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import * as fs from 'fs';
import { recordVerification, getCompetitorListing } from '@/services/competitorSetService';
import { reconcile, type Identity } from '@/lib/competitive/verify';
import type { CompetitorUnit, PhotoProvenance } from '@/lib/competitive/set';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const flag = (n: string) => process.argv.includes(`--${n}`);

const SLUG = arg('property', 'prahova-mountain-chalet')!;
const ROWS = arg('rows');
const DRY = flag('dry-run');
const BY = arg('by', 'comp-verify')!;

interface Row {
  listingId: string;
  occupancy: number;
  identity: Identity;
  heroPhotoUrl?: string | null;
  photoProvenance?: PhotoProvenance | null;
}

(async () => {
  if (!ROWS) { console.error('--rows <file.json> is required'); process.exit(1); }
  const rows = JSON.parse(fs.readFileSync(ROWS, 'utf8')) as Row[];
  if (!Array.isArray(rows) || !rows.length) { console.error('rows file is empty'); process.exit(1); }

  const byListing = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r?.listingId || typeof r.occupancy !== 'number' || !r.identity) {
      console.error(`malformed row: ${JSON.stringify(r).slice(0, 120)}`);
      process.exit(1);
    }
    byListing.set(r.listingId, [...(byListing.get(r.listingId) ?? []), r]);
  }

  console.log(`\nCOMP-VERIFY RECORD — ${SLUG}   (${DRY ? 'dry run, nothing written' : 'WRITING'})`);
  console.log(`${rows.length} reads across ${byListing.size} listing(s)\n`);

  let stored = 0;
  const refused: string[] = [];

  for (const [listingId, reads] of byListing) {
    const known = await getCompetitorListing(SLUG, listingId);
    if (!known) { refused.push(`${listingId}: not in the curated set — curate it before verifying`); continue; }

    if (reads.length < 2) {
      refused.push(`${listingId}: only ${reads.length} read. Two occupancies are required, or the ` +
                   `echo check cannot run and an unrun check must never pass as a verification.`);
      continue;
    }
    const [a, b] = reads.sort((x, y) => x.occupancy - y.occupancy);
    const r = reconcile({ a: { occupancy: a.occupancy, identity: a.identity },
                          b: { occupancy: b.occupancy, identity: b.identity } });
    if (!r.ok) {
      refused.push(`${listingId}: ${r.problem ?? 'did not reconcile'}` +
                   (r.moved.length ? ` (moved: ${r.moved.join(', ')})` : ''));
      continue;
    }

    const units: CompetitorUnit[] = r.stable.units.map((u) => ({
      label: u.label, maxPersons: u.maxPersons, count: u.count, sqm: u.sqm,
    }));
    // The photo is DOM-only, so it never goes through reconcile. Prefer a read that could prove the
    // photo belongs to this listing; otherwise take whichever exists and keep the weaker provenance.
    const photoRead = [a, b].find((x) => x.photoProvenance === 'id-matched')
      ?? [a, b].find((x) => x.heroPhotoUrl);

    const observed = {
      units,
      ...(r.stable.rating !== null ? { rating: r.stable.rating } : {}),
      ...(r.stable.reviewCount !== null ? { reviewCount: r.stable.reviewCount } : {}),
      ...(r.stable.city ? { city: r.stable.city } : {}),
      ...(photoRead?.heroPhotoUrl ? {
        heroPhotoUrl: photoRead.heroPhotoUrl,
        photoProvenance: (photoRead.photoProvenance ?? 'capture-context') as PhotoProvenance,
      } : {}),
    };

    const was = known.units.reduce((m, u) => Math.max(m, u.maxPersons), 0);
    const now = units.reduce((m, u) => Math.max(m, u.maxPersons), 0);
    const changed = was !== now ? `  CAPACITY ${was || '?'} -> ${now}` : '';
    console.log(`  ${listingId.padEnd(26)} ${units.length} unit(s), largest ${now}` +
                `${r.stable.rating !== null ? `, ${r.stable.rating}` : ''}` +
                `${photoRead?.heroPhotoUrl ? ', photo' : ', NO PHOTO'}${changed}`);
    if (r.problem) console.log(`      note: ${r.problem}`);

    if (!DRY) await recordVerification(SLUG, listingId, observed, BY);
    stored++;
  }

  console.log(`\n${DRY ? 'would store' : 'stored'}: ${stored}/${byListing.size}`);
  if (refused.length) {
    console.log(`\nREFUSED (${refused.length}) — these keep their previous record and stay unverified:`);
    refused.forEach((x) => console.log(`  - ${x}`));
    console.log(`\nA refusal is an outcome, not a failure. Re-probe rather than lowering the bar.`);
  }
  if (DRY) console.log('\nRe-run without --dry-run to apply.');
})().catch((e) => { console.error(e); process.exit(1); });
