/**
 * Per-property Meta Pixel resolution.
 *
 * MULTI-PROPERTY FIRST: the pixel id is per-property CONFIG, stored on the
 * property document at `analytics.metaPixelId` and edited in the admin UI
 * (/admin/website/settings → Analytics). Each property fires to ITS OWN pixel;
 * a property with none has no Meta tracking (no cross-property pollution).
 *
 * This resolves from Firestore (domain-agnostic — works whether the property is
 * reached via its custom domain or via /properties/{slug}) and is cached per
 * process to avoid a read on every request. CAPI access tokens are separate
 * secrets (see meta-capi.ts / META_CAPI_TOKENS) — never stored here.
 *
 * Server-only (Admin SDK). The browser receives the resolved id as a prop.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';

const logger = loggers.tracking;
const CACHE_TTL_MS = 5 * 60 * 1000; // property analytics config changes rarely

const cache = new Map<string, { value: string | undefined; at: number }>();

/** Resolve the Meta pixel id configured for a property (undefined if none). */
export async function getPixelIdForProperty(slug?: string | null): Promise<string | undefined> {
  if (!slug) return undefined;

  const now = Date.now();
  const cached = cache.get(slug);
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;

  let value: string | undefined;
  try {
    const db = await getAdminDb();
    const doc = await db.collection('properties').doc(slug).get();
    const analytics = doc.data()?.analytics as { metaPixelId?: string } | undefined;
    value = analytics?.metaPixelId ? String(analytics.metaPixelId).trim() || undefined : undefined;
  } catch {
    logger.warn('getPixelIdForProperty: read failed; using last-known', { slug });
    value = cached?.value;
  }
  cache.set(slug, { value, at: now });
  return value;
}

/** Clear the in-process pixel cache (tests / after a config edit). */
export function clearPixelCache(): void {
  cache.clear();
}
