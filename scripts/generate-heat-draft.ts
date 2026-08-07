/**
 * One-off: mirror generateAdProposalAction (minus auth) to produce the heat-escape ad as a
 * FIRESTORE-ONLY draft — planAndCreative (zero Meta footprint) → adCampaigns doc status 'draft'.
 * Nothing on Meta, no email. Reviewable at /admin/ads/[id].
 */
import * as dotenv from 'dotenv'; import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const secret = (n: string) => execSync(`gcloud secrets versions access latest --secret=${n} --project=rentalspot-fzwom`, { encoding: 'utf8' }).trim();
if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = secret('ANTHROPIC_API_KEY');
if (!process.env.META_ADS_TOKENS) process.env.META_ADS_TOKENS = secret('META_ADS_TOKENS');
process.env.GROWTH_ADS_ENABLED = 'true';

import { planAndCreative } from '@/services/growth/adProposal';
import { buildGenerationPrompt } from '@/lib/growth/generationPrompt';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import type { AdOpportunity } from '@/lib/growth/contracts';
import type { PropertyImage } from '@/types';

const P = 'prahova-mountain-chalet';
const start = '2026-08-23', end = '2026-09-07';
const opportunity: AdOpportunity = {
  id: `oe-${P}-${start}-${end}`, propertyId: P, source: 'gap',
  window: { start, end, nights: Math.round((Date.parse(end)-Date.parse(start))/86400000) },
  daysOut: Math.max(0, Math.round((Date.parse(start)-Date.now())/86400000)),
  occasion: { name: 'Val de căldură în București — evadare la munte (sfârșit de august + prima săptămână de școală)', type: 'ad-hoc', startDate: start, endDate: end },
  valueAtRisk: 11414, instrument: 'ads', rationale: 'owner-initiated heat-escape campaign',
};
const framing = {
  goal: 'Fill the end-of-August and first-week-September nights (peak summer + the start of school break) with direct bookings, riding the current Bucharest heat wave (36°C+).',
  audience: 'City dwellers escaping the Bucharest summer heat — families and groups of friends who want mountain shade, cool nights, a fire pit, BBQ, a playground and a cauldron gulaș. Reached by geo (Bucharest + near feeder cities); the heat-escape hook in the copy qualifies them. Speak Romanian, warm and playful.',
};

(async () => {
  const res = await planAndCreative(opportunity, { framing });
  if (!res.ok || res.declined || !res.brief || !res.creative || !res.composeInput) {
    console.error('planAndCreative failed/declined:', res.errors, res.brief?.rationale); process.exit(1);
  }
  const db = await getAdminDb();
  const propDoc = await db.collection('properties').doc(P).get();
  const images = (propDoc.data()?.images ?? []) as PropertyImage[];
  const urlBy = new Map(images.filter(i=>i.storagePath).map(i=>[i.storagePath!, i.thumbnailUrl || i.url]));
  const descBy = new Map(images.filter(i=>i.storagePath).map(i=>[i.storagePath!, i.aiDescription?.summary ?? '']));
  const photos = res.creative.assetPaths.map(sp=>({ storagePath: sp, url: urlBy.get(sp) ?? '' }));
  const assetGaps = (res.creative.assetGaps ?? []).map(g=>({ need:g.need, nearestAssetPath:g.nearestAssetPath, nearestAssetUrl:urlBy.get(g.nearestAssetPath) ?? '', whyInsufficient:g.whyInsufficient, transform:g.transform, generationPrompt:buildGenerationPrompt(g.transform,g.need,descBy.get(g.nearestAssetPath) ?? '') }));

  const ref = db.collection('adCampaigns').doc();
  await ref.set({
    propertyId: P, status: 'draft',
    objective: res.composeInput.objective, dailyBudgetMinor: res.composeInput.dailyBudgetMinor, endTime: res.composeInput.endTime,
    composeInput: res.composeInput,
    proposal: {
      source: 'situation-owner', occasion: { name: opportunity.occasion!.name, start, end, nights: opportunity.window.nights },
      goal: framing.goal, audience: framing.audience, copy: res.creative.copy, photos,
      cities: res.brief.targeting.cities.map(c=>({name:c.name,radius:c.radius})),
      creativeBrief: res.brief.creativeBrief, rationale: res.brief.rationale, assetGaps,
    },
    createdBy: 'owner-heat-campaign', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`\nFIRESTORE-ONLY DRAFT: ${ref.id}  (status 'draft', nothing on Meta)`);
  console.log(`plan: ${res.brief.targeting.cities.map(c=>c.name+'('+c.radius+'km)').join(', ')} · ${(res.composeInput.dailyBudgetMinor/100).toFixed(0)} RON/day · ends ${res.composeInput.endTime.slice(0,10)}`);
  console.log(`\n=== COPY (${res.creative.copy.length} variants) ===`);
  res.creative.copy.forEach((c:any,i:number)=>console.log(`\n[${i+1}] ${c.headline}\n    ${c.primary}\n    CTA: ${c.cta}`));
  console.log(`\n=== PHOTOS (${photos.length}) ===`);
  photos.forEach(p=>console.log('  '+p.storagePath.split('/').pop()+'  '+(descBy.get(p.storagePath)||'').slice(0,70)));
  console.log(`\n=== ASSET GAPS (${assetGaps.length}) ===`);
  assetGaps.forEach(g=>console.log('  need: '+g.need));
  console.log(`\nReview at /admin/ads/${ref.id}`);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
