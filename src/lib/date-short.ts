/**
 * Short dates, written the way the reader writes them.
 *
 * TWO THINGS date-fns gets wrong for this audience, both of them visible on the phone:
 *
 *   1. ORDER. `format(d, 'MMM d')` yields "sep 10". Romanian puts the day first - "10 sep" - and the
 *      booking page was showing the reversed form in its most-read element, the collapsed date strip.
 *   2. SEPTEMBER. date-fns's `ro` locale abbreviates every month to three letters, so septembrie
 *      becomes "sep". The conventional Romanian abbreviation is "sept."; the rest of its table already
 *      matches (ian, feb, mar, apr, mai, iun, iul, aug, oct, noi, dec), so this differs in one month
 *      only - which is exactly the month this property is currently selling.
 *
 * English keeps "MMM d" (Sep 10), which is right for it.
 */
import { format } from 'date-fns';

/** Conventional Romanian month abbreviations. Only `sept` differs from date-fns's `ro` table. */
const RO_SHORT_MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sept', 'oct', 'noi', 'dec'];

/** "10 sept" in Romanian, "Sep 10" in English. */
export function formatShortDate(date: Date, lang: string): string {
  if (lang === 'ro') return `${date.getDate()} ${RO_SHORT_MONTHS[date.getMonth()]}`;
  return format(date, 'MMM d');
}
