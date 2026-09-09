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
  /**
   * Where instrument routing actually lives. NOT a copy of it.
   *
   * `situationAnalystMethod` already decides which instrument fits a window, and decides it better:
   * it reads the outreach and cancellation ledgers first, knows that instruments are not exclusive,
   * and can put a warm WhatsApp arm beside a cold ads push on the same window. A second copy of
   * those rules here — which is what this field used to hold — is a rule that will drift from the
   * one actually in force.
   *
   * The one thing kept is the fact the analyst cannot know: summer sells through the OTAs for this
   * property, so a summer window ranking top on value at risk is not an ads opportunity.
   */
  routing: { livesIn: string; note: string; seasonNotForAds: string };
  /** Demand that books on its own clock rather than `daysOut` from today. */
  bookingRhythms: Array<{ what: string; boughtWhen: string; forWhen: string }>;
  /** The order the owner works in when preparing a period. */
  cadence: Array<{ stage: string; when: string; what: string }>;
  /** Things that move parity for reasons the parity tools cannot see. */
  parityInteractions: string[];
  /** How the owner thinks about the money: days on air at a daily rate, not envelopes per window. */
  budgetModel: { dailyRon: number; annualRon: number; daysOnAir: number; why: string };
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

  routing: {
    livesIn: 'src/lib/growth/situationAnalystMethod.ts (mirrored in .claude/skills/situation-analyst)',
    note:
      'The analyst routes windows to instruments. Read pack.analystOpportunities before funding ' +
      'anything: a window it sent to whatsapp or page is not automatically an ads window, and one it ' +
      'sent to ads WITH a parallel warm arm should not be budgeted as if ads carried it alone.',
    seasonNotForAds:
      'Summer. People do plan it early, but "summer is mostly an OTA thing for us" (owner, ' +
      '2026-09-09), so a summer window ranking top on value at risk is not an ads opportunity. This ' +
      'is a fact about the business the analyst cannot read from the pack, which is why it stays here.',
  },

  bookingRhythms: [
    { what: 'the winter school break with children', boughtWhen: 'November', forWhen: 'mid-February' },
    { what: 'a ski holiday with children', boughtWhen: 'around January, after New Year', forWhen: 'the weeks that follow' },
  ],

  cadence: [
    { stage: 'set the rates', when: 'at least a year ahead', what: 'from the equivalent dates last year' },
    { stage: 'competition analysis', when: '4-5 months out', what: 'am I competitive against the comparable set' },
    { stage: 'OTA parity', when: 'after the competition analysis', what: 'how the DIRECT price should adapt to what the channels are charging' },
  ],

  budgetModel: {
    dailyRon: 15,
    annualRon: 4000,
    daysOnAir: 267,
    why:
      'Owner, 2026-09-09: "I imagine I\'m not running ads all the time, so 20 lei per day max ' +
      '(could be less)... If we are on 15 lei average this will be around 270 days." Think in days ' +
      'on air, not in a budget per window. 15 RON/day on 4,000 a year is 267 days — about one ' +
      '24-day flight a month, running near-continuously and rotating which window is being sold. ' +
      'This replaces the allocator\'s habit of treating whatever span it is handed as "the season" ' +
      'and spending the year\'s remaining money on it: asked for a 61-day horizon on 2026-09-09 it ' +
      'proposed 2,423 RON, 89% of what was left for the following twelve months.',
  },

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
