/**
 * accountSpend — what this ad account has actually spent, read at ACCOUNT level.
 *
 * The ledger behind the season planner cannot be built by summing our own
 * `adCampaigns` docs. The owner boosts page posts by hand in Ads Manager, and
 * those boosts produce no doc here: the "Vine toamna" post spent 23.72 RON that
 * way in Aug-Sep 2026. Summing our records would therefore overstate the
 * remaining budget by exactly the amount spent outside the system — the one
 * error a budget ledger must not make. So we ask Meta for the account total, and
 * use our own records only to SUBTRACT.
 *
 * Read-only. Two GETs, no writes, no spend.
 *
 * ## Two traps this module exists to contain
 *
 * **1. Units.** `insights.spend` comes back in MAJOR units (RON) while
 * `account.amount_spent` is MINOR (bani) — and `brandHealth.ts` returns both
 * from the same function today. Getting it backwards in a budget ledger is a
 * 100x error. Conversion happens exactly once, here, at the boundary.
 *
 * **2. Date presets silently drop today.** Every `date_preset`, and the
 * aggregated `maximum`, excludes the current day; on 18 Aug 2026 a preset
 * reported 271 impressions where an explicit `time_range` reported 3,128
 * (docs/meta-ads-infrastructure-2026.md §9i). This module always sends an
 * explicit `time_range`, and the caller is responsible for passing dates in the
 * AD ACCOUNT's timezone, which is CET here and is NOT the server clock.
 */
import { metaGraph } from './client';
import { resolveAdContext } from './adContext';
import type { GraphResult } from './client';
import { loggers } from '@/lib/logger';

const logger = loggers.ads;

export interface AccountSpendWindow {
  adAccountId: string;
  /** Inclusive YYYY-MM-DD bounds, in the ad account's timezone. */
  since: string;
  until: string;
  /** Account-level total, bani. ALL campaigns, including boosts made by hand. */
  spendMinor: number;
  currency: string;
  /** Per-campaign breakdown, so the unplanned share can be named rather than inferred. */
  byCampaign: Array<{ campaignId: string; name: string; spendMinor: number }>;
  /** The account's own timezone, so a caller can stop assuming UTC. */
  timezoneName: string | null;
  fetchedAt: string;
}

interface InsightsRow {
  spend?: string;
  campaign_id?: string;
  campaign_name?: string;
}
interface InsightsResponse {
  data?: InsightsRow[];
}
interface AccountMetaResponse {
  currency?: string;
  timezone_name?: string;
}

/** RON (major) -> bani (minor). The single conversion point for Meta insight spend. */
function spendToMinor(spend: string | undefined): number {
  const n = Number(spend ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Today's date in an IANA timezone, as YYYY-MM-DD. Meta interprets `time_range`
 * in the ad account's timezone, so "until today" computed from the server clock
 * can be a day out and silently truncate or over-run the window.
 */
export function todayInTimezone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/**
 * Read account-level spend for an inclusive date range.
 *
 * Returns `ok:false` rather than throwing; the ledger degrades to
 * `available:false` on failure instead of silently reporting zero spend, which
 * would read as "the whole budget is intact".
 */
export async function getAccountSpend(
  propertyId: string,
  since: string,
  until: string
): Promise<GraphResult<AccountSpendWindow>> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) return { ok: false, error: 'no-ad-context' };

  const timeRange = JSON.stringify({ since, until });

  // Account meta first: currency + timezone, so the caller can verify the window
  // was expressed in the account's own days.
  const meta = await metaGraph<AccountMetaResponse>(ctx.adAccountId, {
    params: { fields: 'currency,timezone_name' },
    token: ctx.token,
    propertyId,
  });

  const total = await metaGraph<InsightsResponse>(`${ctx.adAccountId}/insights`, {
    params: { level: 'account', time_range: timeRange, fields: 'spend' },
    token: ctx.token,
    propertyId,
  });
  if (!total.ok) {
    logger.warn('getAccountSpend: account-level insights failed', { propertyId, error: total.error });
    return total;
  }

  const perCampaign = await metaGraph<InsightsResponse>(`${ctx.adAccountId}/insights`, {
    params: {
      level: 'campaign',
      time_range: timeRange,
      fields: 'campaign_id,campaign_name,spend',
      limit: 200,
    },
    token: ctx.token,
    propertyId,
  });

  const spendMinor = spendToMinor(total.data.data?.[0]?.spend);
  const byCampaign = perCampaign.ok
    ? (perCampaign.data.data ?? []).map((r) => ({
        campaignId: r.campaign_id ?? '',
        name: r.campaign_name ?? '',
        spendMinor: spendToMinor(r.spend),
      }))
    : [];

  if (!perCampaign.ok) {
    // The total is authoritative and enough for the envelope; without the
    // breakdown we simply cannot NAME the unplanned share.
    logger.warn('getAccountSpend: campaign breakdown failed — total still usable', {
      propertyId,
      error: perCampaign.error,
    });
  }

  return {
    ok: true,
    data: {
      adAccountId: ctx.adAccountId,
      since,
      until,
      spendMinor,
      currency: (meta.ok ? meta.data.currency : undefined) ?? 'RON',
      byCampaign,
      timezoneName: (meta.ok ? meta.data.timezone_name : undefined) ?? null,
      fetchedAt: new Date().toISOString(),
    },
  };
}
