/**
 * Ad chain creation — Phase 1 (plan §9 Phase 1; contract verified end-to-end
 * live and self-deleted, docs/meta-ads-infrastructure-2026.md §9b/§9c).
 *
 * Builds the full Meta OUTCOME_SALES chain — campaign → ad set → creative →
 * ad — one create call per stage, each routed through `createResource()` so
 * `client.ts`'s single PAUSED-enforcement point applies uniformly (Fable C2;
 * §9c confirmed even `/adcreatives` accepts/ignores `status=PAUSED`, so there
 * is no bypass among the four object types). This module NEVER un-pauses
 * anything — that is `adExecutionGateway.activateCampaign`'s job, gated on
 * the two-switch live mode + operator approval + a snapshotted spend cap
 * (H5/M3/M4). Creating PAUSED objects is zero-spend, so `createCampaignChain`
 * gates creation on the MASTER switch only (`isAdsEngineEnabled`) — NOT on
 * live mode. Gating creation on live mode too would block the intended
 * workflow (build it PAUSED → operator reviews it in Ads Manager/admin UI →
 * approves → gateway activates); the two switches guard DIFFERENT things.
 *
 * Rollback: the four Meta objects form a strict dependency chain (ad set
 * needs `campaign_id`, ad needs `adset_id` + `creative_id`), so a failure at
 * any stage after the campaign leaves 1-3 already-created PAUSED objects
 * behind. `createCampaignChain` best-effort deletes everything created so
 * far, in reverse (most-dependent-first) order, via `deleteResource` — same
 * "log, never throw" discipline as the rest of this client, because a
 * cleanup failure must never mask the ORIGINAL creation error being returned
 * to the caller. PAUSED orphans don't spend, but they are still an ops
 * hazard (stale noise in Ads Manager, confusing an operator reviewing
 * pending campaigns), so cleanup is attempted regardless.
 *
 * Plain server module (NOT `'use server'`) — exports types + async functions.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { isAdsEngineEnabled } from '@/config/growth-ads';
import { getPixelIdForProperty } from '@/lib/meta-pixels';
import { resolveAdContext } from './adContext';
import { createResource, deleteResource, type GraphResult } from './client';

const logger = loggers.ads;

// ---------------------------------------------------------------------------
// Stage specs
// ---------------------------------------------------------------------------

export interface CreateCampaignSpec {
  name: string;
}

export interface AdSetTargeting {
  /** Meta `targeting` object shape, e.g. `{ geo_locations: {...}, age_min, age_max }` — passed through as-is (validated shape: docs/meta-ads-infrastructure-2026.md §9). */
  [key: string]: unknown;
}

export interface CreateAdSetSpec {
  name: string;
  /** Daily budget in bani (minor units) — NEVER major-unit RON (plan §13 M3). */
  dailyBudgetMinor: number;
  /** The page the ad ultimately sends traffic to — used ONLY to derive `conversion_domain`; the actual click-through link is set on the creative. */
  landingUrl: string;
  targeting: AdSetTargeting;
}

export interface CreateCreativeSpec {
  name: string;
  /** Click-through link — should already carry `?utm_source=facebook&utm_campaign=<adCampaigns.id>` (Fable H1); this module does not append UTMs itself. */
  link: string;
  message: string;
  /** Image hash from `/act_<id>/adimages` — image upload is out of scope for Phase 1; caller supplies it. */
  imageHash: string;
  /** Defaults to 'LEARN_MORE', the only CTA verified against the live account (§9c). */
  callToActionType?: string;
}

export interface CreateAdSpec {
  name: string;
}

// ---------------------------------------------------------------------------
// Single-stage creators
// ---------------------------------------------------------------------------

/**
 * Create a PAUSED campaign. Payload matches the verified contract exactly
 * (§9c): `objective=OUTCOME_SALES`, `special_ad_categories=[]` (this
 * account's own history shows `[]` runs fine for direct-booking/travel ads —
 * Meta does not force HOUSING for vacation rentals), and
 * `is_adset_budget_sharing_enabled=false` (required when NOT using
 * campaign-level budgets — we use ad-set-level daily budgets, §9b).
 */
export async function createCampaign(
  propertyId: string,
  spec: CreateCampaignSpec
): Promise<GraphResult<{ id: string }>> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    logger.warn('createCampaign: no ad context for property — refusing to create', { propertyId });
    return { ok: false, error: 'no-ad-context' };
  }

  return createResource<{ id: string }>(
    'campaigns',
    ctx.adAccountId,
    ctx.token,
    {
      name: spec.name,
      objective: 'OUTCOME_SALES',
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    },
    propertyId
  );
}

/**
 * Derive the registrable domain Meta's `conversion_domain` field expects from
 * a landing page URL: the hostname with a leading "www." stripped.
 *
 * This is an eTLD+1 HEURISTIC, not a correct implementation: it is valid for
 * the single-level TLDs this system currently onboards properties on (e.g.
 * "prahova-chalet.ro", "www.prahova-chalet.ro" → both "prahova-chalet.ro").
 * It is NOT correct for multi-level public-suffix TLDs (e.g. "co.uk") — a
 * subdomain like "sub.example.co.uk" would incorrectly keep "sub" as part of
 * the registrable domain. A public-suffix-list lookup (e.g. the `psl`
 * package) would be required before onboarding a property on such a TLD.
 *
 * Returns `undefined` (never throws) on an unparseable `landingUrl` — e.g. a
 * scheme-less string like "prahova-chalet.ro". `new URL()` throws on those, and
 * an uncaught throw here would escape `createCampaignChain` and orphan an
 * already-created campaign with no rollback; the caller turns `undefined` into
 * a clean `{ok:false}` before any further Meta call instead.
 */
function deriveConversionDomain(landingUrl: string): string | undefined {
  let hostname: string;
  try {
    hostname = new URL(landingUrl).hostname;
  } catch {
    return undefined;
  }
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

/**
 * Create a PAUSED ad set under `campaignId`. Requires the property to have a
 * configured Meta Pixel (`getPixelIdForProperty` — multi-property config,
 * never hardcoded); returns `{ok:false,error:'no-pixel'}` without calling
 * Meta if none is configured, so a mis-onboarded property fails closed
 * instead of creating an ad set with no conversion tracking. Payload matches
 * the live-verified OFFSITE_CONVERSIONS/PURCHASE contract (§9b) — this was
 * the previously-unverified part of the chain and is now confirmed working.
 */
export async function createAdSet(
  propertyId: string,
  campaignId: string,
  spec: CreateAdSetSpec
): Promise<GraphResult<{ id: string }>> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    logger.warn('createAdSet: no ad context for property — refusing to create', { propertyId });
    return { ok: false, error: 'no-ad-context' };
  }

  const pixelId = await getPixelIdForProperty(propertyId);
  if (!pixelId) {
    logger.warn('createAdSet: no Meta Pixel configured for property — refusing to create', { propertyId });
    return { ok: false, error: 'no-pixel' };
  }

  const conversionDomain = deriveConversionDomain(spec.landingUrl);
  if (!conversionDomain) {
    logger.warn('createAdSet: landingUrl is not a parseable URL — refusing to create', {
      propertyId,
      landingUrl: spec.landingUrl,
    });
    return { ok: false, error: 'invalid-landing-url' };
  }

  return createResource<{ id: string }>(
    'adsets',
    ctx.adAccountId,
    ctx.token,
    {
      name: spec.name,
      campaign_id: campaignId,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      promoted_object: { pixel_id: pixelId, custom_event_type: 'PURCHASE' },
      daily_budget: spec.dailyBudgetMinor,
      conversion_domain: conversionDomain,
      targeting: spec.targeting,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    },
    propertyId
  );
}

/**
 * Create a PAUSED ad creative. Requires the property to have a configured
 * Meta Page (`ctx.pageId` — multi-property config); returns
 * `{ok:false,error:'no-page'}` without calling Meta if none is configured.
 * `object_story_spec` shape matches the live-verified contract exactly
 * (§9c) — `page_id` + `link_data` with `image_hash` (Phase 1 does not upload
 * images; the caller supplies an already-uploaded hash).
 */
export async function createCreative(
  propertyId: string,
  spec: CreateCreativeSpec
): Promise<GraphResult<{ id: string }>> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    logger.warn('createCreative: no ad context for property — refusing to create', { propertyId });
    return { ok: false, error: 'no-ad-context' };
  }
  if (!ctx.pageId) {
    logger.warn('createCreative: no Meta Page configured for property — refusing to create', { propertyId });
    return { ok: false, error: 'no-page' };
  }

  return createResource<{ id: string }>(
    'adcreatives',
    ctx.adAccountId,
    ctx.token,
    {
      name: spec.name,
      object_story_spec: {
        page_id: ctx.pageId,
        link_data: {
          link: spec.link,
          message: spec.message,
          image_hash: spec.imageHash,
          call_to_action: { type: spec.callToActionType ?? 'LEARN_MORE' },
        },
      },
    },
    propertyId
  );
}

/** Create a PAUSED ad under `adSetId`, wired to `creativeId`. Last link in the chain. */
export async function createAd(
  propertyId: string,
  adSetId: string,
  creativeId: string,
  spec: CreateAdSpec
): Promise<GraphResult<{ id: string }>> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    logger.warn('createAd: no ad context for property — refusing to create', { propertyId });
    return { ok: false, error: 'no-ad-context' };
  }

  return createResource<{ id: string }>(
    'ads',
    ctx.adAccountId,
    ctx.token,
    {
      name: spec.name,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
    },
    propertyId
  );
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface CreateCampaignChainSpec {
  campaign: CreateCampaignSpec;
  adSet: CreateAdSetSpec;
  creative: CreateCreativeSpec;
  ad: CreateAdSpec;
}

export type CreateCampaignChainStage = 'gate' | 'context' | 'campaign' | 'adSet' | 'creative' | 'ad' | 'firestore';

export interface CreateCampaignChainSuccess {
  ok: true;
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  /** Firestore `adCampaigns` doc id — what the approval UI/gateway keys off. */
  adCampaignId: string;
}

export interface CreateCampaignChainFailure {
  ok: false;
  error: string;
  /** Which stage failed — lets the caller/UI report precisely, and tells you how far rollback had to reach. */
  stage: CreateCampaignChainStage;
}

export type CreateCampaignChainResult = CreateCampaignChainSuccess | CreateCampaignChainFailure;

interface RollbackTarget {
  kind: 'campaign' | 'adSet' | 'creative' | 'ad';
  id: string;
}

/**
 * Best-effort delete of everything already created before a mid-chain
 * failure, in the order given by the caller (most-dependent-first). Never
 * throws — a rollback failure is logged and the loop continues, because the
 * function's job is "do as much cleanup as possible," not "guarantee full
 * cleanup." The ORIGINAL creation error is what the caller sees; this is
 * purely best-effort housekeeping on top of it.
 */
async function rollback(propertyId: string, token: string, targets: RollbackTarget[]): Promise<void> {
  for (const target of targets) {
    const result = await deleteResource(target.id, token, propertyId);
    if (result.ok) {
      logger.info('createCampaignChain: rollback delete succeeded', {
        propertyId,
        kind: target.kind,
        id: target.id,
      });
    } else {
      logger.warn('createCampaignChain: rollback delete failed (best-effort, continuing)', {
        propertyId,
        kind: target.kind,
        id: target.id,
        error: result.error,
      });
    }
  }
}

/**
 * Orchestrate the full chain: gate → context → campaign → ad set → creative
 * → ad → Firestore record. Order matches the live-verified dependency chain
 * (§9c). Stops and reports the failing `stage` on the first error; for any
 * stage after the campaign, best-effort rolls back everything created so far
 * (reverse order) before returning.
 *
 * The Firestore `adCampaigns` doc written on full success is DELIBERATELY
 * minimal: `status: 'draft'` and NO `spendCapMinor`. Those are set only by a
 * later human approval step (an admin UI action, not built in Phase 1) —
 * `adExecutionGateway.activateCampaign` refuses to activate any campaign that
 * isn't `status === 'approved'` with a positive `spendCapMinor` snapshotted
 * (H5/M3/M4). Setting either field here would make a freshly-created
 * campaign activatable straight out of creation, defeating that gate — never
 * do it, even by convenience/default.
 */
export async function createCampaignChain(
  propertyId: string,
  spec: CreateCampaignChainSpec
): Promise<CreateCampaignChainResult> {
  // (a) master-switch gate — creating PAUSED objects is zero-spend, so this
  // is the ONLY gate creation needs. Live mode (isAdsLiveAllowed) guards
  // ACTIVATION, handled entirely by adExecutionGateway — not here.
  if (!isAdsEngineEnabled()) {
    logger.info('createCampaignChain: ads engine disabled — no Meta calls made', { propertyId });
    return { ok: false, error: 'ads-engine-disabled', stage: 'gate' };
  }

  // (b) resolve context up front — needed both to short-circuit cleanly and
  // to have a token on hand for rollback deletes without re-resolving later.
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    logger.warn('createCampaignChain: no ad context for property — refusing to create', { propertyId });
    return { ok: false, error: 'no-ad-context', stage: 'context' };
  }

  // (c) campaign
  const campaignRes = await createCampaign(propertyId, spec.campaign);
  if (!campaignRes.ok) {
    logger.warn('createCampaignChain: campaign stage failed', { propertyId, error: campaignRes.error });
    return { ok: false, error: campaignRes.error, stage: 'campaign' };
  }
  const campaignId = campaignRes.data.id;

  // (d) ad set
  const adSetRes = await createAdSet(propertyId, campaignId, spec.adSet);
  if (!adSetRes.ok) {
    logger.warn('createCampaignChain: adSet stage failed — rolling back', { propertyId, error: adSetRes.error });
    await rollback(propertyId, ctx.token, [{ kind: 'campaign', id: campaignId }]);
    return { ok: false, error: adSetRes.error, stage: 'adSet' };
  }
  const adSetId = adSetRes.data.id;

  // (e) creative
  const creativeRes = await createCreative(propertyId, spec.creative);
  if (!creativeRes.ok) {
    logger.warn('createCampaignChain: creative stage failed — rolling back', {
      propertyId,
      error: creativeRes.error,
    });
    await rollback(propertyId, ctx.token, [
      { kind: 'adSet', id: adSetId },
      { kind: 'campaign', id: campaignId },
    ]);
    return { ok: false, error: creativeRes.error, stage: 'creative' };
  }
  const creativeId = creativeRes.data.id;

  // (f) ad
  const adRes = await createAd(propertyId, adSetId, creativeId, spec.ad);
  if (!adRes.ok) {
    logger.warn('createCampaignChain: ad stage failed — rolling back', { propertyId, error: adRes.error });
    await rollback(propertyId, ctx.token, [
      { kind: 'creative', id: creativeId },
      { kind: 'adSet', id: adSetId },
      { kind: 'campaign', id: campaignId },
    ]);
    return { ok: false, error: adRes.error, stage: 'ad' };
  }
  const adId = adRes.data.id;

  // (g) Firestore record — see the function-level doc comment for why
  // status/spendCapMinor are deliberately NOT set to anything activatable.
  try {
    const db = await getAdminDb();
    const ref = await db.collection('adCampaigns').add({
      propertyId,
      metaCampaignId: campaignId,
      metaAdSetIds: [adSetId],
      metaAdIds: [adId],
      objective: 'OUTCOME_SALES',
      dailyBudgetMinor: spec.adSet.dailyBudgetMinor,
      creativeRef: creativeId,
      status: 'draft',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('createCampaignChain: full chain created', {
      propertyId,
      campaignId,
      adSetId,
      creativeId,
      adId,
      adCampaignId: ref.id,
    });

    return { ok: true, campaignId, adSetId, creativeId, adId, adCampaignId: ref.id };
  } catch (error) {
    // The Meta-side chain is valid (PAUSED, zero spend) but unrecorded — an
    // unrecorded campaign is invisible to the approval workflow and can
    // never be activated (activateCampaign requires the adCampaigns doc), so
    // treat it the same as any other mid-chain failure: roll the whole thing
    // back rather than leave an orphan only discoverable in Ads Manager.
    logger.warn('createCampaignChain: Firestore write failed — rolling back full chain', {
      propertyId,
      error: String(error),
    });
    await rollback(propertyId, ctx.token, [
      { kind: 'ad', id: adId },
      { kind: 'creative', id: creativeId },
      { kind: 'adSet', id: adSetId },
      { kind: 'campaign', id: campaignId },
    ]);
    return { ok: false, error: String(error), stage: 'firestore' };
  }
}
