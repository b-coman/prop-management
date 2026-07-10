/**
 * adComposer — the platform-NEUTRAL compose boundary (Phase 2a Build A, plan
 * "The seam" + REVISIONS §4/S1/S7/B2/B5/OD6).
 *
 * ```
 * admin/ads (console UI, Build B)  ──►  adComposer (NEUTRAL, this file)  ──►  metaAds/* (Meta ADAPTER)
 * ```
 *
 * `composeAndCreateAd` is the ONLY place a neutral compose request turns into
 * a Meta-shaped one. Nothing Meta-specific (Graph field names, Meta enum
 * values, `object_story_spec`) may appear in this file's PUBLIC surface — the
 * input/output types live in `@/types` (`ComposeAndCreateAdInput`,
 * `AdObjective`, `AdCallToAction`, `CopyVariant`) and are deliberately generic
 * so a future TikTok adapter could implement the same neutral contract without
 * this file changing. The neutral→Meta MAPPING (objective/CTA enums) is
 * private to this module — it's the one place allowed to know both vocabularies.
 *
 * This module also owns the MONEY POLICY that isn't platform-specific (Fable
 * OD6: "keep approve/activate POLICY — cap arithmetic, MAX budget — in the
 * neutral layer; only the un-pause MECHANICS are adapter"):
 *  - `validateDailyBudget` — the server-side `MAX_DAILY_BUDGET_MINOR` ceiling
 *    (B2), enforced here at compose time. Build B's approve action should
 *    call the same exported policy helpers rather than re-implement them.
 *  - `validateApprovalCap` — the approve-time spend-bound invariant (B2):
 *    `dailyBudgetMinor × ceil(daysToEndTime) × 1.25 ≤ spendCapMinor`. NOT
 *    called by `composeAndCreateAd` itself (there is no spend cap yet at
 *    compose time — that's set at approval, Build B); exported for Build B's
 *    `approveCampaign` action to call.
 *
 * `composeAndCreateAd` NEVER touches Firestore for the `adCampaigns` doc
 * itself (B5) — it only ALLOCATES the id (a pure client-side id generation,
 * no network write) so it can embed `utm_campaign=<id>` into the creative's
 * link BEFORE the creative is created, then hands the pre-allocated id to
 * `createCampaignChain`, which remains the ONE writer of that doc.
 *
 * `actor` (who composed this ad) is NOT a parameter here — Build B's server
 * action must derive it from the authenticated session (`requireSuperAdmin()`
 * or equivalent), never from a client-supplied value (plan REVISIONS S4).
 * This module doesn't record an actor at all; `adCampaigns.createdAt` +
 * Firebase/Next.js server-action auth logs are the provenance trail for the
 * compose step, and `adExecutionGateway`'s audit log covers activate.
 *
 * Plain server module (NOT `'use server'`) — exports types + async functions.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { isAdsEngineEnabled, getMaxDailyBudgetMinor } from '@/config/growth-ads';
import type { AdCallToAction, AdObjective, ComposeAndCreateAdInput } from '@/types';
import { uploadImageToAccount } from './metaAds/adImages';
import { createCampaignChain, type CreateCampaignChainSpec } from './metaAds/campaignBuilder';

const logger = loggers.ads;

// ---------------------------------------------------------------------------
// Neutral → Meta mapping (private to this module — the one place allowed to
// know both vocabularies, S1/S6).
// ---------------------------------------------------------------------------

/** `'sales'` is 2a's only neutral objective; maps to Meta's OUTCOME_SALES (live-verified, §9c). */
const OBJECTIVE_TO_META: Record<AdObjective, string> = {
  sales: 'OUTCOME_SALES',
};

/**
 * Only `learn_more` is LIVE-VERIFIED against this account (§9c — it's
 * `createCreative`'s own default). `book_now`/`contact_us` map to Meta's
 * documented CTA type constants but have NOT been spike-tested against this
 * specific ad account — verify before relying on them in production (S6).
 */
const CTA_TO_META: Record<AdCallToAction, string> = {
  learn_more: 'LEARN_MORE',
  book_now: 'BOOK_TRAVEL',
  contact_us: 'CONTACT_US',
};

// ---------------------------------------------------------------------------
// Neutral money policy (Fable OD6 — lives here, not in the Meta adapter).
// ---------------------------------------------------------------------------

export type PolicyResult = { ok: true } | { ok: false; reason: string };

/**
 * Server-side hard ceiling on daily ad spend (`MAX_DAILY_BUDGET_MINOR`, B2).
 * A compose form's own "max budget" field is UX only — THIS is the actual
 * gate, and Build B's approve action should re-check it too (form limits are
 * never a security boundary).
 */
export function validateDailyBudget(dailyBudgetMinor: number): PolicyResult {
  if (!Number.isFinite(dailyBudgetMinor) || dailyBudgetMinor <= 0) {
    return { ok: false, reason: 'invalid-daily-budget' };
  }
  const max = getMaxDailyBudgetMinor();
  if (dailyBudgetMinor > max) {
    return { ok: false, reason: `daily-budget-exceeds-max:${dailyBudgetMinor}>${max}` };
  }
  return { ok: true };
}

export interface ValidateApprovalCapInput {
  dailyBudgetMinor: number;
  spendCapMinor: number;
  /** ISO 8601 — the adset's `end_time`. */
  endTime: string;
}

/**
 * Over-delivery margin applied to the naive `dailyBudget × days` projection
 * (B2). Meta's EXACT over-delivery behavior is unverified against this
 * account — 1.25x is a deliberately conservative buffer, not a measured
 * figure; revisit once real delivery data exists.
 */
const OVER_DELIVERY_MARGIN = 1.25;

/**
 * The approve-time invariant that makes `spendCapMinor` mean something (B2):
 * `dailyBudgetMinor × ceil(daysToEndTime) × 1.25 ≤ spendCapMinor`. Exported
 * for Build B's `approveCampaign` action — NOT called by `composeAndCreateAd`
 * (there is no spend cap to check yet at compose time; the cap is set at
 * approval).
 */
export function validateApprovalCap(input: ValidateApprovalCapInput): PolicyResult {
  if (!Number.isFinite(input.dailyBudgetMinor) || input.dailyBudgetMinor <= 0) {
    return { ok: false, reason: 'invalid-daily-budget' };
  }
  if (!Number.isFinite(input.spendCapMinor) || input.spendCapMinor <= 0) {
    return { ok: false, reason: 'invalid-spend-cap' };
  }
  const endTimeMs = Date.parse(input.endTime);
  if (Number.isNaN(endTimeMs)) {
    return { ok: false, reason: 'invalid-end-time' };
  }
  const daysToEndTime = Math.ceil((endTimeMs - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysToEndTime <= 0) {
    return { ok: false, reason: 'end-time-not-in-future' };
  }
  const projectedSpendMinor = input.dailyBudgetMinor * daysToEndTime * OVER_DELIVERY_MARGIN;
  if (projectedSpendMinor > input.spendCapMinor) {
    return { ok: false, reason: `spend-cap-too-low:projected=${projectedSpendMinor}>cap=${input.spendCapMinor}` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// composeAndCreateAd
// ---------------------------------------------------------------------------

export type ComposeAndCreateAdStage = 'gate' | 'validation' | 'upload' | 'chain';

export interface ComposeAndCreateAdSuccess {
  ok: true;
  adCampaignId: string;
  metaCampaignId: string;
  metaAdSetId: string;
  metaAdId: string;
  creativeId: string;
}

export interface ComposeAndCreateAdFailure {
  ok: false;
  error: string;
  stage: ComposeAndCreateAdStage;
}

export type ComposeAndCreateAdResult = ComposeAndCreateAdSuccess | ComposeAndCreateAdFailure;

/**
 * Compose a neutral ad request into a full PAUSED Meta chain (draft, zero
 * spend). Steps (plan §4):
 *  1. Master-switch gate (`isAdsEngineEnabled`) — same discipline as
 *     `createCampaignChain`'s own gate; checked here too so a disabled engine
 *     fails BEFORE any Storage/Meta call, not just before the Firestore write.
 *  2. `MAX_DAILY_BUDGET_MINOR` policy (B2).
 *  3. Asset ownership assert — `assetRef.storagePath` MUST live under
 *     `properties/${propertyId}/` (S7) — refuses to upload/attribute spend to
 *     an image from a DIFFERENT property's gallery.
 *  4. Allocate the `adCampaigns` doc id (no Firestore WRITE, B5) and build the
 *     `utm_campaign=<id>` link — the ROAS join key (H1).
 *  5. `uploadImageToAccount` — resolves (or reuses, cache-first) the Meta
 *     `image_hash`.
 *  6. Map neutral → Meta (objective, CTA, copy[0]) and call
 *     `createCampaignChain` with the pre-allocated id — IT is the one writer
 *     of the `adCampaigns` doc.
 *
 * Never throws — every stage returns a typed failure with a `stage` tag so a
 * caller/UI can report precisely where composition stopped.
 */
export async function composeAndCreateAd(input: ComposeAndCreateAdInput): Promise<ComposeAndCreateAdResult> {
  // (1) master-switch gate.
  if (!isAdsEngineEnabled()) {
    logger.info('composeAndCreateAd: ads engine disabled — refusing to compose', { propertyId: input.propertyId });
    return { ok: false, error: 'ads-engine-disabled', stage: 'gate' };
  }

  // (2) MAX_DAILY_BUDGET_MINOR policy (B2) — server-side, not just the form.
  const budgetCheck = validateDailyBudget(input.dailyBudgetMinor);
  if (!budgetCheck.ok) {
    logger.warn('composeAndCreateAd: daily budget rejected by policy', {
      propertyId: input.propertyId,
      dailyBudgetMinor: input.dailyBudgetMinor,
      reason: budgetCheck.reason,
    });
    return { ok: false, error: budgetCheck.reason, stage: 'validation' };
  }

  // (3) asset ownership assert (S7) — the asset picker in Build B's console
  // should already filter to this property's own gallery, but a client is
  // untrusted input; refuse server-side regardless of what the form sent.
  if (input.assetRef.kind !== 'gallery') {
    return { ok: false, error: `unsupported-asset-kind:${input.assetRef.kind}`, stage: 'validation' };
  }
  const expectedStoragePrefix = `properties/${input.propertyId}/`;
  if (!input.assetRef.storagePath.startsWith(expectedStoragePrefix)) {
    logger.warn('composeAndCreateAd: assetRef.storagePath does not belong to propertyId — refusing', {
      propertyId: input.propertyId,
      storagePath: input.assetRef.storagePath,
    });
    return { ok: false, error: 'asset-ownership-mismatch', stage: 'validation' };
  }

  // (3b) required-field sanity (TypeScript enforces this at compile time for
  // in-repo callers; a server action deserializing an external request is not
  // compile-time-checked, so verify at runtime too).
  if (!input.endTime || Number.isNaN(Date.parse(input.endTime))) {
    return { ok: false, error: 'invalid-end-time', stage: 'validation' };
  }
  if (!input.copy?.length) {
    return { ok: false, error: 'no-copy-variant', stage: 'validation' };
  }
  const copy = input.copy[0];
  const metaCta = CTA_TO_META[copy.cta];
  if (!metaCta) {
    return { ok: false, error: `unknown-cta:${copy.cta}`, stage: 'validation' };
  }
  const metaObjective = OBJECTIVE_TO_META[input.objective];
  if (!metaObjective) {
    return { ok: false, error: `unknown-objective:${input.objective}`, stage: 'validation' };
  }

  // (4) allocate the doc id — NO Firestore write, just id generation (B5) —
  // so `utm_campaign` can be embedded in the link before the creative exists.
  let adCampaignId: string;
  try {
    const db = await getAdminDb();
    adCampaignId = db.collection('adCampaigns').doc().id;
  } catch (error) {
    logger.warn('composeAndCreateAd: failed to allocate adCampaignId', {
      propertyId: input.propertyId,
      error: String(error),
    });
    return { ok: false, error: 'id-allocation-failed', stage: 'chain' };
  }

  // Build the UTM link via the URL API so a landingBaseUrl that ALREADY carries
  // a query string doesn't produce a malformed `...?a=b?utm_...` link (which
  // would break the landing page and the ROAS attribution). Also validates the
  // URL up front.
  let link: string;
  try {
    const u = new URL(input.landingBaseUrl);
    u.searchParams.set('utm_source', 'facebook');
    u.searchParams.set('utm_medium', 'paid');
    u.searchParams.set('utm_campaign', adCampaignId);
    link = u.toString();
  } catch {
    return { ok: false, error: 'invalid-landing-url', stage: 'validation' };
  }

  // (5) resolve the Meta image_hash (cache-first, per-account dedup).
  const uploaded = await uploadImageToAccount(input.propertyId, {
    storagePath: input.assetRef.storagePath,
    contentHash: input.assetRef.contentHash,
  });
  if (!uploaded.ok) {
    logger.warn('composeAndCreateAd: image upload failed', {
      propertyId: input.propertyId,
      adCampaignId,
      error: uploaded.error,
    });
    return { ok: false, error: `upload-failed:${uploaded.error}`, stage: 'upload' };
  }

  // (6) map neutral → Meta and delegate the whole chain (incl. the ONE
  // Firestore write) to createCampaignChain.
  const chainSpec: CreateCampaignChainSpec = {
    campaign: {
      name: `${input.propertyId} — ${adCampaignId}`,
      objective: metaObjective,
    },
    adSet: {
      name: `${input.propertyId} — ${adCampaignId} — ad set`,
      dailyBudgetMinor: input.dailyBudgetMinor,
      landingUrl: input.landingBaseUrl,
      targeting: {
        geo_locations: { countries: input.targeting.countries },
        age_min: input.targeting.ageMin,
        age_max: input.targeting.ageMax,
      },
      endTime: input.endTime,
    },
    creative: {
      name: `${input.propertyId} — ${adCampaignId} — creative`,
      link,
      message: copy.primary,
      headline: copy.headline,
      imageHash: uploaded.data.imageHash,
      callToActionType: metaCta,
    },
    ad: { name: `${input.propertyId} — ${adCampaignId} — ad` },
  };

  const chainResult = await createCampaignChain(input.propertyId, chainSpec, adCampaignId);
  if (!chainResult.ok) {
    logger.warn('composeAndCreateAd: chain creation failed', {
      propertyId: input.propertyId,
      adCampaignId,
      chainStage: chainResult.stage,
      error: chainResult.error,
    });
    return { ok: false, error: `${chainResult.stage}:${chainResult.error}`, stage: 'chain' };
  }

  logger.info('composeAndCreateAd: created draft ad chain', {
    propertyId: input.propertyId,
    adCampaignId: chainResult.adCampaignId,
  });

  return {
    ok: true,
    adCampaignId: chainResult.adCampaignId,
    metaCampaignId: chainResult.campaignId,
    metaAdSetId: chainResult.adSetId,
    metaAdId: chainResult.adId,
    creativeId: chainResult.creativeId,
  };
}
