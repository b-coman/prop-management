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
import { AD_PLACEMENTS } from '@/services/growth/metaAds/campaignBuilder';

const PROPERTY = 'prahova-mountain-chalet';
const AD_SETS = [
  '120252160782510114',  // Bucharest cold — Toamnă lungă
  '120252194669560114',  // Constanța cold — Toamnă lungă retry
  '120252388020700114',  // Ceaun retarget — RETARGETING, see the extra assert below
];
const APPLY = process.argv.includes('--apply');

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

/** `--only=<id,id>` narrows the run to specific ad sets. Default is all of AD_SETS. */
const only = arg('only')?.split(',').map((s) => s.trim()).filter(Boolean);
const TARGETS = only?.length ? AD_SETS.filter((id) => only.includes(id)) : AD_SETS;

/**
 * Placements to allow. The list itself lives in AD_PLACEMENTS next to the composer, so that
 * patching live ad sets here and composing new ones there cannot drift apart - that drift is the
 * bug this script existed to clean up in the first place.
 *
 * `--fb=feed,story --ig=stream,story` overrides it for a one-off run without touching the default.
 */
const PLACEMENTS = {
  publisher_platforms: AD_PLACEMENTS.publisher_platforms,
  facebook_positions: arg('fb')?.split(',') ?? AD_PLACEMENTS.facebook_positions,
  instagram_positions: arg('ig')?.split(',') ?? AD_PLACEMENTS.instagram_positions,
};

(async () => {
  const ctx = await resolveAdContext(PROPERTY);
  if (!ctx) { console.error('no ad context for', PROPERTY); process.exit(1); }

  for (const id of TARGETS) {
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

    // `targeting` is REPLACE, so the whole object goes back. Strip `location_types` on the way
    // out: Meta retired it, and an ad set that carries it EXPLICITLY cannot be edited in Ads
    // Manager at all - "your audience contains a location targeting option that has been removed"
    // (docs/meta-ads-infrastructure-2026.md §9h). Reading targeting back hands us Meta's own
    // default for it, so writing it unchanged is how a hand-editable ad set quietly became a
    // locked one. Meta re-applies its default anyway, so this does not change who is targeted.
    const next: Record<string, unknown> = { ...targeting, ...PLACEMENTS };
    if (next.geo_locations && typeof next.geo_locations === 'object') {
      const geo = { ...(next.geo_locations as Record<string, unknown>) };
      delete geo.location_types;
      next.geo_locations = geo;
    }
    if (!APPLY) {
      console.log('    after :', JSON.stringify(PLACEMENTS), '  [dry run — nothing written]');
      continue;
    }

    const write = await metaGraph(id, { method: 'POST', params: { targeting: next }, token: ctx.token, propertyId: PROPERTY });
    if (!write.ok) { console.error(`    WRITE FAILED — ${write.error}`); continue; }

    // Read the write back to prove what Meta holds (doc §9h). But the read is EVENTUALLY
    // CONSISTENT: a verify issued immediately after a successful POST can still return the old
    // targeting, which reads exactly like "the write silently did nothing" and invites a pointless
    // second write on a live ad set. Retry until Meta echoes what we sent, then report.
    const sent = JSON.stringify(PLACEMENTS.facebook_positions);
    let verify = await metaGraph<{ targeting: Record<string, unknown> }>(
      id, { params: { fields: 'targeting' }, token: ctx.token, propertyId: PROPERTY }
    );
    for (let i = 0; i < 4; i++) {
      if (verify.ok && JSON.stringify(verify.data.targeting.facebook_positions) === sent) break;
      await new Promise((r) => setTimeout(r, 2500));
      verify = await metaGraph<{ targeting: Record<string, unknown> }>(
        id, { params: { fields: 'targeting' }, token: ctx.token, propertyId: PROPERTY }
      );
    }
    if (!verify.ok) { console.error(`    wrote, but read-back failed — ${verify.error}`); continue; }
    const t = verify.data.targeting;
    if (JSON.stringify(t.facebook_positions) !== sent) {
      console.log('    NOTE: Meta still echoes the old placements after ~10s. Re-read before acting;');
      console.log('          a stale verify is far more likely here than a silently dropped write.');
    }
    const held = {
      publisher_platforms: t.publisher_platforms,
      facebook_positions: t.facebook_positions,
      instagram_positions: t.instagram_positions,
    };
    const reelsGone = !JSON.stringify(held).includes('reels');
    // Compare the geography itself, not `location_types` - Meta re-adds its own default to that
    // key on read-back, which would otherwise show up as a spurious "geo changed" alarm.
    const geoOnly = (g: unknown) => {
      const c = { ...((g ?? {}) as Record<string, unknown>) };
      delete c.location_types;
      return JSON.stringify(c);
    };
    const geoKept = geoOnly(t.geo_locations) === geoOnly(targeting.geo_locations);
    console.log('    Meta now holds:', JSON.stringify(held));
    console.log(`    reels excluded: ${reelsGone ? 'YES' : 'NO — CHECK THIS'} · geo unchanged: ${geoKept ? 'yes' : 'NO — CHECK THIS'}`);

    // RETARGETING SURVIVAL. `targeting` is REPLACE, so a placement write that drops
    // `custom_audiences` or resets `targeting_automation.advantage_audience` to its default of 1
    // turns a retarget into prospecting — same spend, strangers. Nothing else on the ad set would
    // look wrong, so assert it here rather than hope.
    const audsBefore = JSON.stringify((targeting as any).custom_audiences ?? []);
    const audsAfter = JSON.stringify((t as any).custom_audiences ?? []);
    const advBefore = (targeting as any).targeting_automation?.advantage_audience;
    const advAfter = (t as any).targeting_automation?.advantage_audience;
    if (audsBefore !== '[]' || advBefore !== undefined) {
      const ok = audsBefore === audsAfter && advBefore === advAfter;
      console.log(`    custom_audiences kept: ${audsBefore === audsAfter ? 'yes' : 'NO — CHECK THIS'} · advantage_audience ${advBefore} -> ${advAfter} ${ok ? '' : ' — CHECK THIS'}`);
    }
  }
  if (!APPLY) console.log('\nDry run. Re-run with --apply to write.\n');
})().catch((e) => { console.error(e); process.exit(1); });
