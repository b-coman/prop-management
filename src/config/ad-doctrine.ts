/**
 * How the owner actually sells, in his own terms — the constraints a season plan must respect.
 *
 * This is BUSINESS doctrine, not method, which is why it is here and not in the season-ad-planner
 * skill: that file is method-only and says so, and every finding it makes must come from the pack in
 * front of it. So the doctrine goes INTO the pack. A constraint that depends on someone remembering
 * to pass `--start`/`--end` is a constraint that will be forgotten, and the first full-year run
 * proved it — the allocator put its largest slice, 466 RON, on Summer 2027 at 284 days out, in the
 * season the owner sells through the OTAs anyway. It ranked by value at risk because value at risk
 * was all it had.
 *
 * Stated by the owner 2026-09-09. Version-controlled so a change to how the business works is a
 * diff someone can argue with.
 */

export interface AdDoctrine {
  /** Plan for stays this many days out. Nearer than `minDaysOut` is a different instrument entirely. */
  horizon: { minDaysOut: number; maxDaysOut: number; why: string };
  /** Seasons where paid social is the wrong tool, and what is right instead. */
  channelFit: Array<{ when: string; instrument: string; why: string }>;
  /** Demand that books on its own clock rather than `daysOut` from today. */
  bookingRhythms: Array<{ what: string; boughtWhen: string; forWhen: string }>;
  /** The order the owner works in when preparing a period. */
  cadence: Array<{ stage: string; when: string; what: string }>;
  /** Things that move parity for reasons the parity tools cannot see. */
  parityInteractions: string[];
}

export const AD_DOCTRINE: AdDoctrine = {
  horizon: {
    minDaysOut: 30,
    maxDaysOut: 90,
    why:
      'A flight is a cold phase then a retargeting phase, and that takes weeks — so a window under ' +
      'about 30 days out cannot be bought properly. Past 90 days, people simply are not planning ' +
      'these stays yet: "people doesn\'t plan those off-season escapes too early." On 9 September ' +
      'that means selling October, November and perhaps early December.',
  },

  channelFit: [
    {
      when: 'summer',
      instrument: 'OTA, not paid social',
      why:
        'People do plan summer early, but "summer is mostly an OTA thing for us". Ranking it top ' +
        'because it carries the most value at risk mistakes where the demand comes from.',
    },
    {
      when: 'a gap about a month away or nearer',
      instrument: 'WhatsApp to past Romanian guests',
      why:
        'Too close to build a cold audience and retarget it. The people who already know the place ' +
        'are the only ones who can decide that fast.',
    },
    {
      when: 'a window with very poor OTA activity',
      instrument: 'an OTA promotion, historically Booking.com',
      why:
        'The owner has used this successfully before. It is a channel action, not an ad one — but ' +
        'it moves parity (see parityInteractions).',
    },
  ],

  bookingRhythms: [
    { what: 'the winter school break with children', boughtWhen: 'November', forWhen: 'mid-February' },
    { what: 'a ski holiday with children', boughtWhen: 'around January, after New Year', forWhen: 'the weeks that follow' },
  ],

  cadence: [
    { stage: 'set the rates', when: 'at least a year ahead', what: 'from the equivalent dates last year' },
    { stage: 'competition analysis', when: '4-5 months out', what: 'am I competitive against the comparable set' },
    { stage: 'OTA parity', when: 'after the competition analysis', what: 'how the DIRECT price should adapt to what the channels are charging' },
  ],

  parityInteractions: [
    'An OTA promotion lowers that channel\'s guest price, so direct must come down a little too or it ' +
      'reads as the expensive option. Expect a parity re-check after any promotion, and do not treat ' +
      'the resulting gap as a pricing defect — it is the promotion working.',
  ],
};

/** The stay window a plan made today should cover, per the horizon doctrine. */
export function doctrineHorizon(today: string): { start: string; end: string } {
  const at = (days: number) =>
    new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  return { start: at(AD_DOCTRINE.horizon.minDaysOut), end: at(AD_DOCTRINE.horizon.maxDaysOut) };
}
