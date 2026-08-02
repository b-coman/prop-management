/**
 * adProposal — the orchestrator that turns ONE ads-routed opportunity into a PAUSED, reviewable ad
 * DRAFT, end to end (promotion-system-architecture.md §4.2). It is the single seam the brain / the
 * `/admin/ads` "Generate" action / the `/api/growth/ad-proposals` endpoint all call:
 *
 *   opportunity → buildAdPlannerPack → generateAdPlan (AdBrief) → generateAdCreative (copy+photos)
 *              → composeAndCreateAd (PAUSED Meta chain + adCampaigns draft)
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

/**
 * Produce a PAUSED ad draft for an opportunity. Returns at the first stage that fails (with its
 * errors), or `declined:true` if the planner chose not to act, or the created draft ids on success.
 */
export async function proposeAd(opportunity: AdOpportunity, opts?: { asOf?: Date; framing?: AdFraming }): Promise<AdProposalResult> {
  const pack = await buildAdPlannerPack(opportunity, { asOf: opts?.asOf, framing: opts?.framing });

  // 1. Plan (geo + budget + timing + creative brief) — the pack carries the framing (goal + audience).
  const plan = await generateAdPlan(opportunity, { pack });
  if (!plan.ok || !plan.brief) {
    logger.warn('proposeAd: planning failed', { opportunityId: opportunity.id, errors: plan.errors });
    return { ok: false, stage: 'plan', declined: false, errors: plan.errors };
  }
  const brief = plan.brief;
  if (!brief.act) {
    logger.info('proposeAd: planner declined', { opportunityId: opportunity.id, rationale: brief.rationale });
    return { ok: true, stage: 'plan', declined: true, brief, errors: [] };
  }

  // 2. Creative (grounded copy + real photos) — reinforce the same goal + audience shaping.
  const creativeRes = await generateAdCreative(brief, pack.assets, { framing: opts?.framing });
  if (!creativeRes.ok || !creativeRes.creative) {
    logger.warn('proposeAd: creative failed', { opportunityId: opportunity.id, errors: creativeRes.errors });
    return { ok: false, stage: 'creative', declined: false, brief, errors: creativeRes.errors };
  }
  const creative = creativeRes.creative;

  // 3. Compose into a PAUSED Meta chain + adCampaigns draft (zero spend).
  const input: ComposeAndCreateAdInput = {
    propertyId: brief.propertyId,
    assetRefs: creative.assetPaths.map((storagePath) => ({ kind: 'gallery' as const, storagePath })),
    copy: creative.copy,
    objective: brief.objective,
    landingBaseUrl: pack.landing.baseUrl,
    dailyBudgetMinor: brief.dailyBudgetMinor,
    targeting: { cities: brief.targeting.cities },
    endTime: brief.endTime,
  };
  const compose = await composeAndCreateAd(input);
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
