#!/usr/bin/env npx tsx
/**
 * ad-propose — run the FULL ad proposal pipeline for a window: opportunity → plan → creative →
 * composeAndCreateAd, producing a real PAUSED draft (zero spend), then SELF-CLEAN (delete the Meta
 * objects + the adCampaigns doc) unless --keep. This validates the whole intelligence→draft chain
 * end to end. Nothing ever activates or spends — creation is PAUSED; activation is a separate gate.
 *
 * GROWTH_ADS_ENABLED is set in-process (compose's master switch); GROWTH_ADS_MODE stays unset, so
 * even if a draft were activated it would be a no-op dry-run. Tokens from Secret Manager.
 *
 * Usage:
 *   npx tsx scripts/ad-propose.ts --start 2026-09-06 --end 2026-09-17 --value 6372 [--occasion "..."] [--keep]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

process.env.GROWTH_ADS_ENABLED = 'true'; // enable compose (zero-spend creation); MODE stays unset
const secret = (name: string) =>
  execSync(`gcloud secrets versions access latest --secret=${name} --project=rentalspot-fzwom`, { encoding: 'utf8' }).trim();
process.env.META_ADS_TOKENS = secret('META_ADS_TOKENS');
process.env.ANTHROPIC_API_KEY = secret('ANTHROPIC_API_KEY');

import { proposeAd } from '@/services/growth/adProposal';
import { deleteResource } from '@/services/growth/metaAds/client';
import { resolveAdContext } from '@/services/growth/metaAds/adContext';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import type { AdOpportunity } from '@/lib/growth/contracts';

const arg = (n: string, d?: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const start = arg('start');
const end = arg('end');
if (!start || !end) {
  console.error('required: --start YYYY-MM-DD --end YYYY-MM-DD [--value RON] [--occasion "..."] [--property slug] [--keep]');
  process.exit(2);
}
const property = arg('property', 'prahova-mountain-chalet')!;
const value = arg('value');
const occasionName = arg('occasion');
const framing = { goal: arg('goal'), audience: arg('audience') };
const keep = process.argv.includes('--keep');

const nights = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
const daysOut = Math.max(0, Math.round((Date.parse(start) - Date.now()) / 86400000));
const opportunity: AdOpportunity = {
  id: `adhoc-${start}-${end}`,
  propertyId: property,
  source: 'gap',
  window: { start, end, nights },
  daysOut,
  occasion: occasionName ? { name: occasionName, type: 'ad-hoc', startDate: start, endDate: end } : null,
  valueAtRisk: value ? Number(value) : null,
  instrument: 'ads',
  rationale: 'ad-hoc proposal (CLI, self-cleaning)',
};

(async () => {
  const res = await proposeAd(opportunity, { framing });
  console.log(`\n=== proposeAd — ${res.ok ? (res.declined ? 'DECLINED (no draft)' : 'DRAFT CREATED') : `FAILED at ${res.stage}`} ===`);
  if (res.brief) console.log(`plan: act=${res.brief.act} · ${res.brief.targeting.cities.map((c) => c.name).join(', ')} · ${(res.brief.dailyBudgetMinor / 100).toFixed(0)} RON/day`);
  if (res.creative) console.log(`creative: ${res.creative.copy.length} copy variants · ${res.creative.assetPaths.length} photos`);
  if (res.errors.length) console.log(`errors: ${res.errors.join(' · ')}`);
  if (res.draft) {
    console.log(`draft ids: adCampaign=${res.draft.adCampaignId} campaign=${res.draft.metaCampaignId} adset=${res.draft.metaAdSetId} ad=${res.draft.metaAdId} creative=${res.draft.creativeId}`);

    if (keep) {
      console.log('\n--keep: PAUSED draft left in place for inspection (remember to delete it in Ads Manager / Firestore).');
    } else {
      console.log('\nself-cleaning (zero spend was possible — everything was PAUSED)…');
      const ctx = await resolveAdContext(property);
      if (ctx) {
        // NB: a Dynamic-Creative AD cannot be deleted directly (Meta err 100/1340029) — deleting the
        // parent ad set (and the campaign) CASCADES to the ad. Creatives are account-level, deleted
        // separately. So: adSet → campaign (cascade the ad) → creative.
        for (const id of [res.draft.metaAdSetId, res.draft.metaCampaignId, res.draft.creativeId]) {
          const d = await deleteResource(id, ctx.token, property);
          console.log(`  delete ${id}: ${d.ok ? 'ok' : d.error}`);
        }
      }
      const db = await getAdminDb();
      await db.collection('adCampaigns').doc(res.draft.adCampaignId).delete();
      console.log(`  deleted adCampaigns/${res.draft.adCampaignId}`);
    }
  }
  process.exit(res.ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
