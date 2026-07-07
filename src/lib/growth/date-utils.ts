/**
 * Date helpers for the Growth Engine segment logic.
 *
 * Dependency-free and pure (duck-types Firestore Timestamps rather than
 * importing the Admin/Client SDK) so it is unit-testable and safe to import
 * from either runtime.
 */
import type { Season } from '@/types';

/**
 * Parse a Firestore date field that may be an Admin/Client Timestamp,
 * a serialized `{_seconds}` object, a Date, or an ISO string.
 */
export function parseFirestoreDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as { toDate?: () => Date; _seconds?: number };
    if (typeof o.toDate === 'function') {
      const d = o.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof o._seconds === 'number') return new Date(o._seconds * 1000);
  }
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Northern-hemisphere meteorological season of a date (Romania). */
export function seasonOf(date: Date): Season {
  const m = date.getMonth(); // 0-11
  if (m === 11 || m <= 1) return 'winter'; // Dec, Jan, Feb
  if (m <= 4) return 'spring';             // Mar, Apr, May
  if (m <= 7) return 'summer';             // Jun, Jul, Aug
  return 'autumn';                          // Sep, Oct, Nov
}

/**
 * Whole calendar months from `from` to `to` (>= 0 when `to` is later).
 * Not yet a full month if `to`'s day-of-month is before `from`'s.
 */
export function monthsBetween(from: Date, to: Date): number {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}
