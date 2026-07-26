/**
 * brandHealth — the read-only Facebook PAGE-health + ad-account (ACQUISITION)
 * sensors (promotion-system-architecture.md §3.1, build step 1).
 *
 * These are the first two "new sensors" the shared analyst reasons over beyond
 * inventory/pace/audience: is the brand page alive and correctly configured, and
 * what does the ad account's history tell us about acquisition. Both are PURE
 * GETs — reading page/account data can never spend money — so, like `insights.ts`,
 * the only precondition is a resolved ad context; there is no dark-launch gate.
 *
 * Every Meta call goes through `metaGraph` (the one module that touches
 * graph.facebook.com), token in the Bearer header, never thrown — a Graph hiccup
 * surfaces as `{ok:false,error}`. Verified against the live account 26 Jul 2026
 * (docs/meta-ads-infrastructure-2026.md §11): the system-user token reads the
 * page PROFILE directly and page AGGREGATE insights via a derived page token
 * (ANALYZE task); reading post CONTENT / Instagram / posting needs added scopes
 * (§11.2) and is deliberately NOT attempted here.
 *
 * Plain server module (NOT 'use server') — exports types + async functions.
 */
import { loggers } from '@/lib/logger';
import { resolveAdContext, type AdContext } from './adContext';
import { metaGraph, type GraphResult } from './client';

const logger = loggers.ads;

/**
 * The page-insight metrics that are still VALID in Graph v25 (§11.1) — the
 * classic ones (`page_impressions`, `page_fans`, demographics) were deprecated.
 * Requesting an invalid metric fails the WHOLE call, so this list is curated.
 */
const VALID_PAGE_METRICS = [
  'page_post_engagements',
  'page_daily_follows_unique',
  'page_follows',
  'page_views_total',
  'page_total_actions',
] as const;

/** A page website pointing at an OTA leaks direct-booking margin (the Comarnic page → airbnb link, §11.3). */
const OTA_HOST = /airbnb|booking\.com|vrbo|expedia|trip\.com|hotels\.com/i;

export interface PageHealth {
  pageId: string;
  name?: string;
  username?: string;
  link?: string;
  followers: number;
  isPublished: boolean;
  talkingAboutCount: number;
  category?: string;
  websiteUrl?: string;
  /** ⚠️ the page's own website field points at an OTA (leaks direct-booking margin). */
  websiteIsOtaLink: boolean;
  verificationStatus?: string;
  /** Aggregate 28-day page insights (valid v25 metrics only); empty for a dormant page. */
  insights28d: Record<string, number>;
  /** Whether a page token was derivable AND insights read back (ANALYZE task present). */
  canReadInsights: boolean;
  /** No recent activity at all — the "keep the page alive" flag. */
  dormant: boolean;
  /** Human-actionable flags derived from the above (also fed to the analyst). */
  warnings: string[];
}

export interface AdAccountHealth {
  adAccountId: string;
  name?: string;
  accountStatusActive: boolean;
  currency?: string;
  /** Account-level spending limit, in MINOR units (bani). 0 = no limit set (the missing backstop). */
  spendCapMinor: number;
  hasSpendLimit: boolean;
  /** Lifetime amount spent, in MINOR units (bani). */
  amountSpentMinor: number;
  funding?: string;
  /** Lifetime performance — note `spend` here is in MAJOR units (RON), unlike the minor-unit fields above. */
  lifetime: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    reach: number;
  };
  campaignCount: number;
  activeCampaignCount: number;
  /** Any past purchase-type conversion in lifetime insights — false = OUTCOME_SALES starts cold. */
  hasConversionHistory: boolean;
  warnings: string[];
}

// ── Meta response shapes (only the fields we read) ──────────────────────────
interface PageProfileResponse {
  name?: string;
  username?: string;
  link?: string;
  followers_count?: number;
  fan_count?: number;
  is_published?: boolean;
  talking_about_count?: number;
  category?: string;
  website?: string;
  verification_status?: string;
}
interface MeAccountsResponse {
  data?: Array<{ id: string; access_token?: string }>;
}
interface PageInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value: unknown }> }>;
}
interface MetaAction {
  action_type: string;
  value: string;
}
interface AccountResponse {
  name?: string;
  account_status?: number;
  currency?: string;
  spend_cap?: string;
  amount_spent?: string;
  funding_source_details?: { display_string?: string };
}
interface AccountInsightsResponse {
  data?: Array<{
    spend?: string;
    impressions?: string;
    clicks?: string;
    ctr?: string;
    cpc?: string;
    reach?: string;
    actions?: MetaAction[];
  }>;
}
interface CampaignsListResponse {
  data?: Array<{ id: string; effective_status?: string }>;
}

/**
 * Derive a PAGE access token from the system-user token (`me/accounts` returns
 * the token for each assigned page — §11.1). Page aggregate insights require it
 * even though the page PROFILE reads with the system-user token directly.
 * Best-effort: returns undefined (not an error) if the page isn't assigned or
 * the call fails — the caller degrades to profile-only.
 */
async function derivePageToken(ctx: AdContext, propertyId: string): Promise<string | undefined> {
  const res = await metaGraph<MeAccountsResponse>('me/accounts', {
    method: 'GET',
    params: { fields: 'id,access_token' },
    token: ctx.token,
    propertyId,
  });
  if (!res.ok) return undefined;
  return (res.data.data ?? []).find((a) => a.id === ctx.pageId)?.access_token;
}

/** Keep only numeric metric values (some metrics return breakdown objects we ignore here). */
function parsePageInsights(resp: PageInsightsResponse): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of resp.data ?? []) {
    const last = m.values?.[m.values.length - 1]?.value;
    if (typeof last === 'number') out[m.name] = last;
  }
  return out;
}

/**
 * Read the Facebook page's brand health for a property. Never throws; returns
 * `{ok:false,error}` on an unconfigured property, a missing page, or a profile
 * read failure. A missing page TOKEN (insights) is non-fatal — the result comes
 * back with `canReadInsights:false` and profile data intact.
 */
export async function getPageHealth(propertyId: string): Promise<GraphResult<PageHealth>> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    logger.warn('getPageHealth: no ad context for property', { propertyId });
    return { ok: false, error: 'no-ad-context' };
  }
  if (!ctx.pageId) {
    logger.warn('getPageHealth: no page configured for property', { propertyId });
    return { ok: false, error: 'no-page-configured' };
  }

  const profileRes = await metaGraph<PageProfileResponse>(ctx.pageId, {
    method: 'GET',
    params: {
      fields:
        'id,name,username,link,followers_count,fan_count,is_published,talking_about_count,category,website,verification_status',
    },
    token: ctx.token,
    propertyId,
  });
  if (!profileRes.ok) return profileRes;
  const p = profileRes.data;

  // Aggregate insights need a page token (ANALYZE task) — non-fatal if absent.
  let insights28d: Record<string, number> = {};
  let canReadInsights = false;
  const pageToken = await derivePageToken(ctx, propertyId);
  if (pageToken) {
    const insRes = await metaGraph<PageInsightsResponse>(`${ctx.pageId}/insights`, {
      method: 'GET',
      params: { metric: VALID_PAGE_METRICS.join(','), period: 'days_28' },
      token: pageToken,
      propertyId,
    });
    if (insRes.ok) {
      canReadInsights = true;
      insights28d = parsePageInsights(insRes.data);
    }
  }

  const followers = Number(p.followers_count ?? p.fan_count) || 0;
  const talkingAboutCount = Number(p.talking_about_count) || 0;
  const websiteUrl = p.website;
  const websiteIsOtaLink = !!websiteUrl && OTA_HOST.test(websiteUrl);
  const isPublished = p.is_published !== false;
  const dormant = talkingAboutCount === 0;

  const warnings: string[] = [];
  if (websiteIsOtaLink) warnings.push(`page-website-points-to-ota:${websiteUrl}`);
  if (dormant) warnings.push('page-dormant:talking_about_count=0');
  if (!isPublished) warnings.push('page-not-published');
  if (!canReadInsights) warnings.push('page-insights-unreadable:no-page-token-or-analyze-task');

  return {
    ok: true,
    data: {
      pageId: ctx.pageId,
      name: p.name,
      username: p.username,
      link: p.link,
      followers,
      isPublished,
      talkingAboutCount,
      category: p.category,
      websiteUrl,
      websiteIsOtaLink,
      verificationStatus: p.verification_status,
      insights28d,
      canReadInsights,
      dormant,
      warnings,
    },
  };
}

/**
 * Read the ad account's acquisition health for a property — state (incl. the
 * `spend_cap` backstop), lifetime performance, and campaign counts. Never
 * throws; returns `{ok:false,error}` on an unconfigured property or an account
 * read failure. Insights/campaign sub-reads that fail are treated as empty (an
 * account that never ran legitimately has no rows), not a hard error.
 */
export async function getAdAccountHealth(propertyId: string): Promise<GraphResult<AdAccountHealth>> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    logger.warn('getAdAccountHealth: no ad context for property', { propertyId });
    return { ok: false, error: 'no-ad-context' };
  }

  const accRes = await metaGraph<AccountResponse>(ctx.adAccountId, {
    method: 'GET',
    params: { fields: 'id,name,account_status,currency,spend_cap,amount_spent,funding_source_details' },
    token: ctx.token,
    propertyId,
  });
  if (!accRes.ok) return accRes;
  const a = accRes.data;

  const insRes = await metaGraph<AccountInsightsResponse>(`${ctx.adAccountId}/insights`, {
    method: 'GET',
    params: { level: 'account', date_preset: 'maximum', fields: 'spend,impressions,clicks,ctr,cpc,reach,actions' },
    token: ctx.token,
    propertyId,
  });
  const row = insRes.ok ? insRes.data.data?.[0] : undefined;

  const campRes = await metaGraph<CampaignsListResponse>(`${ctx.adAccountId}/campaigns`, {
    method: 'GET',
    params: { fields: 'id,effective_status', limit: 200 },
    token: ctx.token,
    propertyId,
  });
  const campaigns = campRes.ok ? campRes.data.data ?? [] : [];

  const hasConversionHistory = !!row?.actions?.some((x) => /purchase/i.test(x.action_type));
  const spendCapMinor = Number(a.spend_cap) || 0;

  const warnings: string[] = [];
  if (spendCapMinor <= 0) warnings.push('no-account-spend-limit');
  if (!hasConversionHistory) warnings.push('no-conversion-optimized-history');
  if (a.account_status !== 1) warnings.push(`account-not-active:status=${a.account_status ?? 'unknown'}`);

  return {
    ok: true,
    data: {
      adAccountId: ctx.adAccountId,
      name: a.name,
      accountStatusActive: a.account_status === 1,
      currency: a.currency,
      spendCapMinor,
      hasSpendLimit: spendCapMinor > 0,
      amountSpentMinor: Number(a.amount_spent) || 0,
      funding: a.funding_source_details?.display_string,
      lifetime: {
        spend: Number(row?.spend) || 0,
        impressions: Number(row?.impressions) || 0,
        clicks: Number(row?.clicks) || 0,
        ctr: Number(row?.ctr) || 0,
        cpc: Number(row?.cpc) || 0,
        reach: Number(row?.reach) || 0,
      },
      campaignCount: campaigns.length,
      activeCampaignCount: campaigns.filter((c) => c.effective_status === 'ACTIVE').length,
      hasConversionHistory,
      warnings,
    },
  };
}
