/**
 * Shared country code utilities.
 * Single source of truth for ISO 3166-1 alpha-2 ↔ country name mapping.
 */

export const COUNTRY_MAP: Record<string, string> = {
  RO: 'Romania',
  DE: 'Germany',
  FR: 'France',
  GB: 'United Kingdom',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  AT: 'Austria',
  BE: 'Belgium',
  CH: 'Switzerland',
  PL: 'Poland',
  HU: 'Hungary',
  CZ: 'Czech Republic',
  IL: 'Israel',
  US: 'United States',
  CA: 'Canada',
  SE: 'Sweden',
  DK: 'Denmark',
  NO: 'Norway',
  IE: 'Ireland',
  GR: 'Greece',
  PT: 'Portugal',
  BG: 'Bulgaria',
  HR: 'Croatia',
  UA: 'Ukraine',
  TR: 'Turkey',
  JP: 'Japan',
  KR: 'South Korea',
  AU: 'Australia',
  AR: 'Argentina',
  CL: 'Chile',
  CY: 'Cyprus',
  FI: 'Finland',
  MD: 'Moldova',
  SA: 'Saudi Arabia',
  TH: 'Thailand',
  AE: 'UAE',
  SK: 'Slovakia',
  SI: 'Slovenia',
  RS: 'Serbia',
  ME: 'Montenegro',
  BA: 'Bosnia and Herzegovina',
  MK: 'North Macedonia',
  AL: 'Albania',
  LT: 'Lithuania',
  LV: 'Latvia',
  EE: 'Estonia',
  MT: 'Malta',
  LU: 'Luxembourg',
  IS: 'Iceland',
  NZ: 'New Zealand',
  BR: 'Brazil',
  MX: 'Mexico',
  IN: 'India',
  CN: 'China',
  SG: 'Singapore',
  ZA: 'South Africa',
};

// Reverse map: lowercase full name → ISO code
const NAME_TO_CODE: Record<string, string> = {};
for (const [code, name] of Object.entries(COUNTRY_MAP)) {
  NAME_TO_CODE[name.toLowerCase()] = code;
}

// Known non-standard codes → ISO corrections
const CODE_CORRECTIONS: Record<string, string> = {
  UK: 'GB',
  UC: 'UA',
};

/**
 * Normalize any country input to ISO 3166-1 alpha-2 code.
 * Accepts: ISO codes ("RO"), full names ("Romania"), non-standard codes ("UK").
 * Returns undefined if unrecognizable.
 */
export function normalizeCountryCode(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const upper = trimmed.toUpperCase();

  // Check known corrections first (UK → GB, UC → UA)
  if (CODE_CORRECTIONS[upper]) return CODE_CORRECTIONS[upper];

  // Already a valid ISO code?
  if (COUNTRY_MAP[upper]) return upper;

  // Full name match (case-insensitive)
  const fromName = NAME_TO_CODE[trimmed.toLowerCase()];
  if (fromName) return fromName;

  // 2-letter code not in our map — return as-is (might be valid ISO we haven't listed)
  if (/^[A-Z]{2}$/.test(upper)) return upper;

  return undefined;
}

/**
 * Get display name from ISO code. Falls back to the code itself.
 */
export function getCountryName(code: string): string {
  return COUNTRY_MAP[code.toUpperCase()] || code;
}

/**
 * Sorted list of { code, name } for form dropdowns.
 */
export function getCountryOptions(): Array<{ code: string; name: string }> {
  return Object.entries(COUNTRY_MAP)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
