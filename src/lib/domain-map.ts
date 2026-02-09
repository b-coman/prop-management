// Shared domain-to-property map used by middleware and root not-found page.
// Edge-compatible: no Firestore or Node.js dependencies.
export const DOMAIN_TO_PROPERTY_MAP: Record<string, string> = {
  // Production custom domains
  'prahova-chalet.ro': 'prahova-mountain-chalet',
  'www.prahova-chalet.ro': 'prahova-mountain-chalet',
  // Add more property domains here as needed:
  // 'coltei-apartment.ro': 'coltei-apartment-bucharest',
};
