/**
 * Date helpers for the Growth Engine segment logic.
 *
 * Dependency-free and pure (duck-types Firestore Timestamps rather than
 * importing the Admin/Client SDK) so it is unit-testable and safe to import
 * from either runtime.
 */
import type { Season } from '@/types';

// Promoted to src/lib/firestore-dates.ts - every booking sweep needs it, not just the Growth
// Engine. Re-exported so existing importers are untouched.
export { parseFirestoreDate } from '@/lib/firestore-dates';

/**
 * Northern-hemisphere meteorological season of a date (Romania).
 * Uses UTC getters so classification is deterministic regardless of the host
 * timezone — matching this project's hard-won lesson that local-time date math
 * shifts by a day in non-UTC environments (L1).
 */
export function seasonOf(date: Date): Season {
  const m = date.getUTCMonth(); // 0-11
  if (m === 11 || m <= 1) return 'winter'; // Dec, Jan, Feb
  if (m <= 4) return 'spring';             // Mar, Apr, May
  if (m <= 7) return 'summer';             // Jun, Jul, Aug
  return 'autumn';                          // Sep, Oct, Nov
}

/**
 * Whole calendar months from `from` to `to` (>= 0 when `to` is later).
 * Not yet a full month if `to`'s day-of-month is before `from`'s. UTC-based (L1).
 */
export function monthsBetween(from: Date, to: Date): number {
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}
