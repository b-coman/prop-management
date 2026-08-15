#!/usr/bin/env npx tsx
/**
 * spike-traffic-objective — live contract spike for the OUTCOME_TRAFFIC /
 * LANDING_PAGE_VIEWS ad-set path, in the same shape as the §9b/§9c/§9f spikes
 * recorded in docs/meta-ads-infrastructure-2026.md.
 *
 * Creates a campaign + ad set through the REAL code path (`createCampaign`,
 * `createAdSet` — not a hand-rolled payload, so this tests what ships), reads
 * the ad set back to confirm Meta accepted the optimisation contract, then
 * deletes both.
 *
 * Everything is created PAUSED by `createResource`'s single enforcement point,
 * so it cannot deliver or spend even between create and delete. It also stops
 * short of creative/ad: those are unchanged by the traffic work, and skipping
 * them keeps the spike from publishing anything as the Page.
 *
 * Usage:
 *   npx tsx scripts/spike-traffic-objective.ts            # dry run, prints the plan
 *   npx tsx scripts/spike-traffic-objective.ts --apply    # create, verify, delete
 *   npx tsx scripts/spike-traffic-objective.ts --apply --keep   # leave objects for inspection
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// The runtime reads tokens from env; locally they live in Secret Manager
// (same pattern as scripts/caption-gallery.ts).
for (const secret of ['META_ADS_TOKENS']) {
  if (!process.env[secret]) {
    process.env[secret] = execSync(
      `gcloud secrets versions access latest --secret=${secret} --project=rentalspot-fzwom`,
      { encoding: 'utf8' }
    ).trim();
  }
}

const PROPERTY = 'prahova-mountain-chalet';
const apply = process.argv.includes('--apply');
const keep = process.argv.includes('--keep');

(async () => {
  const { createCampaign, createAdSet } = await import('@/services/growth/metaAds/campaignBuilder');
  const { deleteResource } = await import('@/services/growth/metaAds/client');
  const { resolveAdContext } = await import('@/services/growth/metaAds/adContext');

  const ctx = await resolveAdContext(PROPERTY);
  if (!ctx) {
    console.error('  no ad context for', PROPERTY);
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const endTime = new Date(Date.now() + 3 * 86400000).toISOString();

  console.log(`Account : ${ctx.adAccountId}`);
  console.log(`Mode    : ${apply ? 'APPLY (create PAUSED, verify, delete)' : 'DRY RUN'}\n`);
  console.log('  campaign  objective=OUTCOME_TRAFFIC  status=PAUSED');
  console.log('  ad set    optimization_goal=LANDING_PAGE_VIEWS  billing_event=IMPRESSIONS');
  console.log('            promoted_object OMITTED   conversion_domain SENT (open question)');
  console.log(`            daily_budget=500 bani (5 RON, above Meta's RON4 floor)   end_time=${endTime}\n`);

  if (!apply) {
    console.log('  dry run; re-run with --apply');
    process.exit(0);
  }

  const created: Array<{ kind: string; id: string }> = [];
  const cleanup = async () => {
    if (keep) {
      console.log('\n  --keep set; leaving objects in place:');
      created.forEach((c) => console.log(`    ${c.kind} ${c.id}`));
      return;
    }
    console.log('\n  cleaning up (reverse order)…');
    for (const c of [...created].reverse()) {
      const res = await deleteResource(c.id, ctx.token, PROPERTY);
      console.log(`    delete ${c.kind} ${c.id}: ${res.ok ? 'ok' : 'FAILED ' + res.error}`);
    }
  };

  try {
    const camp = await createCampaign(PROPERTY, {
      name: `SPIKE traffic ${stamp}`,
      objective: 'OUTCOME_TRAFFIC',
    } as never);
    if (!camp.ok) {
      console.log(`  CAMPAIGN FAILED: ${camp.error}`);
      await cleanup();
      process.exit(1);
    }
    console.log(`  campaign created: ${camp.data.id}`);
    created.push({ kind: 'campaign', id: camp.data.id });

    const adset = await createAdSet(PROPERTY, camp.data.id, {
      name: `SPIKE traffic adset ${stamp}`,
      dailyBudgetMinor: 500,
      landingUrl: 'https://prahova-chalet.ro/ro/',
      endTime,
      objective: 'OUTCOME_TRAFFIC',
      targeting: { geo_locations: { countries: ['RO'] } },
    } as never);

    if (!adset.ok) {
      console.log(`\n  AD SET FAILED: ${adset.error}`);
      console.log('  ^ this is the finding — record it in docs/meta-ads-infrastructure-2026.md');
      await cleanup();
      process.exit(1);
    }
    console.log(`  ad set created  : ${adset.data.id}`);
    created.push({ kind: 'adSet', id: adset.data.id });

    // Read back what Meta actually stored — the point of the spike.
    const fields = 'optimization_goal,billing_event,promoted_object,destination_type,status,effective_status,daily_budget,campaign{objective}';
    const r = await fetch(
      `https://graph.facebook.com/v25.0/${adset.data.id}?fields=${fields}`,
      { headers: { Authorization: `Bearer ${ctx.token}` } }
    );
    const back = await r.json();
    console.log('\n  META READ-BACK:');
    console.log('   ', JSON.stringify(back, null, 2).split('\n').join('\n    '));

    const okGoal = back.optimization_goal === 'LANDING_PAGE_VIEWS';
    const noPromoted = !back.promoted_object;
    const paused = back.status === 'PAUSED';
    console.log('\n  VERDICT');
    console.log(`    optimization_goal=LANDING_PAGE_VIEWS : ${okGoal ? 'PASS' : 'FAIL (' + back.optimization_goal + ')'}`);
    console.log(`    no promoted_object                   : ${noPromoted ? 'PASS' : 'FAIL'}`);
    console.log(`    created PAUSED (cannot spend)        : ${paused ? 'PASS' : 'FAIL (' + back.status + ')'}`);

    await cleanup();
    process.exit(okGoal && noPromoted && paused ? 0 : 1);
  } catch (e) {
    console.error('  spike threw:', (e as Error).message);
    await cleanup();
    process.exit(1);
  }
})();
