/**
 * Reading dates back out of Firestore.
 *
 * A booking's `checkInDate` can arrive as an Admin Timestamp, a Client Timestamp, a serialized
 * `{_seconds}` object, a Date, or an ISO string, depending on which SDK wrote it and whether it
 * crossed a server/client boundary on the way. Every sweep that reads bookings needs this, so it
 * lives here rather than in any one feature's namespace - there were four copies under three
 * names before this file existed.
 */

/**
 * Parse a Firestore date field that may be an Admin/Client Timestamp, a serialized `{_seconds}`
 * object, a Date, or an ISO string. Returns null for anything unparseable, including an Invalid
 * Date - callers must not have to re-check with isNaN.
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
