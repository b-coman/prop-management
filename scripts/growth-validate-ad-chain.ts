/**
 * Growth Ad Engine — Phase 1 LIVE validation of createCampaignChain against the
 * real Meta account. Creates the full OUTCOME_SALES chain PAUSED (zero spend),
 * reads back to confirm the un-activatable invariant + insights, then DELETES
 * all four Meta objects AND the adCampaigns Firestore doc. Self-cleaning.
 *
 * GROWTH_ADS_MODE is deliberately NOT set to live — creation is zero-spend;
 * activation stays gated behind adExecutionGateway. The money-scoped ads token
 * is pulled from Secret Manager at runtime, never passed on the command line.
 *
 * Usage: npx tsx scripts/growth-validate-ad-chain.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Enable the master switch for THIS PROCESS only (createCampaignChain gates on
// it). Fetch the ads token map from Secret Manager into the env so
// resolveAdContext can find it — keeps the token out of argv/transcript.
process.env.GROWTH_ADS_ENABLED = 'true';
process.env.META_ADS_TOKENS = execSync(
  'gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom',
  { encoding: 'utf8' }
).trim();

import { createCampaignChain } from '@/services/growth/metaAds/campaignBuilder';
import { getInsights } from '@/services/growth/metaAds/insights';
import { deleteResource } from '@/services/growth/metaAds/client';
import { resolveAdContext } from '@/services/growth/metaAds/adContext';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const P = 'prahova-mountain-chalet';
// An image already uploaded to this ad account's library (from the contract spike).
const IMAGE_HASH = '54daa820bdde391fae64bd2d4b62b4fb';

(async () => {
  console.log('=== Phase 1 LIVE ad-chain validation (real account, PAUSED, self-cleaning) ===\n');

  const spec = {
    campaign: { name: 'VALIDATION_delete_me — Phase1 chain' },
    adSet: {
      name: 'VALIDATION_delete_me — adset',
      dailyBudgetMinor: 5000, // 50 RON/day — PAUSED, never spends
      landingUrl: 'https://prahova-chalet.ro/',
      targeting: { geo_locations: { countries: ['RO'] } },
    },
    creative: {
      name: 'VALIDATION_delete_me — creative',
      link: 'https://prahova-chalet.ro/?utm_source=facebook&utm_medium=paid&utm_campaign=validation',
      message: 'Validation creative — safe to delete.',
      imageHash: IMAGE_HASH,
    },
    ad: { name: 'VALIDATION_delete_me — ad' },
  };

  const res = await createCampaignChain(P, spec);
  console.log('createCampaignChain result:', JSON.stringify(res, null, 2));
  if (!res.ok) {
    console.error(`\nFAILED at stage "${res.stage}": ${res.error}`);
    process.exit(1);
  }

  // Insights on the campaign — should be all-zeros (PAUSED, never delivered).
  const insights = await getInsights(P, res.campaignId);
  console.log('\ngetInsights (expect all-zeros):', JSON.stringify(insights, null, 2));

  // Confirm the Firestore doc is un-activatable: draft + NO spend cap.
  const db = await getAdminDb();
  const doc = (await db.collection('adCampaigns').doc(res.adCampaignId).get()).data();
  console.log('\nadCampaigns doc invariant check:', JSON.stringify({
    status: doc?.status,
    spendCapMinor: doc?.spendCapMinor ?? '(unset — correct, blocks activation)',
    metaCampaignId: doc?.metaCampaignId,
  }, null, 2));
  const invariantOk = doc?.status === 'draft' && (doc?.spendCapMinor === undefined || doc?.spendCapMinor === null);
  console.log(invariantOk ? '  ✅ un-activatable invariant holds' : '  ❌ INVARIANT VIOLATED');

  // === CLEANUP === delete most-dependent first, then the Firestore doc.
  console.log('\n=== CLEANUP ===');
  const ctx = await resolveAdContext(P);
  const token = ctx!.token;
  const targets: Array<[string, string]> = [
    ['ad', res.adId],
    ['creative', res.creativeId],
    ['adSet', res.adSetId],
    ['campaign', res.campaignId],
  ];
  for (const [kind, id] of targets) {
    const del = await deleteResource(id, token, P);
    console.log(`  del ${kind} ${id}: ${del.ok ? 'ok' : 'FAILED — ' + del.error}`);
  }
  await db.collection('adCampaigns').doc(res.adCampaignId).delete();
  console.log(`  del adCampaigns doc ${res.adCampaignId}: ok`);

  console.log('\n✅ Live validation complete — chain created PAUSED, verified, fully cleaned up. Zero spend.');
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
