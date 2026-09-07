#!/usr/bin/env npx tsx
/**
 * land-season-plan — turn a validated season plan into a reviewable document in
 * Firestore. The one write path; the skill never writes directly.
 *
 * It does NOT create anything on Meta and does NOT spend. It records which
 * windows are worth advertising this season, in what order, with an ADVISORY
 * budget each. Campaigns are still generated one at a time in /admin/ads, and
 * every existing money gate applies unchanged.
 *
 *   npx tsx scripts/land-season-plan.ts --plan /tmp/plan.json --pack /tmp/season.json
 *   npx tsx scripts/land-season-plan.ts --plan … --pack … --activate --actor you@example.com
 *
 * With --pack it re-runs `validateSeasonPlan` and REFUSES to land on any hard
 * error — defense in depth, exactly like land-campaign.ts. It then RECOMPUTES the
 * ledger live, because a plan built on Tuesday against a boost made on Wednesday
 * is arithmetically valid and financially wrong.
 *
 * Exit 0 = landed, 1 = rejected/failed, 2 = bad arguments.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.META_ADS_TOKENS) {
  try {
    process.env.META_ADS_TOKENS = execSync(
      'gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
  } catch { /* the live ledger re-check will report it */ }
}

import { validateSeasonPlan } from '@/lib/growth/validateSeasonPlan';
import { landSeasonPlan } from '@/services/growth/seasonPlanService';
import { computeSeasonLedger } from '@/lib/growth/seasonLedger';
import { fetchInFlight, fetchTrackedMetaCampaignIds } from '@/lib/growth/inFlight';
import { getAccountSpend, todayInTimezone } from '@/services/growth/metaAds/accountSpend';
import { adYearFor, annualBudgetMinorFor, AD_RESERVE_PCT } from '@/config/growth-ads';
import type { SeasonPlan } from '@/lib/growth/contracts';
import type { SeasonPack } from '@/lib/growth/seasonPack';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const has = (n: string) => process.argv.includes(`--${n}`);
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const ron = (minor: number) => `${(minor / 100).toFixed(0)} RON`;

type LandablePlan = Pick<SeasonPlan, 'slots' | 'excluded' | 'season' | 'envelope' | 'asOf' | 'narrative'> & {
  propertyId?: string;
  seasonKey?: string;
  method?: string[];
};

async function main() {
  const planFile = arg('plan');
  if (!planFile) {
    console.error('required: --plan <plan.json> [--pack <season.json>] [--activate] [--actor <email>] [--dry-run]');
    process.exit(2);
  }

  const plan = readJson(planFile) as LandablePlan;
  const packFile = arg('pack');
  const dryRun = has('dry-run');
  const activate = has('activate');

  // ── 1. re-validate against the pack the plan was built from ──
  let pack: SeasonPack | null = null;
  if (packFile) {
    pack = readJson(packFile) as SeasonPack;
    const v = validateSeasonPlan(
      {
        season: pack.season,
        candidates: pack.candidates,
        constraints: pack.constraints,
        ledger: pack.ledger,
        deliverableAudienceIds: pack.deliverableAudienceIds,
      },
      plan
    );
    console.log(
      `plan validation — ${v.ok ? 'PASS' : 'REJECT'} ` +
        `(${v.stats.funded} funded / ${v.stats.unfunded} unfunded / ${v.stats.excluded} excluded · ` +
        `${ron(v.stats.totalAdvisoryMinor)} advised)`
    );
    v.errors.forEach((e) => console.log(`  ✖ ${e}`));
    v.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    if (!v.ok) {
      console.error('refusing to land — plan invalid');
      process.exit(1);
    }
  } else {
    console.log('⚠ no --pack given — trusting upstream validateSeasonPlan');
  }

  const propertyId = plan.propertyId ?? pack?.meta.generatedFor;
  const seasonKey = plan.seasonKey ?? pack?.meta.seasonKey;
  if (!propertyId || !seasonKey) {
    console.error('cannot determine propertyId/seasonKey — pass --pack, or put them on the plan');
    process.exit(2);
  }

  // ── 2. re-check the envelope against a LIVE ledger ──
  // The pack's ledger is a snapshot. Between building a plan and landing it, the
  // owner may have boosted a post by hand, or a live flight may have burned a
  // few more days of its budget. Landing against a stale ledger is how an
  // envelope silently goes over.
  const advisoryTotal = plan.slots.reduce((s, x) => s + x.advisoryBudgetMinor, 0);
  try {
    const adYear = adYearFor(plan.asOf.slice(0, 10));
    const [spend, inFlight, tracked] = await Promise.all([
      getAccountSpend(propertyId, adYear.start, todayInTimezone('CET')),
      fetchInFlight(propertyId, new Date().toISOString()),
      fetchTrackedMetaCampaignIds(propertyId),
    ]);
    const live = computeSeasonLedger({
      adYear,
      annualMinor: annualBudgetMinorFor(propertyId),
      reservePct: AD_RESERVE_PCT,
      accountSpend: spend.ok ? spend.data : null,
      trackedMetaCampaignIds: tracked,
      reservedInFlightMinor: inFlight.totalProjectedRemainingMinor,
      asOf: new Date().toISOString(),
    });
    console.log(
      `live ledger — spent ${ron(live.spentMinor)} · in-flight ${ron(live.reservedInFlightMinor)} · ` +
        `reserve ${ron(live.reserveMinor)} · remaining ${ron(live.remainingMinor)}`
    );
    if (!live.available) {
      console.log('  ⚠ Meta spend unreadable — the envelope could not be re-checked live');
    } else if (advisoryTotal > live.remainingMinor) {
      console.error(
        `  ✖ plan advises ${ron(advisoryTotal)} but only ${ron(live.remainingMinor)} remains right now`
      );
      console.error('refusing to land — the envelope moved since the pack was built');
      process.exit(1);
    }
  } catch (e) {
    console.log(`  ⚠ live ledger re-check failed (${(e as Error).message}) — landing on the pack's snapshot`);
  }

  if (dryRun) {
    console.log(`\nDRY RUN — would land ${plan.slots.filter((s) => s.funded).length} funded slot(s), ${ron(advisoryTotal)} advised`);
    process.exit(0);
  }

  // ── 3. land ──
  const res = await landSeasonPlan({
    propertyId,
    seasonKey,
    season: plan.season,
    envelope: plan.envelope,
    slots: plan.slots,
    excluded: plan.excluded,
    narrative: plan.narrative,
    method: plan.method ?? pack?.baseline.method ?? [],
    asOf: plan.asOf,
    createdBy: arg('actor', 'cli')!,
    activate,
  });

  console.log(`\nlanded ${res.id} (v${res.version}, ${res.status}${res.supersedes ? `, supersedes ${res.supersedes}` : ''})`);
  console.log(`  ${plan.slots.filter((s) => s.funded).length} funded · ${ron(advisoryTotal)} advised`);
  if (!activate) console.log('  (draft — pass --activate to make it the plan in force)');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
