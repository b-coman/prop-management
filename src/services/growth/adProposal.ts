/**
 * adProposal — the orchestrator that turns ONE ads-routed opportunity into an ad DRAFT, end to end
 * (promotion-system-architecture.md §4.2). Two entry points:
 *   - `planAndCreative(opportunity)` — plan + creative only, ZERO Meta footprint (what the `/admin/ads`
 *     "Generate" action calls; it lands a Firestore-only draft, and `pushAdToMetaAction` composes later).
 *   - `proposeAd(opportunity)` — planAndCreative + `composeAndCreateAd` in one shot (the CLI harness).
 * NB: there is NO `/api/growth/ad-proposals` HTTP route today — the console calls these functions
 * in-process. Such a seam is only needed if an out-of-app "brain" is ever added.
 *
 *   opportunity → buildAdPlannerPack → generateAdPlan (AdBrief) → generateAdCreative (copy+photos)
 *              → [proposeAd only] composeAndCreateAd (PAUSED Meta chain + adCampaigns draft)
 *
 * The pack is built ONCE and fed to both LLM stages. Every money/geo/creative guard already lives in
 * the stages it belongs to (`validateAdPlan`, `validateAdCreative`, `adComposer`'s budget policy) —
 * this orchestrator only sequences them and assembles the neutral `ComposeAndCreateAdInput`. It does
 * NOT spend or activate: `composeAndCreateAd` creates everything PAUSED (zero spend), and activation
 * stays the separate human money-gate (`adExecutionGateway`). A planner DECLINE (act:false) is a
 * valid, non-error outcome — no draft is created.
 *
 * Server-only. Throws only if the LLM is unconfigured (ANTHROPIC_API_KEY absent, via the stages).
 */
import { buildAdPlannerPack } from '@/lib/growth/adPlannerPack';
import { generateAdPlan } from './adPlanner';
import { generateAdCreative, type RawAssetGap } from './adCopywriter';
import { composeAndCreateAd } from './adComposer';
import type { AdOpportunity, AdBrief, AdFraming } from '@/lib/growth/contracts';
import type { ComposeAndCreateAdInput, CopyVariant } from '@/types';
import { loggers } from '@/lib/logger';

const logger = loggers.ads;

export type AdProposalStage = 'plan' | 'creative' | 'compose';

export interface AdProposalResult {
  ok: boolean;
  stage: AdProposalStage;
  /** The planner chose NOT to act (weak opportunity). `ok:true`, no draft created. */
  declined: boolean;
  brief?: AdBrief;
  creative?: { copy: CopyVariant[]; assetPaths: string[]; notes?: string; assetGaps?: RawAssetGap[] };
  /** The created PAUSED draft ids (present only on a full success). */
  draft?: { adCampaignId: string; metaCampaignId: string; metaAdSetId: string; metaAdId: string; creativeId: string };
  errors: string[];
}

/** The intelligence half of a proposal: plan + creative, with NO Meta footprint. */
export interface PlanAndCreativeResult {
  ok: boolean;
  stage: AdProposalStage;
  declined: boolean;
  brief?: AdBrief;
  creative?: { copy: CopyVariant[]; assetPaths: string[]; notes?: string; assetGaps?: RawAssetGap[] };
  /** The neutral compose input to replay LATER at push time (present on ok, non-declined). */
  composeInput?: ComposeAndCreateAdInput;
  landingBaseUrl?: string;
  errors: string[];
}

/**
 * Run ONLY the intelligence chain — buildAdPlannerPack → generateAdPlan → generateAdCreative — and
 * return the brief + creative + the neutral `ComposeAndCreateAdInput` that a later push can replay.
 * This creates NOTHING on Meta (no policy review, no email): it is what the `/admin/ads` "Generate"
 * action calls so a proposal can be reviewed + edited as a Firestore-only draft first. The separate
 * `pushAdToMetaAction` is the only step that turns this into a real (PAUSED) Meta chain.
 */
export async function planAndCreative(opportunity: AdOpportunity, opts?: { asOf?: Date; framing?: AdFraming }): Promise<PlanAndCreativeResult> {
  const pack = await buildAdPlannerPack(opportunity, { asOf: opts?.asOf, framing: opts?.framing });

  // 1. Plan (geo + budget + timing + creative brief) — the pack carries the framing (goal + audience).
  const plan = await generateAdPlan(opportunity, { pack });
  if (!plan.ok || !plan.brief) {
    logger.warn('planAndCreative: planning failed', { opportunityId: opportunity.id, errors: plan.errors });
    return { ok: false, stage: 'plan', declined: false, errors: plan.errors };
  }
  const brief = plan.brief;
  if (!brief.act) {
    logger.info('planAndCreative: planner declined', { opportunityId: opportunity.id, rationale: brief.rationale });
    return { ok: true, stage: 'plan', declined: true, brief, errors: [] };
  }

  // 2. Creative (grounded copy + real photos) — reinforce the same goal + audience shaping.
  const creativeRes = await generateAdCreative(brief, pack.assets, { framing: opts?.framing, voice: pack.voice });
  if (!creativeRes.ok || !creativeRes.creative) {
    logger.warn('planAndCreative: creative failed', { opportunityId: opportunity.id, errors: creativeRes.errors });
    return { ok: false, stage: 'creative', declined: false, brief, errors: creativeRes.errors };
  }
  const creative = creativeRes.creative;

  // Assemble the neutral compose input now, so push can replay it verbatim (with any operator edits).
  const composeInput: ComposeAndCreateAdInput = {
    propertyId: brief.propertyId,
    assetRefs: creative.assetPaths.map((storagePath) => ({ kind: 'gallery' as const, storagePath })),
    copy: creative.copy,
    objective: brief.objective,
    landingBaseUrl: pack.landing.baseUrl,
    dailyBudgetMinor: brief.dailyBudgetMinor,
    targeting: { cities: brief.targeting.cities },
    endTime: brief.endTime,
  };
  return { ok: true, stage: 'creative', declined: false, brief, creative, composeInput, landingBaseUrl: pack.landing.baseUrl, errors: [] };
}

/**
 * Produce a PAUSED ad draft for an opportunity, INCLUDING the Meta chain — the all-in-one path used
 * by the CLI harness (`ad-propose`) and any caller that wants a real draft in one shot. The admin
 * console does NOT use this anymore (it splits generate/push); it calls `planAndCreative` then
 * `pushAdToMetaAction`. Returns at the first failing stage, `declined:true`, or the created ids.
 */
export async function proposeAd(opportunity: AdOpportunity, opts?: { asOf?: Date; framing?: AdFraming }): Promise<AdProposalResult> {
  const pc = await planAndCreative(opportunity, opts);
  if (!pc.ok || pc.declined || !pc.brief || !pc.creative || !pc.composeInput) {
    return { ok: pc.ok, stage: pc.stage, declined: pc.declined, brief: pc.brief, creative: pc.creative, errors: pc.errors };
  }
  const brief = pc.brief;
  const creative = pc.creative;

  // 3. Compose the (already-assembled) neutral input into a PAUSED Meta chain + adCampaigns draft.
  const compose = await composeAndCreateAd(pc.composeInput);
  if (!compose.ok) {
    logger.warn('proposeAd: compose failed', { opportunityId: opportunity.id, stage: compose.stage, error: compose.error });
    return { ok: false, stage: 'compose', declined: false, brief, creative, errors: [`${compose.stage}:${compose.error}`] };
  }

  logger.info('proposeAd: PAUSED draft created', { opportunityId: opportunity.id, adCampaignId: compose.adCampaignId });
  return {
    ok: true,
    stage: 'compose',
    declined: false,
    brief,
    creative,
    draft: {
      adCampaignId: compose.adCampaignId,
      metaCampaignId: compose.metaCampaignId,
      metaAdSetId: compose.metaAdSetId,
      metaAdId: compose.metaAdId,
      creativeId: compose.creativeId,
    },
    errors: [],
  };
}
