/**
 * Utilities for importing historical booking data from CSV.
 */

/**
 * Parse a full name string into firstName and lastName.
 * Handles single names, multi-part names, and hyphenated names.
 */
export function parseName(fullName: string): { firstName: string; lastName?: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: '' };

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }

  // First part is firstName, rest is lastName
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Normalize a name for matching: lowercase, strip diacritics, collapse whitespace/hyphens.
 * Used for dedup comparison, NOT for storage.
 */
export function normalizeNameForMatching(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[-\s]+/g, ' ') // collapse hyphens and whitespace
    .trim();
}

/**
 * Check if two full names match after normalization.
 * Handles diacritics, spacing, and hyphen differences.
 * Intentionally strict — only exact normalized matches.
 */
export function namesMatch(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;
  return normalizeNameForMatching(nameA) === normalizeNameForMatching(nameB);
}

/**
 * Parse an earning string from CSV into a number.
 * Handles formats like "1,148RON", "501RON", "10,500RON".
 */
export function parseEarning(raw: string): number {
  if (!raw) return 0;
  // Remove "RON" suffix and comma thousands separator
  const cleaned = raw.replace(/RON/gi, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num); // Round to nearest integer (RON)
}

/**
 * Parse a CSV date string in DD-Mon-YY format to a Date object.
 * Examples: "14-Jan-22" → 2022-01-14, "07-Jun-25" → 2025-06-07
 */
export function parseCSVDate(raw: string): Date | null {
  if (!raw || !raw.trim()) return null;

  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  const parts = raw.trim().split('-');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = months[parts[1]];
  const yearShort = parseInt(parts[2], 10);

  if (isNaN(day) || month === undefined || isNaN(yearShort)) return null;

  // Assume 20XX for two-digit years (data spans 2022-2026)
  const year = 2000 + yearShort;

  return new Date(year, month, day);
}

/**
 * Map CSV source values to system source values.
 */
export function mapSource(csvSource: string): string {
  const normalized = csvSource.toLowerCase().trim();
  switch (normalized) {
    case 'airbnb': return 'airbnb';
    case 'booking': return 'booking.com';
    case 'personal': return 'direct';
    case 'travelmint': return 'travelmint';
    default: return normalized || 'unknown';
  }
}

/**
 * Map and clean country codes from CSV.
 */
export function mapCountry(csvCountry: string): string | undefined {
  const trimmed = csvCountry?.trim();
  if (!trimmed || trimmed === '?') return undefined;
  if (trimmed === 'UC') return 'UA'; // Ukraine
  return trimmed;
}
