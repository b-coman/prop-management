/**
 * Is this iCal event a guest RESERVATION, or an OTA closing inventory?
 *
 * WHY THIS EXISTS. `otaBlockObservations` was built to answer "did an ad flight produce a booking".
 * On its first day live it recorded two Booking.com entries as reservations appearing:
 *
 *   20261231 → 20270103   "CLOSED - Not available"     3 nights
 *   20270906 → 20280311   "CLOSED - Not available"   551 nights
 *
 * Neither is a booking. Booking.com publishes its closed inventory as CLOSED blocks, and the far one
 * is simply "we are not selling past this horizon" — a conveyor that shifts forward as the horizon
 * moves, which is why the same UID appeared to jump six months between syncs. Counting those as
 * bookings would fill the store with phantom reservations and phantom cancellations, and the one
 * number the store exists to produce would be noise.
 *
 * A real reservation looks different: VRBO sends "Reserved - Carlon", Airbnb sends "Reserved". The
 * summary is the only signal the feed gives us, so the summary is what we read.
 *
 * WE SAY 'unknown' RATHER THAN GUESS. Channels change their wording without warning, and a silent
 * mis-label here is worse than an honest gap: 'blocked' would hide a real booking, 'reservation'
 * would invent one. Attribution counts 'reservation' only, so an unrecognised summary shows up as an
 * unclassified row somebody can look at, not as a number that silently moved.
 */

export type IcalEventKind = 'reservation' | 'blocked' | 'unknown';

/** Phrases OTAs use when they are closing inventory rather than reporting a stay. */
const BLOCKED = [
  /\bclosed\b/i,
  /\bnot available\b/i,
  /\bunavailable\b/i,
  /\bblocked\b/i,
  /\bnu\s+este\s+disponibil/i,
];

/** Phrases that name an actual stay. Airbnb: "Reserved". VRBO: "Reserved - <name>". */
const RESERVED = [
  /\breserved\b/i,
  /\bbooking\b(?!\.com)/i,
  /\bbooked\b/i,
  /\bguest\b/i,
  /\brezervare\b/i,
];

/**
 * Nights beyond which a "stay" is really inventory management. The longest genuine stay in this
 * property's 304-booking history is 16 nights; the Booking.com horizon block is 551. Anything past a
 * season is not somebody's holiday.
 */
export const MAX_PLAUSIBLE_STAY_NIGHTS = 60;

export function classifyIcalEvent(summary: string | undefined, nights: number): IcalEventKind {
  const s = (summary ?? '').trim();

  // Length overrides wording. A 551-night "Reserved" would still not be a holiday, and this is the
  // check that does not depend on a channel's choice of words.
  if (nights > MAX_PLAUSIBLE_STAY_NIGHTS) return 'blocked';

  if (BLOCKED.some((re) => re.test(s))) return 'blocked';
  if (RESERVED.some((re) => re.test(s))) return 'reservation';

  // Airbnb historically sent bare guest names with no keyword at all, so a non-empty summary that
  // matches nothing is genuinely ambiguous rather than obviously either.
  return 'unknown';
}
