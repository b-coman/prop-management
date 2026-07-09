/**
 * Meta Graph/Marketing API client — Phase 0 (plan §5, §9, §13).
 *
 * The ONLY module in this codebase that calls `graph.facebook.com`. Every
 * other growth-ads module goes through here so the safety properties from the
 * adversarial review are enforced in exactly ONE place:
 *
 * - The access token is NEVER placed in the URL query string (Fable M5) — it
 *   always travels in the `Authorization: Bearer` header, for both GET and
 *   POST/DELETE calls. (The existing `getCampaignInsights` stub in
 *   `metaAdsService.ts` puts it in the URL — that is the leak Fable flagged;
 *   this client is the fix, new callers must use it instead.)
 * - `createResource()` unconditionally injects `status: 'PAUSED'` into every
 *   create payload, AFTER spreading the caller's payload, so a caller cannot
 *   pass a different status and have it win (Fable C2). PAUSED is OUR
 *   convention — the raw Marketing API has no such default (unlike the
 *   official Ads CLI/MCP) — so this is the one place that enforces it.
 * - Non-OK responses are returned as a typed `{ ok: false, error }`, logged
 *   via `loggers.ads`, and NEVER thrown — a Meta API hiccup must never crash a
 *   caller's critical path (mirrors `meta-capi.ts`'s fetch handling).
 *
 * Phase 0 intentionally stops at this low-level client + the PAUSED-enforcing
 * create helper + the pause/activate status-transition helpers — no
 * campaign/adset/ad/creative business logic yet. That needs a verified API
 * contract spike against the live account first (plan §9 Phase 1); building it
 * blind would bake in wrong assumptions about a beta API.
 */
import { loggers } from '@/lib/logger';

const logger = loggers.ads;

/**
 * Single source of truth for the Marketing API version — do not scatter
 * (plan §9/§13 L2). NOTE: the verified contract spike (docs/meta-ads-
 * infrastructure-2026.md §9) found the live account's paging responses
 * resolving to v25.0; v21.0 is pinned here per explicit Phase-0 spec and is
 * still valid today, but should be bumped to a current version as part of the
 * Phase 1 API contract spike, in this one place.
 */
export const GRAPH_API_VERSION = 'v21.0';

const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type GraphMethod = 'GET' | 'POST';

export interface MetaGraphParams {
  method?: GraphMethod;
  /** Query params (GET) or form body fields (POST). NEVER include `access_token` here. */
  params?: Record<string, string | number | boolean | undefined>;
  token: string;
  /** The property this call is being made for — logging/audit only, never used to pick the token. */
  propertyId?: string;
}

export interface GraphSuccess<T> {
  ok: true;
  data: T;
}

export interface GraphFailure {
  ok: false;
  error: string;
  status?: number;
}

export type GraphResult<T> = GraphSuccess<T> | GraphFailure;

/**
 * Low-level Graph API call. `path` is the node/edge, e.g. `act_123/campaigns`
 * or a bare object id like `120210000000001`. The token ALWAYS travels in the
 * `Authorization` header — never appended to the URL — regardless of method
 * (Fable M5). Never throws: network/parse errors and non-OK HTTP responses
 * both resolve to `{ ok: false, error }`.
 */
export async function metaGraph<T = Record<string, unknown>>(
  path: string,
  opts: MetaGraphParams
): Promise<GraphResult<T>> {
  const method = opts.method ?? 'GET';
  const cleanPath = path.replace(/^\/+/, '');
  const url = new URL(`${GRAPH_BASE_URL}/${cleanPath}`);

  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(opts.params ?? {})) {
    if (value === undefined) continue;
    fields[key] = String(value);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
  };
  const init: RequestInit = { method, headers };

  if (method === 'GET') {
    for (const [key, value] of Object.entries(fields)) url.searchParams.set(key, value);
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(fields).toString();
  }

  try {
    const response = await fetch(url.toString(), init);
    if (!response.ok) {
      const text = await response.text();
      logger.warn('metaGraph: non-OK response', {
        path: cleanPath,
        method,
        status: response.status,
        propertyId: opts.propertyId,
        body: text,
      });
      return { ok: false, error: text, status: response.status };
    }
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error) {
    logger.warn('metaGraph: fetch error', {
      path: cleanPath,
      method,
      propertyId: opts.propertyId,
      error: String(error),
    });
    return { ok: false, error: String(error) };
  }
}

/**
 * Create a resource under an ad account (e.g. a campaign/ad set/ad/creative,
 * addressed as an edge name like `campaigns`). This is THE enforcement point
 * for PAUSED-by-default (Fable C2): `status: 'PAUSED'` is spread into the
 * outgoing payload LAST, so any `status` the caller supplied is overwritten,
 * not merely defaulted. Every other module MUST create Meta resources through
 * this helper — never call `metaGraph()` directly for a create — so there is
 * exactly one place a future change could accidentally let a live ad through.
 */
export async function createResource<T = Record<string, unknown>>(
  node: string,
  adAccountId: string,
  token: string,
  payload: Record<string, string | number | boolean | undefined>,
  propertyId?: string
): Promise<GraphResult<T>> {
  const enforcedPayload = {
    ...payload,
    status: 'PAUSED', // enforced HERE, unconditionally — not a caller convention (C2)
  };
  return metaGraph<T>(`${adAccountId}/${node}`, {
    method: 'POST',
    params: enforcedPayload,
    token,
    propertyId,
  });
}

/**
 * Pause an existing resource by id (campaign/ad set/ad) — the STOP primitive
 * (Fable C1: build the stop side before/with the start side). Safe to call
 * repeatedly; pausing an already-paused resource is idempotent on Meta's side.
 */
export async function pauseResource(
  id: string,
  token: string,
  propertyId?: string
): Promise<GraphResult<{ success: boolean }>> {
  return metaGraph<{ success: boolean }>(id, {
    method: 'POST',
    params: { status: 'PAUSED' },
    token,
    propertyId,
  });
}

/**
 * Un-pause (activate) an existing resource by id. This is the ONLY helper in
 * this client that can set a non-PAUSED status, which is why it must only ever
 * be reached through `adExecutionGateway.activateCampaign` — after the
 * dry-run/approval/spend-cap/ownership checks, never called directly by
 * feature code.
 */
export async function activateResource(
  id: string,
  token: string,
  propertyId?: string
): Promise<GraphResult<{ success: boolean }>> {
  return metaGraph<{ success: boolean }>(id, {
    method: 'POST',
    params: { status: 'ACTIVE' },
    token,
    propertyId,
  });
}
