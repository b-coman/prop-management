'use server';

/**
 * Growth Ad Engine — operator console server actions (Phase 2a Build B).
 *
 * Mirrors `src/app/admin/campaigns/actions.ts`'s shape (super-admin gate →
 * try/catch → log → return a typed result) but wires to the Meta Ads Build A
 * backend (`adComposer`, `adExecutionGateway`, `metaAds/lifecycle`,
 * `metaAds/insights`) instead of the WhatsApp campaign service.
 *
 * MONEY-TOUCH DISCIPLINE (this file is the seam the Opus review targets):
 *  - `actor` is ALWAYS derived from `requireSuperAdmin()` (the authenticated
 *    session), NEVER from a client-supplied parameter (plan REVISIONS S4).
 *  - No cap/budget arithmetic lives here — `validateApprovalCap` (approve) and
 *    `validateDailyBudget` (compose, called inside `composeAndCreateAd`) own
 *    that policy; this file only calls them and surfaces their verdicts.
 *  - `activateAdAction` is a THIN wrapper over `adExecutionGateway.activateCampaign`
 *    — the gateway owns every activation gate (two-switch, approval,
 *    spend-cap, ownership, all-three-levels) AND the `status:'active'` write.
 *    This action adds no money logic, only doc lookups.
 *  - No `graph.facebook.com` calls happen here — every Meta call is reached
 *    through `adComposer`/`adExecutionGateway`/`metaAds/*`, which are this
 *    file's only "downstream" imports for anything Meta-shaped.
 *
 * `'use server'` files may only export async functions (never objects,
 * consts, or top-level types) — see CLAUDE.md; return-type shapes below are
 * expressed as inline object types on each function signature instead of
 * exported `interface`/`type` declarations.
 */

import { revalidatePath } from 'next/cache';
import { loggers } from '@/lib/logger';
import { requireSuperAdmin, handleAuthError, AuthorizationError } from '@/lib/authorization';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { serverTranslateContent } from '@/lib/server-language-utils';
import { getBaseUrl } from '@/lib/structured-data';
import { getMaxDailyBudgetMinor } from '@/config/growth-ads';
import type { AdCampaign, AdCampaignStatus, ComposeAndCreateAdInput, CopyVariant, PropertyImage } from '@/types';
import { composeAndCreateAd, validateApprovalCap, validateDailyBudget, type ComposeAndCreateAdResult } from '@/services/growth/adComposer';
import { activateCampaign, type ActivateResult } from '@/services/growth/adExecutionGateway';
import { pauseCampaign, type PauseResult } from '@/services/growth/metaAds/lifecycle';
import { getInsights, getEffectiveStatus } from '@/services/growth/metaAds/insights';
import { resolveAdContext } from '@/services/growth/metaAds/adContext';
import { searchCities, type CityMatch } from '@/services/growth/metaAds/geo';
import { deleteResource } from '@/services/growth/metaAds/client';
import { planAndCreative } from '@/services/growth/adProposal';
import { buildGenerationPrompt } from '@/lib/growth/generationPrompt';
import type { AdOpportunity } from '@/lib/growth/contracts';

const logger = loggers.ads;

// ---------------------------------------------------------------------------
// Shared helpers (not exported — this is a `'use server'` file)
// ---------------------------------------------------------------------------

/** Resolve the authenticated super-admin and a stable actor string for audit trails. Throws `AuthorizationError` if not authorized. */
async function requireActor(): Promise<string> {
  const user = await requireSuperAdmin();
  return user.email || user.uid;
}

/** Meta returns `account_id` without the `act_` prefix; Ads Manager URLs also want it bare. */
function normalizeAccountId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return id.startsWith('act_') ? id.slice(4) : id;
}

/** Best-effort Ads Manager deep link — never blocks the console if the account id can't be resolved. */
function buildAdsManagerUrl(adAccountId: string | undefined, metaCampaignId: string | undefined): string | undefined {
  if (!metaCampaignId) return undefined;
  const act = normalizeAccountId(adAccountId);
  const params = new URLSearchParams({ selected_campaign_ids: metaCampaignId });
  if (act) params.set('act', act);
  return `https://www.facebook.com/adsmanager/manage/campaigns?${params.toString()}`;
}

interface AdCampaignDocData {
  propertyId?: string;
  metaCampaignId?: string;
  metaAdSetIds?: string[];
  metaAdIds?: string[];
  objective?: string;
  dailyBudgetMinor?: number;
  endTime?: string | null;
  spendCapMinor?: number;
  status?: AdCampaignStatus;
  effectiveStatus?: string;
  creativeRef?: string;
  approvedBy?: string;
}

// ---------------------------------------------------------------------------
// Reads (list / detail / compose-form data)
// ---------------------------------------------------------------------------

/** List `adCampaigns` for a property, newest first. Empty array (not a thrown error) on auth failure — mirrors `campaigns/actions.ts:fetchCampaigns`. */
export async function fetchAdCampaignsAction(propertyId: string): Promise<Array<AdCampaign>> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return [];
    throw error;
  }
  try {
    const db = await getAdminDb();
    const snap = await db
      .collection('adCampaigns')
      .where('propertyId', '==', propertyId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => convertTimestampsToISOStrings({ id: d.id, ...d.data() }) as AdCampaign);
  } catch (error) {
    logger.error('fetchAdCampaignsAction failed', error as Error, { propertyId });
    return [];
  }
}

/** Single `adCampaigns` doc, plus a best-effort Ads Manager deep link (account id resolved server-side; the Meta access token never leaves this module). Null on not-found or auth failure. */
export async function fetchAdCampaignAction(
  adCampaignId: string
): Promise<(AdCampaign & { adsManagerUrl?: string }) | null> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
  try {
    const db = await getAdminDb();
    const snap = await db.collection('adCampaigns').doc(adCampaignId).get();
    if (!snap.exists) return null;
    const data = snap.data() as AdCampaignDocData;

    let adsManagerUrl: string | undefined;
    if (data.propertyId) {
      const ctx = await resolveAdContext(data.propertyId);
      adsManagerUrl = buildAdsManagerUrl(ctx?.adAccountId, data.metaCampaignId);
    }

    return {
      ...(convertTimestampsToISOStrings({ id: snap.id, ...data }) as AdCampaign),
      adsManagerUrl,
    };
  } catch (error) {
    logger.error('fetchAdCampaignAction failed', error as Error, { adCampaignId });
    return null;
  }
}

/** Data the compose form needs: the property's gallery images (storagePath-present, owned by this property), the canonical-domain landing URL default (S8), and the server's max-daily-budget ceiling (UX display only — B2's real enforcement lives in `adComposer.validateDailyBudget`). Null on auth failure or missing property. */
export async function fetchComposeDataAction(propertyId: string): Promise<{
  propertyId: string;
  images: Array<{ storagePath: string; url: string; alt: string; thumbnailUrl?: string }>;
  defaultLandingUrl: string;
  maxDailyBudgetMinor: number;
} | null> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
  try {
    const db = await getAdminDb();
    const doc = await db.collection('properties').doc(propertyId).get();
    if (!doc.exists) return null;
    const data = doc.data() as { images?: PropertyImage[]; customDomain?: string | null };

    const ownPrefix = `properties/${propertyId}/`;
    const images = (data.images ?? [])
      .filter((img): img is PropertyImage & { storagePath: string } =>
        // Archived photos stay in the library as edit sources but must not be
        // offered here: a superseded original competing with the edit that
        // fixed it is exactly how the selector picks the weaker one.
        Boolean(img.storagePath && img.storagePath.startsWith(ownPrefix) && !img.archived)
      )
      .map((img) => ({
        storagePath: img.storagePath,
        url: img.url,
        // alt may be bilingual; the picker preview needs a plain string.
        alt: serverTranslateContent(img.alt, 'en'),
        thumbnailUrl: img.thumbnailUrl,
      }));

    // P4: default the ad destination to this property's most-recent PUBLISHED landing page (/lp), so a
    // manually-composed ad lands on a campaign page instead of the generic home. Owner can override in
    // the form. Filtered in memory (no composite index needed); falls back to the property home.
    const origin = getBaseUrl(data.customDomain);
    const lpSnap = await db.collection('landingPages').where('propertyId', '==', propertyId).get();
    const publishedLanding = lpSnap.docs
      .map((d) => ({ slug: d.id, ...(d.data() as { status?: string; defaultLanguage?: string; updatedAt?: { _seconds?: number } }) }))
      .filter((l) => l.status === 'published')
      .sort((a, b) => (b.updatedAt?._seconds ?? 0) - (a.updatedAt?._seconds ?? 0))[0];
    const defaultLandingUrl = publishedLanding
      ? `${origin.replace(/\/+$/, '')}/lp/${publishedLanding.slug}/${publishedLanding.defaultLanguage || 'ro'}`
      : origin;

    return {
      propertyId,
      images,
      defaultLandingUrl,
      maxDailyBudgetMinor: getMaxDailyBudgetMinor(),
    };
  } catch (error) {
    logger.error('fetchComposeDataAction failed', error as Error, { propertyId });
    return null;
  }
}

/**
 * City typeahead search backing the compose form's city picker (Phase 2b
 * Build B). Super-admin gated like every other action here; read-only (no
 * money-touch, no Firestore write) so it gets the lightweight
 * `[]`-on-any-failure contract rather than a typed error union — an
 * autocomplete field must degrade to "no results," never surface a toast on
 * every keystroke.
 */
export async function searchCitiesAction(propertyId: string, query: string): Promise<CityMatch[]> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return [];
    throw error;
  }
  const result = await searchCities(propertyId, query);
  if (!result.ok) {
    logger.warn('searchCitiesAction: searchCities failed', { propertyId, query, error: result.error });
    return [];
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Money-touch actions
// ---------------------------------------------------------------------------

/**
 * Compose a neutral ad request into a full PAUSED Meta chain (draft, zero
 * spend). Super-admin gate; actor resolved from the session (S4) — NOT
 * accepted as an input field, and never forwarded anywhere (`composeAndCreateAd`
 * itself doesn't take an actor; the session check IS the provenance control
 * here, same discipline the plan describes for the compose step).
 *
 * No money logic here: `MAX_DAILY_BUDGET_MINOR` enforcement lives inside
 * `composeAndCreateAd` (`validateDailyBudget`) — this action only gates auth
 * and surfaces whatever `composeAndCreateAd` returns, verbatim.
 */
export async function composeAdAction(input: ComposeAndCreateAdInput): Promise<ComposeAndCreateAdResult> {
  let actor: string;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: handleAuthError(error).error, stage: 'gate' };
    }
    throw error;
  }

  logger.info('composeAdAction: composing', { actor, propertyId: input.propertyId });
  const result = await composeAndCreateAd(input);
  if (result.ok) {
    // The manual form creates the Meta chain directly (no Firestore-only draft stage), so the doc is
    // already ON Meta (PAUSED) — mark it 'pushed' so it enters the same approve/Go-live gates.
    try {
      const db = await getAdminDb();
      await db.collection('adCampaigns').doc(result.adCampaignId).update({ status: 'pushed', pushedBy: actor, updatedAt: FieldValue.serverTimestamp() });
    } catch (e) {
      logger.warn('composeAdAction: could not mark pushed (non-fatal)', { adCampaignId: result.adCampaignId, error: (e as Error).message });
    }
    logger.info('composeAdAction: composed draft (on Meta, PAUSED)', { actor, adCampaignId: result.adCampaignId });
    revalidatePath('/admin/ads');
  } else {
    logger.warn('composeAdAction: compose failed', { actor, propertyId: input.propertyId, stage: result.stage, error: result.error });
  }
  return result;
}

/**
 * Approve a draft ad campaign — the state machine + spend-bound gate (plan
 * REVISIONS S3/B2). Super-admin gate; actor from session (S4).
 *
 *  1. Require `status === 'pushed'` — the ad must already exist on Meta (PAUSED)
 *     before a spend cap can be approved; anything else is rejected with
 *     `not-pushed:<status>`. (A Firestore-only `draft` must be Pushed first.)
 *  2. `validateApprovalCap` — the ONLY place spend-cap arithmetic runs; this
 *     action never re-derives or duplicates that math, it only surfaces the
 *     policy's verdict.
 *  3. On ok: `status:'approved'`, `spendCapMinor`, an `approvalSnapshot`
 *     (dailyBudgetMinor + spendCapMinor + creativeRef + server `at`),
 *     `approvedBy: actor`, `updatedAt`.
 */
export async function approveAdAction(
  adCampaignId: string,
  spendCapMinor: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  let actor: string;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    throw error;
  }

  try {
    const db = await getAdminDb();
    const ref = db.collection('adCampaigns').doc(adCampaignId);
    const snap = await ref.get();
    if (!snap.exists) {
      return { ok: false, error: 'not-found' };
    }
    const doc = snap.data() as AdCampaignDocData;

    if (doc.status !== 'pushed') {
      return { ok: false, error: `not-pushed:${doc.status ?? 'unknown'} (push the draft to Meta before approving)` };
    }

    const dailyBudgetMinor = doc.dailyBudgetMinor ?? 0;
    const capCheck = validateApprovalCap({
      dailyBudgetMinor,
      spendCapMinor,
      endTime: doc.endTime ?? '',
    });
    if (!capCheck.ok) {
      logger.warn('approveAdAction: rejected by validateApprovalCap', {
        actor,
        adCampaignId,
        reason: capCheck.reason,
      });
      return { ok: false, error: capCheck.reason };
    }

    await ref.update({
      status: 'approved',
      spendCapMinor,
      approvalSnapshot: {
        dailyBudgetMinor,
        spendCapMinor,
        creativeRef: doc.creativeRef ?? null,
        at: FieldValue.serverTimestamp(),
      },
      approvedBy: actor,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('approveAdAction: approved', { actor, adCampaignId, spendCapMinor });
    revalidatePath('/admin/ads');
    revalidatePath(`/admin/ads/${adCampaignId}`);
    return { ok: true };
  } catch (error) {
    logger.error('approveAdAction failed', error as Error, { adCampaignId });
    return { ok: false, error: 'internal-error' };
  }
}

/**
 * Activate an approved ad campaign — a THIN wrapper. Super-admin gate; actor
 * from session (S4), passed to the gateway (never a client-supplied value).
 * Every money gate (two-switch dry-run, approval + spend-cap, ownership,
 * activate-all-three-levels) AND the `status:'active'` write live in
 * `adExecutionGateway.activateCampaign` — this action does nothing but look up
 * `propertyId`/`metaCampaignId` and return the gateway's result verbatim.
 */
export async function activateAdAction(adCampaignId: string): Promise<ActivateResult> {
  let actor: string;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { status: 'rejected', reason: handleAuthError(error).error };
    }
    throw error;
  }

  try {
    const db = await getAdminDb();
    const snap = await db.collection('adCampaigns').doc(adCampaignId).get();
    if (!snap.exists) return { status: 'rejected', reason: 'not-found' };
    const doc = snap.data() as AdCampaignDocData;
    if (!doc.propertyId || !doc.metaCampaignId) {
      return { status: 'rejected', reason: 'doc-missing-propertyId-or-metaCampaignId' };
    }

    const result = await activateCampaign(doc.propertyId, doc.metaCampaignId, { actor });
    revalidatePath('/admin/ads');
    revalidatePath(`/admin/ads/${adCampaignId}`);
    return result;
  } catch (error) {
    logger.error('activateAdAction failed', error as Error, { adCampaignId });
    return { status: 'rejected', reason: 'internal-error' };
  }
}

/** Pause a campaign (STOP primitive — ungated by the two-switch on purpose, mirrors `lifecycle.pauseCampaign`'s own "always available" design). Super-admin gate; on success also flips `adCampaigns.status='paused'` (console must not lie about state, S2). */
export async function pauseAdAction(adCampaignId: string): Promise<PauseResult> {
  let actor: string;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, campaignId: adCampaignId, error: handleAuthError(error).error };
    }
    throw error;
  }

  try {
    const db = await getAdminDb();
    const ref = db.collection('adCampaigns').doc(adCampaignId);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, campaignId: adCampaignId, error: 'not-found' };
    const doc = snap.data() as AdCampaignDocData;
    if (!doc.propertyId || !doc.metaCampaignId) {
      return { success: false, campaignId: adCampaignId, error: 'doc-missing-propertyId-or-metaCampaignId' };
    }

    const result = await pauseCampaign(doc.propertyId, doc.metaCampaignId);
    if (result.success) {
      await ref.update({ status: 'paused', updatedAt: FieldValue.serverTimestamp() });
      logger.info('pauseAdAction: paused', { actor, adCampaignId });
    } else {
      logger.warn('pauseAdAction: pauseCampaign failed', { actor, adCampaignId, error: result.error });
    }
    revalidatePath('/admin/ads');
    revalidatePath(`/admin/ads/${adCampaignId}`);
    return result;
  } catch (error) {
    logger.error('pauseAdAction failed', error as Error, { adCampaignId });
    return { success: false, campaignId: adCampaignId, error: 'internal-error' };
  }
}

/** Read-only ROAS + `effective_status` refresh (plan REVISIONS OD4 — on-demand drift/REJECTED detection in lieu of a 2a reconciliation cron). Writes `insights` + `lastSyncedAt` (+ `effectiveStatus` when the read-back succeeds) onto the doc. */
export async function refreshAdInsightsAction(adCampaignId: string): Promise<
  | { ok: true; insights: { spend: number; impressions: number; clicks: number; bookings: number; roas: number }; effectiveStatus?: string }
  | { ok: false; error: string }
> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    throw error;
  }

  try {
    const db = await getAdminDb();
    const ref = db.collection('adCampaigns').doc(adCampaignId);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: 'not-found' };
    const doc = snap.data() as AdCampaignDocData;
    if (!doc.propertyId || !doc.metaCampaignId) {
      return { ok: false, error: 'doc-missing-propertyId-or-metaCampaignId' };
    }

    const insightsResult = await getInsights(doc.propertyId, doc.metaCampaignId);
    if (!insightsResult.ok) {
      logger.warn('refreshAdInsightsAction: getInsights failed', { adCampaignId, error: insightsResult.error });
      return { ok: false, error: insightsResult.error };
    }

    // Best-effort — a failed effective_status read-back must not block the
    // (successful) insights refresh from being saved (same "never let a
    // secondary read-back flip a primary success" discipline as the gateway's
    // own post-activation read-back).
    const effectiveStatusResult = await getEffectiveStatus(doc.propertyId, doc.metaCampaignId);
    const effectiveStatus = effectiveStatusResult.ok ? effectiveStatusResult.data.effectiveStatus : undefined;
    if (!effectiveStatusResult.ok) {
      logger.warn('refreshAdInsightsAction: getEffectiveStatus failed (non-fatal)', {
        adCampaignId,
        error: effectiveStatusResult.error,
      });
    }

    const insights = {
      spend: insightsResult.data.spend,
      impressions: insightsResult.data.impressions,
      clicks: insightsResult.data.clicks,
      bookings: insightsResult.data.purchases,
      roas: insightsResult.data.roas,
    };

    await ref.update({
      insights,
      lastSyncedAt: FieldValue.serverTimestamp(),
      ...(effectiveStatus ? { effectiveStatus } : {}),
    });

    revalidatePath('/admin/ads');
    revalidatePath(`/admin/ads/${adCampaignId}`);
    return { ok: true, insights, effectiveStatus };
  } catch (error) {
    logger.error('refreshAdInsightsAction failed', error as Error, { adCampaignId });
    return { ok: false, error: 'internal-error' };
  }
}

// ---------------------------------------------------------------------------
// Opportunity-Engine: generate a PAUSED ad DRAFT from a window (framing → generate)
// ---------------------------------------------------------------------------

/**
 * Generate an AI ad proposal for an opportunity window and land it as a PAUSED, reviewable draft
 * (promotion-system-architecture.md §4.2). Super-admin gate; the whole intelligence chain runs in
 * `proposeAd` (plan → creative → composeAndCreateAd, zero spend). On a created draft we ALSO persist
 * a `proposal` blob (copy + photo URLs + cities + rationale) onto the doc so the detail page can
 * review it in-console. A planner DECLINE is a valid, non-error outcome (no draft). No money logic
 * here — spend cap + activation stay the existing approve/activate gates.
 */
export async function generateAdProposalAction(input: {
  propertyId: string;
  start: string;
  end: string;
  occasion?: string;
  valueAtRisk?: number;
  goal?: string;
  audience?: string;
}): Promise<
  | { ok: true; adCampaignId: string }
  | { ok: true; declined: true; rationale: string }
  | { ok: false; error: string; stage?: string }
> {
  let actor: string;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    throw error;
  }

  try {
    const nights = Math.max(1, Math.round((Date.parse(input.end) - Date.parse(input.start)) / 86400000));
    const daysOut = Math.max(0, Math.round((Date.parse(input.start) - Date.now()) / 86400000));
    const opportunity: AdOpportunity = {
      id: `oe-${input.propertyId}-${input.start}-${input.end}`,
      propertyId: input.propertyId,
      source: 'gap',
      window: { start: input.start, end: input.end, nights },
      daysOut,
      occasion: input.occasion?.trim()
        ? { name: input.occasion.trim(), type: 'ad-hoc', startDate: input.start, endDate: input.end }
        : null,
      valueAtRisk: input.valueAtRisk ?? null,
      instrument: 'ads',
      rationale: 'operator-initiated (console)',
    };

    const framing = { goal: input.goal?.trim() || undefined, audience: input.audience?.trim() || undefined };
    logger.info('generateAdProposalAction: generating', { actor, propertyId: input.propertyId, window: `${input.start}..${input.end}` });

    // Intelligence only — plan + creative, ZERO Meta footprint. Nothing reaches Meta until Push.
    const res = await planAndCreative(opportunity, { framing });

    if (!res.ok) return { ok: false, error: res.errors.join('; ') || 'proposal-failed', stage: res.stage };
    if (res.declined || !res.brief || !res.creative || !res.composeInput) {
      return { ok: true, declined: true, rationale: res.brief?.rationale ?? 'The planner declined to run an ad for this window.' };
    }

    // Resolve photo URLs from the property gallery for the reviewable proposal blob.
    const db = await getAdminDb();
    const propDoc = await db.collection('properties').doc(input.propertyId).get();
    const images = (propDoc.data()?.images ?? []) as PropertyImage[];
    const urlByPath = new Map(images.filter((i) => i.storagePath).map((i) => [i.storagePath!, i.thumbnailUrl || i.url]));
    const descByPath = new Map(images.filter((i) => i.storagePath).map((i) => [i.storagePath!, i.aiDescription?.summary ?? '']));
    const photos = res.creative.assetPaths.map((storagePath) => ({ storagePath, url: urlByPath.get(storagePath) ?? '' }));
    // Missing-shot gaps the copywriter declared → each with a ready generation prompt (manual-gen v1).
    const assetGaps = (res.creative.assetGaps ?? []).map((g) => ({
      need: g.need,
      nearestAssetPath: g.nearestAssetPath,
      nearestAssetUrl: urlByPath.get(g.nearestAssetPath) ?? '',
      whyInsufficient: g.whyInsufficient,
      transform: g.transform,
      generationPrompt: buildGenerationPrompt(g.transform, g.need, descByPath.get(g.nearestAssetPath) ?? ''),
    }));

    // Create a Firestore-ONLY draft (status 'draft', no metaCampaignId). `composeInput` is the neutral
    // request that `pushAdToMetaAction` will replay verbatim (with any operator edits) to build the
    // real PAUSED Meta chain. Top-level dailyBudgetMinor/endTime/objective mirror it for display + the
    // later approve cap-check.
    const ref = db.collection('adCampaigns').doc();
    await ref.set({
      propertyId: input.propertyId,
      status: 'draft',
      objective: res.composeInput.objective,
      dailyBudgetMinor: res.composeInput.dailyBudgetMinor,
      endTime: res.composeInput.endTime,
      composeInput: res.composeInput,
      proposal: {
        source: 'opportunity-engine',
        occasion: {
          name: res.brief.opportunity.occasion?.name ?? null,
          start: res.brief.opportunity.window.start,
          end: res.brief.opportunity.window.end,
          nights: res.brief.opportunity.window.nights,
        },
        goal: framing.goal ?? null,
        audience: framing.audience ?? null,
        copy: res.creative.copy,
        photos,
        cities: res.brief.targeting.cities.map((c) => ({ name: c.name, radius: c.radius })),
        creativeBrief: res.brief.creativeBrief,
        rationale: res.brief.rationale,
        assetGaps,
      },
      createdBy: actor,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('generateAdProposalAction: Firestore-only draft created (no Meta)', { actor, adCampaignId: ref.id });
    revalidatePath('/admin/ads');
    return { ok: true, adCampaignId: ref.id };
  } catch (error) {
    logger.error('generateAdProposalAction failed', error as Error, { propertyId: input.propertyId });
    return { ok: false, error: 'internal-error' };
  }
}

/**
 * Edit a Firestore draft before it is pushed to Meta (operator review + adjust). v1 covers copy text
 * + daily budget; photo/geo edits are a follow-up. Keeps `proposal` (what the console shows) and
 * `composeInput` (what push replays) in sync, so the ad that reaches Meta is exactly what was reviewed.
 * Super-admin gate; only a `draft` (no Meta objects yet) can be edited.
 */
export async function updateAdDraftAction(
  adCampaignId: string,
  patch: { copy?: CopyVariant[]; dailyBudgetMinor?: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  let actor: string;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    throw error;
  }

  try {
    const db = await getAdminDb();
    const ref = db.collection('adCampaigns').doc(adCampaignId);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: 'not-found' };
    const doc = snap.data() as AdCampaignDocData & { composeInput?: ComposeAndCreateAdInput };
    if (doc.status !== 'draft') return { ok: false, error: `not-draft:${doc.status ?? 'unknown'}` };
    const composeInput = doc.composeInput;
    if (!composeInput) return { ok: false, error: 'draft-missing-composeInput' };

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    let nextComposeInput = composeInput;

    if (patch.copy) {
      const clean = patch.copy.filter((c) => c && (c.headline?.trim() || c.primary?.trim()));
      if (clean.length === 0) return { ok: false, error: 'copy-empty' };
      nextComposeInput = { ...nextComposeInput, copy: clean };
      update['proposal.copy'] = clean;
    }
    if (typeof patch.dailyBudgetMinor === 'number') {
      const budgetCheck = validateDailyBudget(patch.dailyBudgetMinor);
      if (!budgetCheck.ok) return { ok: false, error: budgetCheck.reason };
      nextComposeInput = { ...nextComposeInput, dailyBudgetMinor: patch.dailyBudgetMinor };
      update['dailyBudgetMinor'] = patch.dailyBudgetMinor;
    }

    update['composeInput'] = nextComposeInput;
    await ref.update(update);
    logger.info('updateAdDraftAction: draft edited', { actor, adCampaignId, fields: Object.keys(patch) });
    revalidatePath('/admin/ads');
    revalidatePath(`/admin/ads/${adCampaignId}`);
    return { ok: true };
  } catch (error) {
    logger.error('updateAdDraftAction failed', error as Error, { adCampaignId });
    return { ok: false, error: 'internal-error' };
  }
}

/**
 * Push a reviewed Firestore draft to Meta — the FIRST moment anything is created on Meta. Builds the
 * real PAUSED Meta chain (zero spend) from the draft's `composeInput` (carrying any operator edits),
 * carries the reviewed proposal onto the composed doc, and removes the Firestore-only draft. Meta runs
 * its policy review at THIS point (the "your ad was approved" email is expected here, by the operator's
 * choice — never at generate). Spend stays gated behind the separate Go-live (approve + activate).
 * Super-admin gate; requires status 'draft'. The composed doc gets a NEW id (returned to the caller).
 */
export async function pushAdToMetaAction(
  adCampaignId: string
): Promise<{ ok: true; adCampaignId: string } | { ok: false; error: string; stage?: string }> {
  let actor: string;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    throw error;
  }

  try {
    const db = await getAdminDb();
    const ref = db.collection('adCampaigns').doc(adCampaignId);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: 'not-found' };
    const doc = snap.data() as AdCampaignDocData & { composeInput?: ComposeAndCreateAdInput; proposal?: unknown };
    if (doc.status !== 'draft') return { ok: false, error: `not-draft:${doc.status ?? 'unknown'}` };
    if (!doc.composeInput) return { ok: false, error: 'draft-missing-composeInput' };

    // P4: if a PUBLISHED landing page targets this campaign, point the ad at its /lp page instead of the
    // property home. composeInput.landingBaseUrl is the origin; append /lp/{slug}/{lang}. Resolved against
    // the draft id — the composed doc gets a NEW id below, so the landing's campaignRef is re-pointed after.
    const composeInput: ComposeAndCreateAdInput = { ...doc.composeInput };
    const lpSnap = await db.collection('landingPages').where('campaignRef', '==', adCampaignId).get();
    const landing = lpSnap.docs
      .map((d) => ({ slug: d.id, ...(d.data() as { status?: string; defaultLanguage?: string; updatedAt?: { _seconds?: number } }) }))
      .filter((l) => l.status === 'published')
      .sort((a, b) => (b.updatedAt?._seconds ?? 0) - (a.updatedAt?._seconds ?? 0))[0];
    if (landing) {
      const origin = String(composeInput.landingBaseUrl || getBaseUrl(null)).replace(/\/+$/, '');
      composeInput.landingBaseUrl = `${origin}/lp/${landing.slug}/${landing.defaultLanguage || 'ro'}`;
      logger.info('pushAdToMetaAction: pointing ad at landing page', { adCampaignId, landing: landing.slug, url: composeInput.landingBaseUrl });
    }

    // Create the real (PAUSED) Meta chain — this is what makes Meta policy-review the creative.
    const compose = await composeAndCreateAd(composeInput);
    if (!compose.ok) {
      logger.warn('pushAdToMetaAction: compose failed', { actor, adCampaignId, stage: compose.stage, error: compose.error });
      // Leave the draft intact so the operator can fix + retry; surface the last error in the console.
      await ref.update({ lastPushError: `${compose.stage}:${compose.error}`, updatedAt: FieldValue.serverTimestamp() });
      return { ok: false, error: compose.error, stage: compose.stage };
    }

    // Carry the reviewed proposal onto the freshly composed doc, mark 'pushed', then remove the
    // Firestore-only draft (its content now lives on the composed doc under a new id).
    await db.collection('adCampaigns').doc(compose.adCampaignId).update({
      proposal: doc.proposal ?? null,
      status: 'pushed',
      pushedBy: actor,
      pushedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Keep the landing↔campaign link alive across the id change on push (draft id → composed id).
    if (!lpSnap.empty) {
      const batch = db.batch();
      lpSnap.docs.forEach((d) => batch.update(d.ref, { campaignRef: compose.adCampaignId, updatedAt: FieldValue.serverTimestamp() }));
      await batch.commit();
    }
    await ref.delete();

    logger.info('pushAdToMetaAction: pushed to Meta (PAUSED, zero spend)', { actor, from: adCampaignId, adCampaignId: compose.adCampaignId });
    revalidatePath('/admin/ads');
    revalidatePath(`/admin/ads/${compose.adCampaignId}`);
    return { ok: true, adCampaignId: compose.adCampaignId };
  } catch (error) {
    logger.error('pushAdToMetaAction failed', error as Error, { adCampaignId });
    return { ok: false, error: 'internal-error' };
  }
}

/**
 * Discard a draft ad — delete its Meta chain (ad set + campaign cascade the ad; creative is
 * account-level) and the Firestore doc. Only a `draft` (Firestore-only, nothing on Meta to delete),
 * `pushed` (PAUSED on Meta), or `failed` campaign may be discarded (never an approved/active one —
 * pause that first). Super-admin gate. A Dynamic-Creative ad can't be deleted directly (Meta err
 * 100/1340029), so we delete the ad set + campaign (which cascade the ad) + the creative.
 */
export async function discardAdDraftAction(adCampaignId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let actor: string;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    throw error;
  }

  try {
    const db = await getAdminDb();
    const ref = db.collection('adCampaigns').doc(adCampaignId);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: 'not-found' };
    const doc = snap.data() as AdCampaignDocData;
    if (doc.status !== 'draft' && doc.status !== 'pushed' && doc.status !== 'failed') {
      return { ok: false, error: `cannot-discard:${doc.status ?? 'unknown'} (pause an active/approved ad first)` };
    }

    // Best-effort delete of the Meta objects (never blocks the doc removal).
    if (doc.propertyId && doc.metaCampaignId) {
      const ctx = await resolveAdContext(doc.propertyId);
      if (ctx) {
        const ids = [...(doc.metaAdSetIds ?? []), doc.metaCampaignId, ...(doc.creativeRef ? [doc.creativeRef] : [])];
        for (const id of ids) {
          const del = await deleteResource(id, ctx.token, doc.propertyId);
          if (!del.ok) logger.warn('discardAdDraftAction: Meta delete failed (continuing)', { adCampaignId, id, error: del.error });
        }
      }
    }

    await ref.delete();
    logger.info('discardAdDraftAction: discarded', { actor, adCampaignId });
    revalidatePath('/admin/ads');
    return { ok: true };
  } catch (error) {
    logger.error('discardAdDraftAction failed', error as Error, { adCampaignId });
    return { ok: false, error: 'internal-error' };
  }
}
