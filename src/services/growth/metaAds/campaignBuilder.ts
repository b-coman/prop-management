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
import { createResource, deleteResource, type GraphParamValue, type GraphResult } from './client';

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
  /**
   * Meta `targeting` object shape — passed through as-is (validated shape:
   * docs/meta-ads-infrastructure-2026.md §9/§9f). The caller (`adComposer`)
   * builds this Meta-shaped object; `createAdSet` only injects the
   * `targeting_automation` default (below) on top of it. Phase-2b shape:
   * `{ geo_locations: { cities:[{key,radius,distance_unit:'kilometer'}], location_types:['home','recent'] } }`
   * (city targeting) OR `{ geo_locations: { countries:[...] } }` (2a's
   * whole-country fallback, still supported — §9c). NO `age_min`/`age_max` on
   * the default `advantage_audience:1` path (§9f: Advantage+ Audience owns
   * demographics and rejects a hard age range outright).
   */
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
  /**
   * Phase 2b (§9f): true when the paired creative is a Dynamic Creative
   * (`asset_feed_spec` — 2+ images or 2+ copy variants) — injects
   * `is_dynamic_creative:true` into the create payload. REQUIRED whenever the
   * creative is dynamic: attaching a Dynamic-Creative ad to a NON-dynamic ad
   * set fails with err 100/1885998 "Cannot Create Dynamic Creative ad In
   * Non-Dynamic Creative Ad Set" — `createCampaignChain` computes this once
   * and threads the SAME value to both `createAdSet` and `createCreative` so
   * the two can never disagree. Omitted (not sent to Meta at all) when falsy —
   * matches the single-image path's byte-for-byte pre-2b payload.
   */
  isDynamic?: boolean;
}

/** One copy variant for a creative — `link_data.message`/`.name` on the single-image path, one entry of `asset_feed_spec.bodies[]`/`titles[]` on the Dynamic Creative path. */
export interface CreativeCopyVariant {
  primary: string;
  headline?: string;
}

export interface CreateCreativeSpec {
  name: string;
  /** Click-through link — should already carry `?utm_source=facebook&utm_campaign=<adCampaigns.id>` (Fable H1); this module does not append UTMs itself. Used as `link_data.link` (single-image) or every `asset_feed_spec.link_urls[].website_url` (dynamic — one link, §9f's verified shape has a single `link_urls` entry regardless of image count). */
  link: string;
  /**
   * Image hash(es) from `/act_<id>/adimages` (`metaAds/adImages.uploadImageToAccount`,
   * plan REVISIONS B4). Exactly 1 element ⇒ single-image `object_story_spec.link_data`
   * path (§9c/§9d, unchanged payload shape). 2+ elements ⇒ Dynamic Creative
   * `asset_feed_spec.images[]` path (§9f).
   */
  imageHashes: string[];
  /** Copy variant(s). Exactly 1 ⇒ single-image path (`.message`/`.name`). 2+ (or paired with 2+ `imageHashes`) ⇒ Dynamic Creative `bodies[]`/`titles[]`. */
  copy: CreativeCopyVariant[];
  /** Defaults to 'LEARN_MORE', the only CTA verified against the live account (§9c). Sent as `link_data.call_to_action.type` (single) or the sole entry of `asset_feed_spec.call_to_action_types[]` (dynamic) — §9f's verified spike only exercised a ONE-element CTA array, so this module does not (yet) support per-variant CTAs in the dynamic path. */
  callToActionType?: string;
  /**
   * Phase 2b (§9f): true ⇒ build `asset_feed_spec` with NO `link_data` on
   * `object_story_spec` (the two are mutually exclusive on this endpoint).
   * MUST match the paired ad set's `is_dynamic_creative` (see
   * `CreateAdSetSpec.isDynamic`'s doc comment — err 100/1885998 otherwise).
   * When omitted, derived as `imageHashes.length > 1 || copy.length > 1` — a
   * direct (non-chain) caller gets a sane default; `createCampaignChain`
   * always sets this explicitly so it can never diverge from the ad set's flag.
   */
  isDynamic?: boolean;
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
  // targeting — verified live in the Phase-2a compose test (the §9b/c spikes
  // used geo-only, so they didn't hit it). DEFAULT flipped 0→1 in Phase 2b
  // (§9f, KEY design fact): `advantage_audience:1` = Meta's Advantage+
  // Audience OWNS demographics — it is our system's baked default (best
  // cold-start; no hard age/gender/interests in this system, GEO + copy
  // qualify instead) and, per §9f, is INCOMPATIBLE with a hard `age_min`/
  // `age_max` (err 100/1870188-9) — so `adComposer` never sends age fields on
  // this default path. A caller that sets its own `targeting_automation`
  // (e.g. an explicit `advantage_audience:0` escape hatch, which MAY then
  // carry age/gender/interests) overrides this default via the spread below.
  const targeting = {
    targeting_automation: { advantage_audience: 1 },
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
      // §9f gotcha (err 100/1885998): a Dynamic-Creative ad REQUIRES its ad
      // set to carry this flag — omitted (not merely `false`) on the normal
      // single-image path so the payload matches the pre-2b shape exactly.
      ...(spec.isDynamic ? { is_dynamic_creative: true } : {}),
    },
    propertyId
  );
}

/**
 * Create a PAUSED ad creative. Requires the property to have a configured
 * Meta Page (`ctx.pageId` — multi-property config); returns
 * `{ok:false,error:'no-page'}` without calling Meta if none is configured.
 * Two payload shapes, chosen by `isDynamic` (`spec.isDynamic`, or derived —
 * see `CreateCreativeSpec.isDynamic`'s doc comment):
 *
 *  - **Single-image** (`imageHashes.length===1 && copy.length===1`): the
 *    original `object_story_spec.link_data` shape (§9c), extended with three
 *    fields verified in the Phase-2a spike (§9d) — `instagram_user_id`
 *    (`ctx.instagramActorId`, when configured — WITHOUT it the ad is FB-only,
 *    plan REVISIONS S5), `link_data.use_flexible_image_aspect_ratio:true`
 *    (always on — lets Meta auto-fit the one photo per placement), and
 *    `link_data.name` (the headline, only when supplied — S6: unverified
 *    whether it renders on every placement). BYTE-FOR-BYTE unchanged from
 *    pre-2b for this path.
 *  - **Dynamic Creative** (2+ images or 2+ copy variants, §9f): NO
 *    `link_data` on `object_story_spec` — the two are mutually exclusive on
 *    this endpoint — plus a sibling `asset_feed_spec` carrying every image
 *    hash, every copy variant's body/title, the (single) link and CTA, and
 *    `ad_formats:['AUTOMATIC_FORMAT']` so Meta mixes assets and picks per
 *    placement. `titles[]` falls back to a variant's body text when it has no
 *    explicit headline, so this array is NEVER empty (Meta's `titles[]` is a
 *    required sibling of `bodies[]`, unlike the optional `descriptions[]`,
 *    which this module does not send — no neutral field maps to it). The
 *    PAIRED ad set MUST carry `is_dynamic_creative:true` or Meta rejects this
 *    ad with err 100/1885998 — `createCampaignChain` is the module that keeps
 *    the two in sync; a direct caller of this function is responsible for that
 *    itself.
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
  if (!spec.imageHashes.length) {
    logger.warn('createCreative: no image hashes supplied — refusing to create', { propertyId });
    return { ok: false, error: 'no-image-hashes' };
  }
  if (!spec.copy.length) {
    logger.warn('createCreative: no copy variants supplied — refusing to create', { propertyId });
    return { ok: false, error: 'no-copy-variants' };
  }

  const isDynamic = spec.isDynamic ?? (spec.imageHashes.length > 1 || spec.copy.length > 1);
  const callToActionType = spec.callToActionType ?? 'LEARN_MORE';

  const objectStorySpec: Record<string, unknown> = {
    page_id: ctx.pageId,
    ...(ctx.instagramActorId ? { instagram_user_id: ctx.instagramActorId } : {}),
  };

  const payload: Record<string, GraphParamValue> = { name: spec.name };

  if (isDynamic) {
    // Meta rejects DUPLICATE values within an asset_feed_spec array (err
    // 100/1815809 "Duplicate of ad asset values are not allowed") — e.g. two
    // copy variants sharing one headline. Dedup each array by value; a single
    // shared title alongside multiple distinct bodies is a valid shape (§9f).
    const uniqueByText = (items: Array<{ text: string }>): Array<{ text: string }> => {
      const seen = new Set<string>();
      return items.filter(({ text }) => (seen.has(text) ? false : (seen.add(text), true)));
    };
    const uniqueHashes = [...new Set(spec.imageHashes)];

    payload.object_story_spec = objectStorySpec; // NO link_data (§9f — mutually exclusive with asset_feed_spec)
    payload.asset_feed_spec = {
      images: uniqueHashes.map((hash) => ({ hash })),
      bodies: uniqueByText(spec.copy.map((c) => ({ text: c.primary }))),
      // Required sibling of bodies[] — fall back to the body text itself when a
      // variant has no explicit headline (never empty). Deduped: shared/repeated
      // headlines collapse to a single title (§9f err 1815809).
      titles: uniqueByText(spec.copy.map((c) => ({ text: c.headline ?? c.primary }))),
      link_urls: [{ website_url: spec.link }],
      call_to_action_types: [callToActionType],
      ad_formats: ['AUTOMATIC_FORMAT'],
    };
  } else {
    payload.object_story_spec = {
      ...objectStorySpec,
      link_data: {
        link: spec.link,
        message: spec.copy[0].primary,
        image_hash: spec.imageHashes[0],
        call_to_action: { type: callToActionType },
        use_flexible_image_aspect_ratio: true,
        ...(spec.copy[0].headline ? { name: spec.copy[0].headline } : {}),
      },
    };
  }

  return createResource<{ id: string }>('adcreatives', ctx.adAccountId, ctx.token, payload, propertyId);
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
 *
 * Phase 2b (§9f): this function is the SINGLE place `isDynamic` gets computed
 * — `spec.creative.imageHashes.length > 1 || spec.creative.copy.length > 1` —
 * and it is threaded, identically, into BOTH `createAdSet` (→
 * `is_dynamic_creative`) and `createCreative` (→ `asset_feed_spec` vs
 * `object_story_spec.link_data`). Any `isDynamic` the caller set on the
 * nested `spec.adSet`/`spec.creative` is overridden here — this is the ONE
 * enforcement point that keeps the ad set's flag and the creative's payload
 * shape from ever disagreeing (§9f's err 100/1885998 gotcha), the same
 * "single enforcement point" discipline `client.ts`'s PAUSED injection uses.
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

  // Computed ONCE, threaded to both stages below (§9f) — see doc comment.
  const isDynamic = spec.creative.imageHashes.length > 1 || spec.creative.copy.length > 1;

  // (c) campaign
  const campaignRes = await createCampaign(propertyId, spec.campaign);
  if (!campaignRes.ok) {
    logger.warn('createCampaignChain: campaign stage failed', { propertyId, error: campaignRes.error });
    return { ok: false, error: campaignRes.error, stage: 'campaign' };
  }
  const campaignId = campaignRes.data.id;

  // (d) ad set
  const adSetRes = await createAdSet(propertyId, campaignId, { ...spec.adSet, isDynamic });
  if (!adSetRes.ok) {
    logger.warn('createCampaignChain: adSet stage failed — rolling back', { propertyId, error: adSetRes.error });
    await rollback(propertyId, ctx.token, [{ kind: 'campaign', id: campaignId }]);
    return { ok: false, error: adSetRes.error, stage: 'adSet' };
  }
  const adSetId = adSetRes.data.id;

  // (e) creative
  const creativeRes = await createCreative(propertyId, { ...spec.creative, isDynamic });
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
      // Phase 2b (§9f) — record which/how-many image hashes this creative was
      // built from, so the console can show "3 photos, dynamic" without a
      // Meta read-back. `assetHashes` doubles as an audit trail (same image
      // reused across ads is visible directly on the doc).
      assetHashes: spec.creative.imageHashes,
      imageCount: spec.creative.imageHashes.length,
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
