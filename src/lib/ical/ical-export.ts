/**
 * @fileoverview Core logic for generating iCal (.ics) exports from availability data.
 * Generates VCALENDAR with VEVENT blocks for blocked/booked dates.
 * Excludes externally-sourced blocks to prevent circular sync.
 */

import ical, { ICalCalendarMethod, ICalEventTransparency } from 'ical-generator';
import type { Availability } from '@/types';

interface BlockedRange {
  start: Date; // Inclusive
  end: Date;   // Exclusive (iCal DTEND for all-day events)
}

/**
 * Generates an iCal string from availability documents.
 * Only includes dates blocked by our own bookings/holds/manual blocks.
 * Dates only in externalBlocks are excluded to prevent circular sync.
 */
export function generateICalExport(
  propertyId: string,
  propertyName: string,
  availabilityDocs: Availability[]
): string {
  const calendar = ical({
    name: `${propertyName} - Availability`,
    prodId: { company: 'RentalSpot', product: 'Calendar Sync' },
    method: ICalCalendarMethod.PUBLISH,
  });

  const blockedDates = collectBlockedDates(availabilityDocs);
  const ranges = consolidateIntoRanges(blockedDates);

  for (const range of ranges) {
    const startStr = formatDateYYYYMMDD(range.start);
    calendar.createEvent({
      start: range.start,
      end: range.end,
      allDay: true,
      summary: `Blocked - ${propertyName}`,
      id: `rentalspot-${propertyId}-${startStr}@rentalspot.app`,
      transparency: ICalEventTransparency.OPAQUE,
    });
  }

  return calendar.toString();
}

/**
 * Collects all dates that are blocked by our own system (not external).
 * A date is "our own block" if available[day] === false AND the day is NOT
 * tracked in externalBlocks (or is also in holds, meaning it's our booking).
 */
function collectBlockedDates(docs: Availability[]): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  for (const doc of docs) {
    if (!doc.month || !doc.available) continue;

    const [year, monthIndex] = doc.month.split('-').map(Number);
    if (isNaN(year) || isNaN(monthIndex)) continue;
    const month = monthIndex - 1; // JS month is 0-indexed

    for (const dayStr of Object.keys(doc.available)) {
      const day = parseInt(dayStr, 10);
      if (isNaN(day)) continue;
      if (doc.available[day] !== false) continue;

      // Skip dates that are ONLY from external sources
      const isExternalOnly =
        doc.externalBlocks?.[day] &&
        !doc.holds?.[day]; // If it also has a hold, it's ours too

      if (isExternalOnly) continue;

      const date = new Date(Date.UTC(year, month, day));
      // Only export today or future, sanity check the date
      if (date >= todayUtc && date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
        dates.push(date);
      }
    }
  }

  // Sort chronologically
  dates.sort((a, b) => a.getTime() - b.getTime());
  return dates;
}

/**
 * Consolidates individual blocked dates into consecutive ranges.
 * E.g., [Jan 1, Jan 2, Jan 3, Jan 5] → [{Jan 1-4}, {Jan 5-6}]
 * End dates are exclusive (iCal convention for all-day events).
 */
function consolidateIntoRanges(dates: Date[]): BlockedRange[] {
  if (dates.length === 0) return [];

  const ranges: BlockedRange[] = [];
  let rangeStart = dates[0];
  let prevDate = dates[0];

  for (let i = 1; i < dates.length; i++) {
    const curr = dates[i];
    const diffMs = curr.getTime() - prevDate.getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);

    if (diffDays === 1) {
      // Consecutive day, extend range
      prevDate = curr;
    } else {
      // Gap found, close previous range and start new one
      ranges.push({
        start: rangeStart,
        end: addDays(prevDate, 1), // Exclusive end
      });
      rangeStart = curr;
      prevDate = curr;
    }
  }

  // Close the last range
  ranges.push({
    start: rangeStart,
    end: addDays(prevDate, 1),
  });

  return ranges;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
