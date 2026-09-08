/**
 * The canonical season rules — the commercial model, stored once and resolved to dates each year.
 *
 * Read this file to know what the property sells and when. It is version-controlled on purpose: a
 * change to the commercial model should be a diff you can argue with, not a row someone edited in a
 * console last February.
 *
 * **Layers, not tiles.** Backgrounds at priority 0 cover every day of the year by construction;
 * occasions at priority 100 carve into them. The previous hand-made table was 20 abutting rows, and
 * abutting rows leave holes nobody notices — 444 days of the 2026-2027 horizon had no period at
 * all, 90 of them inside the year the table was built for. A background cannot leave a hole.
 *
 * **Dates are never written here.** Anchors reference the seeded `holidays` collection by slug.
 * Easter moves by weeks, the school calendar is ministerial and published late, and Ziua Unirii is
 * a Saturday one year and a Sunday the next. Those are fetched facts; deriving them is how you get
 * them wrong.
 *
 * **A year here runs 1 September to 31 August**, the same boundary the ads ledger uses. That keeps a
 * festive season whole inside one year instead of splitting it across the New Year, and lets a
 * season plan and a price table name the same window. So the backgrounds below are listed in
 * SEASON order, starting with September.
 *
 * See `resolveYear.ts` for the anchor vocabulary and `scripts/verify-canonical.ts` for the proof
 * that these rules reproduce the live table.
 */
import type { SeasonRule, YearException } from '@/lib/pricing/resolveYear';

/**
 * Backgrounds. Priority 0, and between them they cover 1 Jan to 31 Dec with no gap.
 *
 * The `weekdayRate` values are absolute rates derived from OTA parity probes, not tier multiples —
 * see `scripts/apply-band-pricing.ts`. They do NOT carry forward safely: copying one into next year
 * freezes last year's parity position, so a generated draft must flag them for re-derivation.
 */
export const BACKGROUNDS: SeasonRule[] = [
  { slug: 'winter-low', name: 'Winter Low', anchor: { kind: 'calendar', from: '01-01', to: '04-09' }, tier: 'low', minStay: 2,
    note: 'January to early April is the weakest stretch of the year. The occasions inside it carry the season.' },
  { slug: 'spring', name: 'Spring', anchor: { kind: 'calendar', from: '04-10', to: '06-19' }, tier: 'low', minStay: 2,
    note: 'Easter, 1 Mai and Rusalii carve into this; the weeks between them sell like low season.' },
  { slug: 'summer', name: 'Summer', anchor: { kind: 'calendar', from: '06-20', to: '08-31' }, tier: 'high', minStay: 2,
    note: 'School holiday. Min stay stays at 2 — the owner\'s call: demand is there without the constraint.' },
  { slug: 'early-september', name: 'Early September', anchor: { kind: 'calendar', from: '09-01', to: '09-08' }, tier: 'low', weekdayRate: 430, minStay: 2,
    note: 'The week before school starts. Still sells on "before school", but no longer at summer rates.' },
  { slug: 'fall', name: 'Fall', anchor: { kind: 'calendar', from: '09-09', to: '10-22' }, tier: 'low', weekdayRate: 405, minStay: 2,
    note: 'Colours and quiet. The long-stay and remote-work window.' },
  { slug: 'late-fall', name: 'Late Fall', anchor: { kind: 'calendar', from: '10-23', to: '11-30' }, tier: 'min', weekdayRate: 405, minStay: 2,
    note: 'November is the weakest autumn month. The autumn break and the national day are its only anchors.' },
  { slug: 'early-winter', name: 'Early Winter', anchor: { kind: 'calendar', from: '12-01', to: '12-31' }, tier: 'min', weekdayRate: 384, minStay: 2,
    note: 'Dead until the festive window opens. Christmas and New Year carve the back half out of it.' },
];

/**
 * Occasions. Priority 100, so each one carves its dates out of whatever background it lands in.
 *
 * `minStay: 'auto'` asks `suggestedMinStay`, which reads the run of days off: three or more is a
 * long weekend and carries a three-night minimum, anything shorter carries two.
 */
export const OCCASIONS: SeasonRule[] = [
  { slug: 'russian-christmas', name: 'Russian Christmas', priority: 100, tier: 'base', minStay: 3,
    anchor: { kind: 'span', from: { holiday: 'vacanta-iarna', edge: 'end', offset: -7 }, to: { holiday: 'vacanta-iarna', edge: 'end' } },
    note: 'The last week of the winter school break. Christmas for Moldovan and Ukrainian Orthodox guests, and the break is still running for everyone else.' },

  { slug: 'ziua-unirii', name: 'Ziua Unirii', priority: 100, tier: 'medium', minStay: 'auto',
    anchor: { kind: 'holiday', slug: 'ziua-unirii', window: 'travel' },
    note: 'Resolves to nothing worth pricing in years when 24 January lands inside the weekend.' },

  /**
   * Anchored on the SCHOOL BREAK, not on the Easter weekend, and for the same reason Autumn Break is:
   * what the property sells here is a family window, and the family window is the break. The Easter
   * holiday itself is a 4-day window inside it. Priority 110 so it absorbs Labour Day in the years
   * the two collide — 1 May 2027 falls inside this break, and the seeded row says so.
   */
  { slug: 'vacanta-paste', name: 'Easter Break', priority: 110, tier: 'medium', minStay: 3,
    anchor: { kind: 'holiday', slug: 'vacanta-primavara', window: 'exact', shiftStart: -1, shiftEnd: -1 },
    certainty: 'provisional',
    note: 'A moveable feast wrapped in a ministerial break — both fetched from the seeded calendar, never computed.' },

  { slug: '1-mai', name: 'Labour Day', priority: 100, tier: 'high', minStay: 'auto',
    anchor: { kind: 'holiday', slug: 'ziua-muncii', window: 'travel' },
    note: 'In some years it is absorbed into the Easter window; the seeded row says which.' },

  { slug: 'rusalii-1-iunie', name: 'Pentecost + Children\'s Day', priority: 100, tier: 'high', minStay: 'auto',
    anchor: { kind: 'holiday', slug: 'rusalii', window: 'travel' },
    note: 'Pentecost is moveable and often meets Ziua Copilului — a family window.' },

  { slug: 'vacanta-toamna', name: 'Autumn Break', priority: 100, tier: 'medium', weekdayRate: 578, minStay: 3,
    anchor: { kind: 'holiday', slug: 'vacanta-toamna', window: 'exact', shiftStart: -1, shiftEnd: -1 },
    // The ministry publishes this late, but it has landed on the same shape every year on record —
    // the last full school week of October with the weekend either side (25 Oct-2 Nov 2025,
    // 24 Oct-1 Nov 2026). So an unpublished year is priced provisionally rather than left bare:
    // this is the strongest autumn window the property has.
    fallback: { kind: 'last-school-week', month: 10, padWeekend: true },
    certainty: 'provisional',
    note: 'A school break, not a run of days off, so its dates are taken as seeded. Shifted one day back at both ends: families leave the evening before and drive home on the last day.' },

  { slug: '1-decembrie', name: 'National Day', priority: 100, tier: 'medium', weekdayRate: 587, minStay: 'auto',
    anchor: { kind: 'holiday', slug: 'sf-andrei-ziua-nationala', window: 'travel' },
    note: 'Sfantul Andrei and Ziua Nationala are consecutive, so they make one window whose length depends entirely on the weekday they fall on.' },

  { slug: 'pre-christmas', name: 'Pre-Christmas', priority: 100, tier: 'base', minStay: 2,
    anchor: { kind: 'span', from: { rule: 'christmas', edge: 'start', offset: -5 }, to: { rule: 'christmas', edge: 'start', offset: -1 } },
    note: 'The five nights before the festive window opens. Defined against Christmas so it never drifts.' },

  { slug: 'christmas', name: 'Christmas', priority: 100, tier: 'base', fixedNightPrice: 1051, flatRate: true, minStay: 3,
    anchor: { kind: 'span', from: { holiday: 'craciun', edge: 'start', offset: -1 }, to: { holiday: 'craciun', edge: 'end', offset: 1 } },
    note: 'The departure evening before Christmas Day through the night after. A flat whole-house rate, so the occupancy ladder does not apply.' },

  { slug: 'new-year', name: 'New Year', priority: 100, tier: 'base', fixedNightPrice: 940, flatRate: true, minStay: 3,
    anchor: { kind: 'span', from: { rule: 'christmas', edge: 'end', offset: 1 }, to: { holiday: 'anul-nou', edge: 'end' } },
    premiumNights: { anchor: { holiday: 'anul-nou', edge: 'start' }, offsets: [-2, -1], price: 2351 },
    note: 'One commercial window from the day after Christmas to the end of the New Year holiday. The party premium on the nights around 31 December is a night profile, not a separate season.' },
];

export const SEASON_RULES: SeasonRule[] = [...BACKGROUNDS, ...OCCASIONS];

/**
 * Deliberate departures from the rules, per year.
 *
 * An exception records a decision the rules cannot generate. It is NOT a place to bend the rules
 * until they round-trip — every entry needs a reason a person would recognise as a business
 * decision, and a growing list for the same rule means the rule is wrong.
 */
const HAND_DRAWN_2026 =
  'Drawn by hand in February 2026, before the rules existed, and already in the past. The rule is ' +
  'the canon from 2027 on; this records what 2026 actually charged rather than pretending the rule ' +
  'produced it.';

export const SEASON_EXCEPTIONS: YearException[] = [
  // The four windows the 2026 table drew to a different convention than the one National Day,
  // Christmas, New Year, Autumn Break and Russian Christmas all follow. Each ran later than the
  // travel window and carried a 2-night minimum where the long-weekend rule asks for 3.
  { year: 2026, slug: 'ziua-unirii', reason: HAND_DRAWN_2026, patch: { endDate: '2026-01-26' } },
  { year: 2026, slug: 'vacanta-paste', reason: HAND_DRAWN_2026, patch: { startDate: '2026-04-10', endDate: '2026-04-20', minStay: 2, priority: 100 } },
  { year: 2026, slug: '1-mai', reason: HAND_DRAWN_2026, patch: { startDate: '2026-05-01', endDate: '2026-05-03', minStay: 2 } },
  { year: 2026, slug: 'rusalii-1-iunie', reason: HAND_DRAWN_2026, patch: { endDate: '2026-06-01', minStay: 2 } },
];
