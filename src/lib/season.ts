/**
 * Which season it currently is, for content that should change with it.
 *
 * Northern-hemisphere meteorological seasons (whole months), which is what a
 * Carpathian property actually experiences and, more practically, what a guest
 * browsing in November expects to see. Astronomical dates would put the 21st of
 * the month in the wrong bucket for a fortnight either side.
 *
 * The vocabulary matches AiImageDescription.season, so a seasonal photo slot and
 * the vision layer describe the same thing with the same word.
 */
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

const BY_MONTH: Season[] = [
  'winter', // Jan
  'winter', // Feb
  'spring', // Mar
  'spring', // Apr
  'spring', // May
  'summer', // Jun
  'summer', // Jul
  'summer', // Aug
  'autumn', // Sep
  'autumn', // Oct
  'autumn', // Nov
  'winter', // Dec
];

/**
 * Pass a date to make this testable; defaults to now.
 *
 * Called during SSR and again on the client. Both read the same month, so the
 * markup matches and hydration stays quiet. Only a request that straddles
 * midnight on the 1st could disagree, and the result there is a re-render, not
 * a broken page.
 */
export function currentSeason(date: Date = new Date()): Season {
  return BY_MONTH[date.getMonth()];
}
