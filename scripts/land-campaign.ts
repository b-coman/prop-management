#!/usr/bin/env npx tsx
/**
 * land-campaign — turn a validated planner brief + copywriter drafts into a reviewable DRAFT
 * campaign in Firestore (the Opportunity-Engine "landing"). This is the operator entry point;
 * the eventual in-app orchestration calls the same `createProposedCampaign` after the LLM stages.
 *
 * It does NOT queue or send anything — it writes a status:'draft' campaign with the per-guest
 * bodies and the campaign-level proposal. The owner reviews it at Gate 1 in /admin/campaigns,
 * then approves → outbox → Gate-2 wa.me. All guardrails re-run at send time regardless.
 *
 * Usage:
 *   npx tsx scripts/land-campaign.ts --brief /tmp/brief.json --drafts /tmp/drafts.json \
 *     [--name "Autumn gap – RO past guests"] [--plan-pack /tmp/plan.json] [--copy-pack /tmp/copy.json]
 *
 * If --plan-pack / --copy-pack are given, it re-validates (validatePlan / validateDrafts) and
 * REFUSES to land on any hard error — defense in depth. Without them it trusts upstream validation
 * and warns. Exit 0 = landed, 1 = rejected/failed.
 */
import * as fs from 'fs';
import { validatePlan } from '../src/lib/growth/validatePlan';
import { validateDrafts, type GuestForDraftValidation } from '../src/lib/growth/validateDrafts';
import { briefGuestIds, type CampaignBrief, type DraftMessage } from '../src/lib/growth/contracts';
import { createProposedCampaign } from '../src/services/campaignService';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

async function main() {
  const briefFile = arg('brief');
  const draftsFile = arg('drafts');
  if (!briefFile || !draftsFile) {
    console.error('required: --brief <brief.json> --drafts <drafts.json> [--name ...] [--plan-pack ...] [--copy-pack ...]');
    process.exit(2);
  }

  const brief = readJson(briefFile) as CampaignBrief;
  const drafts = readJson(draftsFile) as DraftMessage[];
  const planPackFile = arg('plan-pack');
  const copyPackFile = arg('copy-pack');

  // ── re-validate if the packs are provided (the same gates the orchestrator runs) ──
  if (planPackFile) {
    const pv = validatePlan(readJson(planPackFile), { act: brief.act, audience: brief.audience, offer: brief.offer });
    console.log(`plan validation — ${pv.ok ? 'PASS' : 'REJECT'} (selected ${pv.stats.selected} · eligible ${pv.stats.eligible} · cap ${pv.stats.runCap})`);
    pv.errors.forEach((e) => console.log(`  ✖ ${e}`));
    pv.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    if (!pv.ok) { console.error('refusing to land — plan invalid'); process.exit(1); }
  } else {
    console.log('⚠ no --plan-pack given — trusting upstream validatePlan');
  }

  if (copyPackFile) {
    const copyPack = readJson(copyPackFile);
    const guests: GuestForDraftValidation[] = (copyPack.guests ?? copyPack).map((g: {
      guestId: string; careFlags?: string[]; groundedFacts?: Array<{ key: string; value: unknown }>; thread?: unknown[];
    }) => ({
      guestId: g.guestId,
      careFlags: g.careFlags ?? [],
      groundedFacts: g.groundedFacts ?? [],
      thread: g.thread ?? [],
    }));
    const dv = validateDrafts(guests, drafts);
    console.log(`draft validation — ${dv.ok ? 'PASS' : 'REJECT'}`);
    dv.errors.forEach((e) => console.log(`  ✖ ${e}`));
    dv.perGuest.forEach((p) => { p.errors.forEach((e) => console.log(`  ✖ ${p.guestId}: ${e}`)); p.warnings.forEach((w) => console.log(`  ⚠ ${p.guestId}: ${w}`)); });
    if (!dv.ok) { console.error('refusing to land — drafts invalid'); process.exit(1); }
  } else {
    console.log('⚠ no --copy-pack given — trusting upstream validateDrafts');
  }

  const name = arg('name') || `${brief.occasion.name ?? 'Campaign'} — ${briefGuestIds(brief).length} recipients`;
  const campaignId = await createProposedCampaign({ name, brief, drafts });

  console.log(`\n✅ landed draft campaign ${campaignId}`);
  console.log(`   ${briefGuestIds(brief).length} recipients · offer ${brief.offer.discountPct ?? 0}% · occasion "${brief.occasion.name ?? '(none)'}"`);
  console.log(`   review at /admin/campaigns/${campaignId} → approve → outbox → wa.me`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
