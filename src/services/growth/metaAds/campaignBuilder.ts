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
  /**
   * Meta objective string, e.g. `'OUTCOME_SALES'` — defaults to `'OUTCOME_SALES'`
   * (2a's only supported objective). This module is the Meta ADAPTER, so this
   * field is deliberately Meta-shaped; the neutral→Meta mapping (`'sales'` →
   * `'OUTCOME_SALES'`) happens one layer up, in `adComposer` (plan REVISIONS S1)
   * — nothing neutral should leak down here, and nothing Meta-shaped should leak
   * up there.
   */
  objective?: string;
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
  /**
   * ISO 8601 — bounds the ad set's run; verified accepted alongside
   * `daily_budget` (docs/meta-ads-infrastructure-2026.md §9d). REQUIRED by
   * policy in 2a (plan REVISIONS B2 — Meta's campaign-level spend-cap floor is
   * 500 RON, too high to bound a small first test, so `end_time` + daily
   * budget are the real spend bound instead). Optional at THIS layer because
   * this module is the low-level Meta adapter, not the policy owner — the
   * requiredness is enforced by `adComposer`'s input type (Fable OD6).
   */
  endTime?: string;
  startTime?: string;
}

export interface CreateCreativeSpec {
  name: string;
  /** Click-through link — should already carry `?utm_source=facebook&utm_campaign=<adCampaigns.id>` (Fable H1); this module does not append UTMs itself. */
  link: string;
  message: string;
  /** Image hash from `/act_<id>/adimages` (`metaAds/adImages.uploadImageToAccount`, plan REVISIONS B4). */
  imageHash: string;
  /** Defaults to 'LEARN_MORE', the only CTA verified against the live account (§9c). */
  callToActionType?: string;
  /** `link_data.name` — the ad's headline. Verified accepted + read back correctly (§9d); optional (S6: be ready to drop it from the form if it turns out not to render everywhere). */
  headline?: string;
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
      objective: spec.objective ?? 'OUTCOME_SALES',
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

  // Meta REQUIRES an explicit Advantage+ audience opt-in/out (error 100/1870227
  // "Advantage Audience Flag Required") whenever the ad set carries audience
  // targeting (age/interests) — verified live in the Phase-2a compose test (the
  // §9b/c spikes used geo-only, so they didn't hit it). Default `advantage_audience:0`
  // = respect our EXACT targeting (no Meta audience expansion); a caller that
  // sets its own `targeting_automation` overrides it. (docs …§9e)
  const targeting = {
    targeting_automation: { advantage_audience: 0 },
    ...spec.targeting,
  };

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
      targeting,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      ...(spec.startTime ? { start_time: spec.startTime } : {}),
      ...(spec.endTime ? { end_time: spec.endTime } : {}),
    },
    propertyId
  );
}

/**
 * Create a PAUSED ad creative. Requires the property to have a configured
 * Meta Page (`ctx.pageId` — multi-property config); returns
 * `{ok:false,error:'no-page'}` without calling Meta if none is configured.
 * `object_story_spec` shape matches the live-verified contract (§9c), extended
 * with three fields verified in the Phase-2a spike (§9d):
 *  - `instagram_user_id` (`ctx.instagramActorId`, when the property has one
 *    configured) — WITHOUT it the ad is FB-only; Meta's IG placements need it
 *    (plan REVISIONS S5).
 *  - `link_data.use_flexible_image_aspect_ratio: true` — always on; lets Meta
 *    auto-fit the single supplied image to each placement's aspect ratio
 *    (2a ships one photo, no per-placement crops yet — plan §2 "Non-goals").
 *  - `link_data.name` — the headline, only when the caller supplies one (S6:
 *    unverified whether it renders on every placement; keep it optional so a
 *    2a form can drop it without a code change).
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
        ...(ctx.instagramActorId ? { instagram_user_id: ctx.instagramActorId } : {}),
        link_data: {
          link: spec.link,
          message: spec.message,
          image_hash: spec.imageHash,
          call_to_action: { type: spec.callToActionType ?? 'LEARN_MORE' },
          use_flexible_image_aspect_ratio: true,
          ...(spec.headline ? { name: spec.headline } : {}),
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
 *
 * `adCampaignId` (plan REVISIONS B5, optional, backward-compatible): when the
 * caller (`adComposer`) has PRE-ALLOCATED a Firestore doc id (so it can embed
 * `utm_campaign=<id>` into the creative's link BEFORE this chain runs), pass
 * it here — the Firestore write uses `.doc(adCampaignId).create()` instead of
 * `.add()`. `.create()` (not `.set()`) is deliberate: a retry/double-submit of
 * the SAME pre-allocated id becomes a detectable `ALREADY_EXISTS` error
 * instead of silently overwriting or creating a second doc for one Meta
 * chain (S11). `createCampaignChain` remains the ONLY writer of this doc
 * either way (B5) — `adComposer` never touches Firestore directly. Omitting
 * `adCampaignId` keeps the original `.add()` behavior exactly (the Phase-1
 * validation harness and existing tests rely on this).
 */
export async function createCampaignChain(
  propertyId: string,
  spec: CreateCampaignChainSpec,
  adCampaignId?: string
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
    const docData = {
      propertyId,
      metaCampaignId: campaignId,
      metaAdSetIds: [adSetId],
      metaAdIds: [adId],
      objective: spec.campaign.objective ?? 'OUTCOME_SALES',
      dailyBudgetMinor: spec.adSet.dailyBudgetMinor,
      // Persist the ad set's end_time so the approve step can run the spend-cap
      // arithmetic (dailyBudget × days × margin ≤ cap) without a Meta read-back.
      endTime: spec.adSet.endTime ?? null,
      creativeRef: creativeId,
      status: 'draft',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    let resolvedAdCampaignId: string;
    if (adCampaignId) {
      // Pre-allocated id (B5) — `.create()` so a double-submit is a detectable
      // already-exists error, never a silent overwrite/duplicate.
      await db.collection('adCampaigns').doc(adCampaignId).create(docData);
      resolvedAdCampaignId = adCampaignId;
    } else {
      const ref = await db.collection('adCampaigns').add(docData);
      resolvedAdCampaignId = ref.id;
    }

    logger.info('createCampaignChain: full chain created', {
      propertyId,
      campaignId,
      adSetId,
      creativeId,
      adId,
      adCampaignId: resolvedAdCampaignId,
    });

    return { ok: true, campaignId, adSetId, creativeId, adId, adCampaignId: resolvedAdCampaignId };
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
