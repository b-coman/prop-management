// Property-aware date helpers.
//
// Bookings store actual check-in / check-out times (e.g., 14:00 / 11:00 Bucharest local) instead of
// midnight, to eliminate the "midnight at the dateline" class of bugs. These helpers are the single
// source of truth for converting between Bucharest calendar dates and stored Timestamps.
//
// All times are interpreted in Europe/Bucharest. Multi-timezone properties are not yet supported.

export const PROPERTY_TIMEZONE = 'Europe/Bucharest';

interface PropertyLike {
  checkInTime?: string;  // "3:00 PM"
  checkOutTime?: string; // "11:00 AM"
}

const DEFAULT_CHECKIN_HHMM = { hours: 14, minutes: 0 };  // 2:00 PM
const DEFAULT_CHECKOUT_HHMM = { hours: 11, minutes: 0 }; // 11:00 AM

/**
 * Parse a 12-hour AM/PM time string (e.g., "3:00 PM", "11:30 AM", "12:00 PM") into 24-hour
 * { hours, minutes }. Tolerant of variations: "3PM", "3:00pm", "3:00 PM ".
 * Returns null if unparseable.
 */
export function parseAmPmTime(s: string | undefined | null): { hours: number; minutes: number } | null {
  if (!s) return null;
  const trimmed = s.trim().toUpperCase();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3];
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
  if (period === 'AM' && hours === 12) hours = 0;
  if (period === 'PM' && hours !== 12) hours += 12;
  return { hours, minutes };
}

/**
 * Resolve a property's check-in or check-out time. Falls back to defaults if the field
 * is missing or unparseable.
 */
export function resolvePropertyTime(
  property: PropertyLike | null | undefined,
  kind: 'checkin' | 'checkout'
): { hours: number; minutes: number } {
  const raw = kind === 'checkin' ? property?.checkInTime : property?.checkOutTime;
  return parseAmPmTime(raw) || (kind === 'checkin' ? DEFAULT_CHECKIN_HHMM : DEFAULT_CHECKOUT_HHMM);
}

/**
 * Combine a Bucharest calendar date string (YYYY-MM-DD) with a property's check-in or
 * check-out time, returning a Date at the correct UTC instant.
 *
 * Handles DST automatically — May 22 at 14:00 Bucharest is UTC+3 (EEST) = 11:00 UTC,
 * January 22 at 14:00 Bucharest is UTC+2 (EET) = 12:00 UTC.
 */
export function propertyDateAt(
  property: PropertyLike | null | undefined,
  dateStr: string,
  kind: 'checkin' | 'checkout'
): Date {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`propertyDateAt: invalid date string ${dateStr}, expected YYYY-MM-DD`);
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const { hours, minutes } = resolvePropertyTime(property, kind);
  return zonedTimeToUtc(year, month, day, hours, minutes, PROPERTY_TIMEZONE);
}

/**
 * Convert (year, month, day, hour, minute) interpreted in `timeZone` to a UTC Date.
 *
 * Strategy: build a UTC date at the same wall-clock components, then adjust by the timezone's
 * offset at that instant. We measure the offset using `Intl.DateTimeFormat`. Two iterations
 * handle the rare case where the offset itself shifts due to DST near the input time.
 */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  let offsetMin = getTimeZoneOffsetMinutes(naiveUtc, timeZone);
  let result = new Date(naiveUtc - offsetMin * 60 * 1000);
  // One more pass — if the candidate falls on the other side of a DST transition, the offset changes
  const offsetMin2 = getTimeZoneOffsetMinutes(result.getTime(), timeZone);
  if (offsetMin2 !== offsetMin) {
    result = new Date(naiveUtc - offsetMin2 * 60 * 1000);
  }
  return result;
}

/**
 * Returns the offset (in minutes) of `timeZone` from UTC at the given UTC instant.
 * Positive = ahead of UTC. E.g., Bucharest in summer returns +180.
 */
function getTimeZoneOffsetMinutes(utcMs: number, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(utcMs));
  const get = (type: string) => parseInt(parts.find(p => p.type === type)!.value, 10);
  let hour = get('hour');
  if (hour === 24) hour = 0;
  const localMs = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second')
  );
  return Math.round((localMs - utcMs) / 60000);
}

const bucharestDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: PROPERTY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const bucharestDateTimeFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: PROPERTY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Format a Date as YYYY-MM-DD in Bucharest local time.
 * Use this anywhere we want a "calendar date" representation independent of viewer timezone.
 */
export function formatBucharestDate(d: Date): string {
  return bucharestDateFmt.format(d);
}

/**
 * Returns the day-of-month in Bucharest local time (1..31). Use for indexing
 * availability collection day-keyed maps.
 */
export function getBucharestDay(d: Date): number {
  return parseInt(formatBucharestDate(d).slice(8, 10), 10);
}

/**
 * Returns "YYYY-MM" for the Bucharest local month containing the given Date.
 */
export function getBucharestMonth(d: Date): string {
  return formatBucharestDate(d).slice(0, 7);
}

/**
 * Returns Bucharest local hour and minute. Handles the `hour: '24'` quirk seen on some Node
 * versions for midnight in 24-hour format.
 */
export function getBucharestHourMinute(d: Date): { hour: number; minute: number } {
  const parts = bucharestDateTimeFmt.formatToParts(d);
  let hour = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
  if (hour === 24) hour = 0;
  return { hour, minute };
}

/**
 * Formatter for display text — passes through to date-fns format(), but with the Date's
 * wall-clock components rebuilt from Bucharest local time. Output is independent of the
 * server's timezone (Cloud Run UTC, dev machine Bucharest, anything else).
 *
 * Pattern uses date-fns tokens: 'PPP' (long), 'PP' (medium), 'MMM d', 'HH:mm', etc.
 */
export function formatBucharestDateTime(d: Date, pattern: string): string {
  // Read Bucharest's wall-clock components, then build a Date whose LOCAL components match.
  // date-fns format() reads .getFullYear()/.getMonth()/etc., which are local-TZ methods, so the
  // formatted output now reflects Bucharest regardless of where this code runs.
  const parts = bucharestFullFmt.formatToParts(d);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)!.value, 10);
  let hour = get('hour');
  if (hour === 24) hour = 0;
  const local = new Date(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  // Lazy import to avoid pulling date-fns into modules that don't need formatting.
  const { format } = require('date-fns');
  return format(local, pattern);
}

const bucharestFullFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: PROPERTY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * Iterate the Bucharest-local calendar days a stay covers.
 * Yields { year, month, day, monthKey } for each "night" (check-in date through the day before checkout).
 */
export function* iterateBucharestStayDays(
  checkIn: Date,
  checkOut: Date
): Generator<{ year: number; month: number; day: number; monthKey: string }> {
  const startStr = formatBucharestDate(checkIn);
  const endStr = formatBucharestDate(checkOut);
  if (startStr >= endStr) return;
  // Step day-by-day using noon UTC as a safe anchor that won't drift under DST.
  let cur = new Date(`${startStr}T12:00:00Z`);
  while (true) {
    const curStr = formatBucharestDate(cur);
    if (curStr >= endStr) break;
    const [y, m, d] = curStr.split('-').map(Number);
    yield { year: y, month: m, day: d, monthKey: `${y}-${String(m).padStart(2, '0')}` };
    cur = new Date(cur.getTime() + 86400000);
  }
}
