/**
 * Per-property Meta Ads context resolution — Phase 0 (plan §3, §5, §8, §13 H2).
 *
 * MULTI-PROPERTY FIRST, AGENCY-SHAPED: the ad account/page/IG actor are
 * per-property CONFIG stored on the property document at
 * `analytics.{metaAdAccountId,metaPageId,metaInstagramActorId,metaTokenRef}`
 * (extends the existing `analytics.metaPixelId` config — see meta-pixels.ts,
 * whose read/cache pattern this mirrors). The token itself is NOT stored per
 * property; it's resolved from the `META_ADS_TOKENS` secret, a JSON map keyed
 * by `metaTokenRef` — mirrors meta-capi.ts's `META_CAPI_TOKENS` pattern. Most
 * future clients won't own their Meta ad account (agency model, plan §3), so
 * `metaTokenRef` may be a shared ref used by several properties — resolution
 * is keyed by ref, never assumed 1:1 with propertyId.
 *
 * A property with no ad account configured, OR whose `metaTokenRef` has no
 * entry in the secret, resolves to `null` — multi-tenant isolation: an
 * unconfigured property gets NO ads, same discipline as the pixel (plan §8).
 * This null-on-missing check is necessary but NOT sufficient for isolation
 * under a SHARED token — see `adExecutionGateway`'s ownership assert (H2),
 * which is the check that catches `activate(propA, campaignOfB)`.
 *
 * Cached per process (TTL 5min — ad config changes rarely) to avoid a
 * Firestore read on every call. Server-only (Admin SDK).
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';

const logger = loggers.ads;
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface AdContext {
  adAccountId: string;
  pageId?: string;
  instagramActorId?: string;
  token: string;
}

const cache = new Map<string, { value: AdContext | null; at: number }>();

/**
 * Per-tokenRef Meta Ads access tokens, from the META_ADS_TOKENS secret — a
 * JSON map `{ "<tokenRef>": "<system-user-token>" }`. Parsed once (lazily,
 * like meta-capi.ts's capiTokens). A tokenRef with no entry resolves to
 * undefined (isolation).
 */
let adsTokens: Record<string, string> | null = null;
function getAdsToken(tokenRef: string): string | undefined {
  if (adsTokens === null) {
    try {
      adsTokens = process.env.META_ADS_TOKENS ? JSON.parse(process.env.META_ADS_TOKENS) : {};
    } catch {
      logger.warn('resolveAdContext: META_ADS_TOKENS is not valid JSON');
      adsTokens = {};
    }
  }
  return (adsTokens ?? {})[tokenRef];
}

/**
 * Resolve the Meta Ads context configured for a property. Returns null if the
 * property has no ad account configured OR its `metaTokenRef` has no token in
 * the secret — an unconfigured/misconfigured property gets NO ads.
 */
export async function resolveAdContext(propertyId: string): Promise<AdContext | null> {
  if (!propertyId) return null;

  const now = Date.now();
  const cached = cache.get(propertyId);
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;

  let value: AdContext | null = null;
  try {
    const db = await getAdminDb();
    const doc = await db.collection('properties').doc(propertyId).get();
    const analytics = doc.data()?.analytics as
      | {
          metaAdAccountId?: string;
          metaPageId?: string;
          metaInstagramActorId?: string;
          metaTokenRef?: string;
        }
      | undefined;

    const adAccountId = analytics?.metaAdAccountId?.trim() || undefined;
    const tokenRef = analytics?.metaTokenRef?.trim() || undefined;
    const token = tokenRef ? getAdsToken(tokenRef) : undefined;

    if (adAccountId && token) {
      value = {
        adAccountId,
        pageId: analytics?.metaPageId?.trim() || undefined,
        instagramActorId: analytics?.metaInstagramActorId?.trim() || undefined,
        token,
      };
    }
  } catch {
    logger.warn('resolveAdContext: read failed; using last-known', { propertyId });
    value = cached?.value ?? null;
  }

  cache.set(propertyId, { value, at: now });
  return value;
}

/** Clear the in-process ad-context cache (tests / after a config edit). */
export function clearAdContextCache(): void {
  cache.clear();
  adsTokens = null;
}
