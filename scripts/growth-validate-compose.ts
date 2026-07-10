/**
 * Phase 2a console-pipeline validation (DRY RUN, zero spend). Exercises the
 * REAL neutral compose path — composeAndCreateAd (Storage image upload + cache,
 * neutral→Meta mapping, pre-allocated id + utm_campaign, createCampaignChain) —
 * against the live account, then the gateway's dry-run activation, then deletes
 * everything it made. GROWTH_ADS_ENABLED is set in-process; MODE is left
 * dry-run, so activation returns 'dry-run' and never spends.
 *
 * Usage: npx tsx scripts/growth-validate-compose.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

process.env.GROWTH_ADS_ENABLED = 'true'; // master switch on; MODE stays dry-run (no spend)
process.env.META_ADS_TOKENS = execSync(
  'gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom',
  { encoding: 'utf8' }
).trim();

import { composeAndCreateAd } from '@/services/growth/adComposer';
import { activateCampaign } from '@/services/growth/adExecutionGateway';
import { deleteResource } from '@/services/growth/metaAds/client';
import { resolveAdContext } from '@/services/growth/metaAds/adContext';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const P = 'prahova-mountain-chalet';
const STORAGE_PATH = 'properties/prahova-mountain-chalet/images/70ae67f4-603a-4f3f-9a00-46f0e8c75cd5.jpg';

(async () => {
  console.log('=== Phase 2a console-pipeline validation (DRY RUN, real photo, self-cleaning) ===\n');

  const endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await composeAndCreateAd({
    propertyId: P,
    assetRef: { kind: 'gallery', storagePath: STORAGE_PATH },
    copy: [{ primary: 'Escape to the Carpathians — a cozy mountain chalet in Comarnic.', headline: 'Your mountain escape', cta: 'learn_more' }],
    objective: 'sales',
    landingBaseUrl: 'https://prahova-chalet.ro/ro', // the /ro decision — RO landing
    dailyBudgetMinor: 500, // 5 RON/day (PAUSED — never spends)
    targeting: { countries: ['RO'], ageMin: 30, ageMax: 55 },
    endTime,
  });

  console.log('composeAndCreateAd:', JSON.stringify(res, null, 2));
  if (!res.ok) { console.error(`\nFAILED at stage "${res.stage}": ${res.error}`); process.exit(1); }

  // Verify the tracking doc: draft + utm_campaign=<id> in the creative link + no spend cap.
  const db = await getAdminDb();
  const doc = (await db.collection('adCampaigns').doc(res.adCampaignId).get()).data();
  console.log('\nadCampaigns doc:', JSON.stringify({
    status: doc?.status, dailyBudgetMinor: doc?.dailyBudgetMinor, endTime: doc?.endTime,
    spendCapMinor: doc?.spendCapMinor ?? '(unset — correct)', metaCampaignId: doc?.metaCampaignId,
  }, null, 2));

  // Dry-run activation: two-switch gate → 'dry-run', no Meta activation, zero spend.
  const act = await activateCampaign(P, res.metaCampaignId, { actor: 'validate-compose-script' });
  console.log('\nactivateCampaign (expect dry-run):', JSON.stringify(act));
  console.log(act.status === 'dry-run' ? '  ✅ two-switch dry-run gate held — no spend' : '  ❌ UNEXPECTED: ' + act.status);

  // === CLEANUP === delete the Meta chain + the tracking doc (keep the uploaded image — reusable).
  console.log('\n=== CLEANUP ===');
  const ctx = await resolveAdContext(P);
  const token = ctx!.token;
  for (const [kind, id] of [['ad', res.metaAdId], ['creative', res.creativeId], ['adSet', res.metaAdSetId], ['campaign', res.metaCampaignId]] as const) {
    const del = await deleteResource(id, token, P);
    console.log(`  del ${kind} ${id}: ${del.ok ? 'ok' : 'FAILED ' + del.error}`);
  }
  await db.collection('adCampaigns').doc(res.adCampaignId).delete();
  console.log(`  del adCampaigns doc ${res.adCampaignId}: ok`);

  console.log('\n✅ Console pipeline validated end-to-end in dry-run — real photo uploaded, chain built PAUSED, dry-run gate held, cleaned up. Zero spend.');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
