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
import { getBaseUrl } from '@/lib/structured-data';
import { getMaxDailyBudgetMinor } from '@/config/growth-ads';
import type { AdCampaign, AdCampaignStatus, ComposeAndCreateAdInput, PropertyImage } from '@/types';
import { composeAndCreateAd, validateApprovalCap, type ComposeAndCreateAdResult } from '@/services/growth/adComposer';
import { activateCampaign, type ActivateResult } from '@/services/growth/adExecutionGateway';
import { pauseCampaign, type PauseResult } from '@/services/growth/metaAds/lifecycle';
import { getInsights, getEffectiveStatus } from '@/services/growth/metaAds/insights';
import { resolveAdContext } from '@/services/growth/metaAds/adContext';
import { searchCities, type CityMatch } from '@/services/growth/metaAds/geo';

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
        Boolean(img.storagePath && img.storagePath.startsWith(ownPrefix))
      )
      .map((img) => ({
        storagePath: img.storagePath,
        url: img.url,
        alt: img.alt || '',
        thumbnailUrl: img.thumbnailUrl,
      }));

    return {
      propertyId,
      images,
      defaultLandingUrl: getBaseUrl(data.customDomain),
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
    logger.info('composeAdAction: composed draft', { actor, adCampaignId: result.adCampaignId });
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
 *  1. Require `status === 'draft'` — approving anything else (already
 *     approved/active/paused) is rejected with `not-draft:<status>`.
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

    if (doc.status !== 'draft') {
      return { ok: false, error: `not-draft:${doc.status ?? 'unknown'}` };
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
