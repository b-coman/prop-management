/**
 * audiences — the Meta custom-audience reader for the ads arm, and the ONE place that knows how to
 * tell a usable audience from an unusable one.
 *
 * WHY THIS MODULE EXISTS AT ALL: Meta reports `approximate_count_lower_bound` and
 * `approximate_count_upper_bound` as **1000 / 1000 for every audience regardless of the truth** —
 * the two dead 2023 engagement audiences on this account report exactly the same size as the live
 * website ones. Read naively, size tells you nothing. The honest signal is `delivery_status.code`:
 *
 *   200 → "This audience is ready for use."                     (at or above Meta's ~1,000 floor)
 *   300 → "Audience is too small to be used in campaign creation."
 *
 * So `deliverable` here is derived from delivery_status, never from the size fields, and callers
 * should treat `approxSize` as decorative. Getting this wrong means planning a retargeting campaign
 * against an audience that cannot deliver — the ad set is accepted and then simply never spends.
 *
 * Read-only by default. `createWebsiteAudience` exists because a campaign-scoped audience ("everyone
 * who saw THIS landing page") has to be created at the moment the campaign is planned to be worth
 * anything: website custom audiences only backfill from pixel history the pixel already holds, so an
 * audience created late starts near-empty and stays behind the flight it was meant to serve.
 */
import { metaGraph } from './client';
import { resolveAdContext } from './adContext';
import { getPixelIdForProperty } from '@/lib/meta-pixels';
import { loggers } from '@/lib/logger';

const logger = loggers.ads;

/** Meta's delivery_status code meaning "ready for use". Anything else cannot be targeted. */
const DELIVERY_READY = 200;

/** Meta's own minimum for a targetable custom audience. Stated here for error copy, not enforced locally. */
export const AUDIENCE_DELIVERY_FLOOR = 1000;

export interface CustomAudienceSummary {
  id: string;
  name: string;
  /** WEBSITE | CUSTOM | ENGAGEMENT | LOOKALIKE … */
  subtype: string | null;
  /** Derived from delivery_status, NOT from the size fields — see the module doc. */
  deliverable: boolean;
  /** Meta's own words, kept verbatim so a review screen can show why something is unusable. */
  deliveryDescription: string | null;
  retentionDays: number | null;
  createdAt: string | null;
  /**
   * Meta's reported bound. Almost always the literal 1000 placeholder, so it is NOT a size and must
   * never gate a decision — kept only so an operator can see what Meta returned.
   */
  approxSize: number | null;
}

/**
 * Every custom audience on the property's ad account, newest first.
 *
 * Returns `[]` (never throws) when the property has no ad context or Meta errors — the ads arm
 * treats a missing audience list as "no retargeting available", which degrades to prospecting
 * rather than crashing a planning run.
 */
export async function listCustomAudiences(propertyId: string): Promise<CustomAudienceSummary[]> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    logger.warn('listCustomAudiences: no ad context for property', { propertyId });
    return [];
  }

  const res = await metaGraph<{ data?: unknown[] }>(`${ctx.adAccountId}/customaudiences`, {
    token: ctx.token,
    params: {
      fields:
        'id,name,subtype,delivery_status,operation_status,retention_days,time_created,approximate_count_lower_bound',
      limit: 100,
    },
  });

  if (!res.ok) {
    logger.warn('listCustomAudiences: Meta read failed', { propertyId, error: res.error });
    return [];
  }

  const rows = (res.data?.data ?? []) as Array<Record<string, any>>;
  return rows.map((a) => {
    const delivery = a.delivery_status as { code?: number; description?: string } | undefined;
    return {
      id: String(a.id),
      name: String(a.name ?? ''),
      subtype: a.subtype ?? null,
      deliverable: delivery?.code === DELIVERY_READY,
      deliveryDescription: delivery?.description ?? null,
      retentionDays: typeof a.retention_days === 'number' ? a.retention_days : null,
      // time_created is a unix SECONDS value on this edge, not the ISO string most Graph edges use.
      createdAt: a.time_created ? new Date(Number(a.time_created) * 1000).toISOString() : null,
      approxSize:
        typeof a.approximate_count_lower_bound === 'number' ? a.approximate_count_lower_bound : null,
    };
  });
}

/** The shape the ad-planner pack and `validateAdPlan` share — the narrows-never-widens candidate set. */
export interface AudienceCandidate {
  id: string;
  name: string;
  deliverable: boolean;
}

/**
 * The audiences a planner may choose from.
 *
 * Undeliverable ones are INCLUDED rather than filtered out, deliberately: the validator's error
 * ("below Meta's delivery floor") is far more useful to a planner, and to a human reading the
 * rejection, than an id silently missing from the candidate list with no explanation.
 */
export async function audienceCandidates(propertyId: string): Promise<AudienceCandidate[]> {
  const all = await listCustomAudiences(propertyId);
  return all.map((a) => ({ id: a.id, name: a.name, deliverable: a.deliverable }));
}

export interface CreateWebsiteAudienceSpec {
  name: string;
  description?: string;
  /** Matched case-insensitively against the visited URL — e.g. a landing slug. */
  urlContains: string;
  /** How long someone stays in the audience. Match it to the SELLING window, not to a default. */
  retentionDays: number;
}

/**
 * Create a website custom audience scoped to one URL fragment.
 *
 * `prefill: 1` backfills from pixel history the account already holds — which is only useful for a
 * URL that has existed for a while. For a page created today this returns an audience that is
 * correctly empty, and it will fill from live traffic; that is expected, not a failure, and the
 * audience will read "too small" until it clears Meta's floor.
 *
 * Retention should track the window being sold. A 180-day tail on a page selling a fortnight keeps
 * paying to reach people whose trip is long over.
 */
export async function createWebsiteAudience(
  propertyId: string,
  spec: CreateWebsiteAudienceSpec
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) return { ok: false, error: 'no-ad-context' };
  // The pixel comes from the property, not from AdContext — same resolver campaignBuilder uses, so
  // an audience can never be built against a different property's pixel.
  const pixelId = await getPixelIdForProperty(propertyId);
  if (!pixelId) {
    // A website audience is defined by pixel events; without a pixel there is nothing to match on.
    logger.warn('createWebsiteAudience: property has no pixel — refusing', { propertyId });
    return { ok: false, error: 'no-pixel' };
  }

  const rule = {
    inclusions: {
      operator: 'or',
      rules: [
        {
          event_sources: [{ type: 'pixel', id: pixelId }],
          retention_seconds: spec.retentionDays * 24 * 60 * 60,
          filter: {
            operator: 'and',
            filters: [{ field: 'url', operator: 'i_contains', value: spec.urlContains }],
          },
        },
      ],
    },
  };

  // NOT createResource(): that helper injects `status: 'PAUSED'`, which is meaningless on an
  // audience and would be rejected. Audiences cost nothing and spend nothing, so the PAUSED
  // convention that guards campaign objects has no work to do here.
  const res = await metaGraph<{ id?: string }>(`${ctx.adAccountId}/customaudiences`, {
    token: ctx.token,
    method: 'POST',
    params: {
      name: spec.name,
      description: spec.description ?? '',
      rule,
      prefill: 1,
    },
  });

  if (!res.ok || !res.data?.id) {
    logger.warn('createWebsiteAudience: create failed', { propertyId, error: res.ok ? 'no-id' : res.error });
    return { ok: false, error: res.ok ? 'no-id' : res.error };
  }
  logger.info('createWebsiteAudience: created', { propertyId, id: res.data.id, urlContains: spec.urlContains });
  return { ok: true, id: String(res.data.id) };
}
