/**
 * Read-only ROAS/spend insights for a Meta ad object — Phase 1 (plan §9).
 *
 * Purely a GET + parse: no `createResource`, no PAUSED enforcement, no
 * dark-launch gate — reading spend data can never spend money, so the only
 * precondition is a resolved ad context (an unconfigured property has
 * nothing to read). This is the data source the admin UI / reconciliation
 * cron (Phase 2) will use to mirror `AdCampaign.insights` and
 * `effectiveStatus`.
 *
 * Plain server module (NOT `'use server'`) — exports types + async functions.
 */
import { loggers } from '@/lib/logger';
import { resolveAdContext } from './adContext';
import { metaGraph, type GraphResult } from './client';

const logger = loggers.ads;

export interface GetInsightsOptions {
  /** Meta `date_preset` — defaults to 'maximum' (the object's full lifetime). */
  datePreset?: string;
}

export interface AdInsights {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
}

interface MetaActionItem {
  action_type: string;
  value: string;
}

interface MetaInsightsRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: MetaActionItem[];
  action_values?: MetaActionItem[];
  purchase_roas?: { value: string }[];
}

interface MetaInsightsResponse {
  data: MetaInsightsRow[];
}

/**
 * A Pixel-tracked purchase is reported under `offsite_conversion.fb_pixel_purchase`
 * AND, on most accounts, ALSO mirrored under the unified `purchase` action_type
 * — they describe the SAME web conversions, so SUMMING them double-counts (a
 * well-known Ads Insights gotcha). We therefore PICK one by priority, never sum:
 * prefer the pixel-specific type (it is exactly the event our ad set optimizes
 * on — `promoted_object.custom_event_type=PURCHASE`), and fall back to the
 * unified `purchase` only when the pixel type is absent. For our pixel-only,
 * web-only direct-booking setup the two are effectively identical; this ordering
 * should be re-validated once live conversion data exists (Phase 2).
 */
const PURCHASE_ACTION_TYPES_BY_PRIORITY = ['offsite_conversion.fb_pixel_purchase', 'purchase'];

/** Value of the highest-priority purchase-like action present (0 if none) — never sums overlapping types. */
function pickPurchaseActionValue(actions: MetaActionItem[] | undefined): number {
  if (!actions) return 0;
  for (const type of PURCHASE_ACTION_TYPES_BY_PRIORITY) {
    const match = actions.find((action) => action.action_type === type);
    if (match) return Number(match.value) || 0;
  }
  return 0;
}

/**
 * Fetch and parse spend/ROAS insights for a Meta object (campaign, ad set, or
 * ad — Meta's insights edge works the same way on all three). Never throws;
 * a resolution or Graph API failure surfaces as `{ok:false,error}`, same
 * discipline as the rest of this client.
 */
export async function getInsights(
  propertyId: string,
  objectId: string,
  opts?: GetInsightsOptions
): Promise<GraphResult<AdInsights>> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    logger.warn('getInsights: no ad context for property', { propertyId, objectId });
    return { ok: false, error: 'no-ad-context' };
  }

  const result = await metaGraph<MetaInsightsResponse>(`${objectId}/insights`, {
    method: 'GET',
    params: {
      fields: 'spend,impressions,clicks,actions,action_values,purchase_roas',
      date_preset: opts?.datePreset ?? 'maximum',
    },
    token: ctx.token,
    propertyId,
  });
  if (!result.ok) return result;

  // An object with no delivery yet (e.g. still PAUSED, never activated)
  // legitimately returns an empty `data` array — treat as all-zero, not an error.
  const row = result.data.data?.[0];
  const spend = Number(row?.spend) || 0;
  const impressions = Number(row?.impressions) || 0;
  const clicks = Number(row?.clicks) || 0;
  const purchases = pickPurchaseActionValue(row?.actions);
  const purchaseValue = pickPurchaseActionValue(row?.action_values);

  // Prefer Meta's own purchase_roas (accounts for its attribution window);
  // fall back to a naive purchaseValue/spend only when Meta didn't report one.
  const metaRoasEntry = row?.purchase_roas?.[0];
  const roas = metaRoasEntry ? Number(metaRoasEntry.value) || 0 : spend > 0 ? purchaseValue / spend : 0;

  return { ok: true, data: { spend, impressions, clicks, purchases, purchaseValue, roas } };
}

interface MetaEffectiveStatusReadBack {
  id: string;
  effective_status?: string;
}

/**
 * Read-only `effective_status` look-up for a single Meta object (campaign, ad
 * set, or ad) — Phase 2a Build B (plan REVISIONS OD4: "on-demand `effective_status`
 * read-back in the console detail view", in lieu of a reconciliation cron in
 * 2a). Exists so the admin console can detect drift/REJECTED/WITH_ISSUES on a
 * manual "Refresh insights" click without any caller reaching into
 * `metaGraph`/`graph.facebook.com` directly — this file (and the rest of
 * `metaAds/*`) stays the ONLY place that does. Purely a GET, same
 * no-precondition-but-a-resolved-context discipline as `getInsights`. Never
 * throws.
 */
export async function getEffectiveStatus(
  propertyId: string,
  objectId: string
): Promise<GraphResult<{ effectiveStatus: string }>> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    logger.warn('getEffectiveStatus: no ad context for property', { propertyId, objectId });
    return { ok: false, error: 'no-ad-context' };
  }

  const result = await metaGraph<MetaEffectiveStatusReadBack>(objectId, {
    method: 'GET',
    params: { fields: 'id,effective_status' },
    token: ctx.token,
    propertyId,
  });
  if (!result.ok) return result;

  return { ok: true, data: { effectiveStatus: result.data.effective_status ?? 'UNKNOWN' } };
}
