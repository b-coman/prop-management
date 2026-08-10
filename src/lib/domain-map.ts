// Shared domain-to-property map used by middleware and root not-found page.
// Edge-compatible: no Firestore or Node.js dependencies.
export const DOMAIN_TO_PROPERTY_MAP: Record<string, string> = {
  // Production custom domains
  'prahova-chalet.ro': 'prahova-mountain-chalet',
  'www.prahova-chalet.ro': 'prahova-mountain-chalet',
  // Add more property domains here as needed:
  // 'coltei-apartment.ro': 'coltei-apartment-bucharest',
};

/**
 * The origin a guest should see for a property — its own domain, not whichever
 * host the admin happens to be on. Used when building links that get copied out
 * of admin and sent to guests.
 *
 * Prefers the apex domain over the `www.` alias. Returns null for properties
 * with no custom domain yet, so callers can fall back to the app URL.
 */
export function publicOriginForProperty(propertySlug: string): string | null {
  const domain = Object.keys(DOMAIN_TO_PROPERTY_MAP)
    .filter((d) => DOMAIN_TO_PROPERTY_MAP[d] === propertySlug)
    .sort((a, b) => a.length - b.length)[0];
  return domain ? `https://${domain}` : null;
}
