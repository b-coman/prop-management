#!/usr/bin/env npx tsx
/**
 * set-ad-placements — take Reels off a live ad set, without touching anything else.
 *
 * WHY THIS EXISTS: the September flight ran on Advantage+ placements (no `publisher_platforms`
 * at all), and Meta spent it where clicks were cheapest. Measured 17-18 Aug: Facebook Reels
 * produced 121 of 220 link clicks on 33% of the spend, at 0.065 lei a click against Feed's
 * 0.169 — and converted none of them. An 8.3% click-through rate on a STATIC photo in a
 * vertical-video surface is thumb-taps, not interest. Reels is worth running deliberately with
 * video creative; it is not worth being the default sink for a 9 lei/day budget.
 *
 * `targeting` on Meta is REPLACE, not merge: writing `{publisher_platforms:[...]}` alone would
 * silently drop the geo and the age range. So this reads the live targeting object, adds only
 * the placement keys, writes the whole thing back, and READS IT BACK to prove what Meta holds
 * (docs/meta-ads-infrastructure-2026.md §9h — our record of what we sent is not evidence).
 *
 * Dry-run by default. Pass --apply to write. These are ad sets that are spending money.
 *
 * Usage:
 *   npx tsx scripts/set-ad-placements.ts                    # show what would change
 *   npx tsx scripts/set-ad-placements.ts --apply            # do it
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
process.env.META_ADS_TOKENS = execSync(
  'gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom',
  { encoding: 'utf8' }
).trim();
import { resolveAdContext } from '@/services/growth/metaAds/adContext';
import { metaGraph } from '@/services/growth/metaAds/client';

const PROPERTY = 'prahova-mountain-chalet';
const AD_SETS = ['120251858082340114', '120251858058290114'];
const APPLY = process.argv.includes('--apply');

/** Feed and Stories on both platforms. Everything else — Reels above all — is off. */
const PLACEMENTS = {
  publisher_platforms: ['facebook', 'instagram'],
  facebook_positions: ['feed', 'story'],
  instagram_positions: ['stream', 'story'],
};

(async () => {
  const ctx = await resolveAdContext(PROPERTY);
  if (!ctx) { console.error('no ad context for', PROPERTY); process.exit(1); }

  for (const id of AD_SETS) {
    const read = await metaGraph<{ name: string; effective_status: string; targeting: Record<string, unknown> }>(
      id, { params: { fields: 'name,effective_status,targeting' }, token: ctx.token, propertyId: PROPERTY }
    );
    if (!read.ok) { console.error(`  ${id}: read failed — ${read.error}`); continue; }

    const { name, effective_status, targeting } = read.data;
    console.log(`\n=== ${name}\n    ${id} · ${effective_status}`);
    console.log('    before:', JSON.stringify({
      publisher_platforms: targeting.publisher_platforms ?? '(Advantage+ — all placements)',
      facebook_positions: targeting.facebook_positions ?? '(all)',
      instagram_positions: targeting.instagram_positions ?? '(all)',
    }));

    const next = { ...targeting, ...PLACEMENTS };
    if (!APPLY) {
      console.log('    after :', JSON.stringify(PLACEMENTS), '  [dry run — nothing written]');
      continue;
    }

    const write = await metaGraph(id, { method: 'POST', params: { targeting: next }, token: ctx.token, propertyId: PROPERTY });
    if (!write.ok) { console.error(`    WRITE FAILED — ${write.error}`); continue; }

    const verify = await metaGraph<{ targeting: Record<string, unknown> }>(
      id, { params: { fields: 'targeting' }, token: ctx.token, propertyId: PROPERTY }
    );
    if (!verify.ok) { console.error(`    wrote, but read-back failed — ${verify.error}`); continue; }
    const t = verify.data.targeting;
    const held = {
      publisher_platforms: t.publisher_platforms,
      facebook_positions: t.facebook_positions,
      instagram_positions: t.instagram_positions,
    };
    const reelsGone = !JSON.stringify(held).includes('reels');
    const geoKept = JSON.stringify(t.geo_locations ?? {}) === JSON.stringify(targeting.geo_locations ?? {});
    console.log('    Meta now holds:', JSON.stringify(held));
    console.log(`    reels excluded: ${reelsGone ? 'YES' : 'NO — CHECK THIS'} · geo unchanged: ${geoKept ? 'yes' : 'NO — CHECK THIS'}`);
  }
  if (!APPLY) console.log('\nDry run. Re-run with --apply to write.\n');
})().catch((e) => { console.error(e); process.exit(1); });
