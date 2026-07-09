/**
 * Per-property Meta Pixel / dataset IDs (PUBLIC — they appear in the browser).
 *
 * MULTI-PROPERTY FIRST: each property fires to ITS OWN pixel. A property with no
 * entry here has NO Meta tracking — its traffic/conversions must never pollute
 * another property's pixel. CAPI access tokens are per-property secrets and live
 * in Secret Manager (see meta-capi.ts / META_CAPI_TOKENS) — NEVER here.
 *
 * To onboard a property: create its own dataset in that property's Meta Business,
 * add its id below, and add its token to the META_CAPI_TOKENS secret map.
 */
export const PROPERTY_META_PIXELS: Record<string, string> = {
  'prahova-mountain-chalet': '1010060168431159',
  // 'coltei-apartment-bucharest': '<create its own dataset, then add its id here>',
};

/** Resolve the Meta pixel id for a property slug (undefined if not configured). */
export function getPixelIdForProperty(slug?: string | null): string | undefined {
  if (!slug) return undefined;
  return PROPERTY_META_PIXELS[slug];
}
