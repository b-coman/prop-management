/**
 * Who is still on sale, and who stopped being.
 *
 * This is the half of the engine that changes a decision, and the half his own instruments
 * structurally cannot see. A price comparison tells him he is cheap or dear. It cannot tell him
 * whether the window is empty because he is priced wrong or because nobody is travelling - and those
 * are opposite instructions. Absorption separates them, and it comes free with a page load already
 * being made for the price.
 *
 * THE HONESTY THIS DEMANDS, and it is most of the module:
 *
 *  - **A page that will not quote is NOT a sold-out page.** Dates taken, host-blocked, a seasonal
 *    close, a minimum stay, a listing paused - four of those are not demand.
 *  - **One reading means nothing.** `not-sellable` on a single observation is a state, never an event.
 *    Only a TRANSITION - priced, then not - is evidence that something sold, and it is always
 *    reported with both dates and the last price seen.
 *  - **A multi-unit property does not go off sale when it sells one unit.** It goes off sale when it
 *    sells every unit, which is rarer and later. Counting a park alongside single houses understates
 *    how much the market is selling, invisibly.
 *  - **No percentage sold, ever.** "5 of 7 sampled are no longer on sale" is a true sentence.
 *    "71% occupancy in the set" is not.
 *  - **A refusal DISCREDITS the prices read before it.** An adults-only bar or a child-age bar is a
 *    standing policy, not a state that changes between probes: if the property will not take this
 *    party today, the price we banked for this party last week was never on sale to them. Treating
 *    the refusal as merely uninformative left those prices standing, and the transition
 *    priced → refused → not-sellable then read as "it sold". Two such rows were enough to flip a
 *    window's headline from "the market is not selling" to "the market IS selling" - opposite
 *    instructions, from prices that never existed for this party (§29).
 *
 * PURE. Observations in, a verdict out. No clock - `now` is injected.
 */

/** What one stored observation says about sellability. Mirrors ObservationStatus, minus the price. */
export type SellState =
  /** A price was quoted. */
  | 'priced'
  /** The channel returned no quote. NOT "sold" - see the module note. */
  | 'not-sellable'
  /** The channel refused this PARTY (min stay, capacity, an age bar). Says nothing about demand. */
  | 'refused'
  /** The capture failed. Says nothing about anything. */
  | 'error';

export interface SellReading {
  at: string;              // ISO
  state: SellState;
  price: number | null;
  reason?: string;
}

export type AbsorptionVerdict =
  /** Priced at the latest reading. */
  | 'on-sale'
  /** Was priced, is not now. The only state that is evidence something SOLD. */
  | 'went-off-sale'
  /** Was not sellable, is priced again. A release, or a cancellation. */
  | 'came-back'
  /** Never seen priced across the readings we have. */
  | 'never-priced'
  /** One reading, or none that can be compared. */
  | 'single-reading'
  /** Every reading is a refusal or an error - nothing about demand can be said. */
  | 'no-signal';

export interface Absorption {
  verdict: AbsorptionVerdict;
  readings: number;
  /** Set only for `went-off-sale`: when it was last priced, at what, and when it stopped. */
  transition?: { lastPricedAt: string; lastPrice: number | null; goneBy: string };
  /** True when this listing sells several units, so its silence means ALL of them went. */
  multiUnit: boolean;
  /** Whether this reading may be counted toward "the market is selling". */
  countsAsDemandSignal: boolean;
  note: string;
}

export interface AbsorptionInput {
  readings: SellReading[];
  /** More than one bookable unit - changes what silence means. */
  multiUnit: boolean;
  now: Date;
  /** Readings older than this are ignored: a three-month-old state is not a comparison. */
  freshnessDays?: number;
}

export const DEFAULT_FRESHNESS_DAYS = 60;

export function readAbsorption(input: AbsorptionInput): Absorption {
  const { multiUnit, now } = input;
  const freshnessDays = input.freshnessDays ?? DEFAULT_FRESHNESS_DAYS;

  const fresh = input.readings
    .filter((r) => {
      const age = (now.getTime() - Date.parse(r.at)) / 86_400_000;
      return Number.isFinite(age) && age <= freshnessDays && age >= 0;
    })
    .sort((a, b) => a.at.localeCompare(b.at));

  const base = { readings: fresh.length, multiUnit };

  if (!fresh.length) {
    return { ...base, verdict: 'no-signal', countsAsDemandSignal: false,
             note: 'no readings inside the freshness window' };
  }

  // A refusal is not merely uninformative - it INVALIDATES what came before it. The property will not
  // take this party, which is a policy rather than a passing state, so any price we banked for this
  // party before the refusal was never a price this party could book. Only readings AFTER the last
  // refusal can say anything, and often that leaves nothing, which is the honest answer.
  const lastRefusal = fresh.map((r) => r.state).lastIndexOf('refused');
  const usable = lastRefusal === -1 ? fresh : fresh.slice(lastRefusal + 1);
  const refusalNote = lastRefusal === -1 ? ''
    : ' (a refusal in the series discarded every earlier reading: the property does not take this ' +
      'party, so those prices were never on sale to it)';

  // An error is a statement about the probe, not about demand.
  const informative = usable.filter((r) => r.state === 'priced' || r.state === 'not-sellable');
  if (!informative.length) {
    return { ...base, verdict: 'no-signal', countsAsDemandSignal: false,
             note: lastRefusal === -1
               ? `every reading is ${[...new Set(fresh.map((r) => r.state))].join('/')} - that is about the probe, not about demand`
               : `nothing usable survives the refusal${refusalNote}` };
  }

  const latest = informative[informative.length - 1];
  const everPriced = informative.some((r) => r.state === 'priced');

  if (informative.length === 1) {
    return {
      ...base,
      verdict: latest.state === 'priced' ? 'on-sale' : 'single-reading',
      countsAsDemandSignal: false,
      note: (latest.state === 'priced'
        ? 'priced, on one reading - nothing yet about whether it is selling'
        : 'NOT SELLABLE on a single reading. That is a state, not an event: it becomes evidence of ' +
          'selling only when an earlier reading had it priced.') + refusalNote,
    };
  }

  if (latest.state === 'priced') {
    const previous = informative[informative.length - 2];
    if (previous.state === 'not-sellable') {
      return { ...base, verdict: 'came-back', countsAsDemandSignal: false,
               note: 'was not sellable and is priced again - a release or a cancellation, not a sale' };
    }
    return { ...base, verdict: 'on-sale', countsAsDemandSignal: false, note: 'priced across the readings we have' };
  }

  // latest is not-sellable, and there is more than one informative reading.
  if (!everPriced) {
    return { ...base, verdict: 'never-priced', countsAsDemandSignal: false,
             note: 'never seen priced in this window - closed, blocked, or beyond a minimum we did not ' +
                   'meet. Not evidence of selling.' };
  }

  const lastPriced = [...informative].reverse().find((r) => r.state === 'priced')!;
  return {
    ...base,
    verdict: 'went-off-sale',
    transition: { lastPricedAt: lastPriced.at, lastPrice: lastPriced.price, goneBy: latest.at },
    // A park's silence means every unit went, which is a much stronger and much rarer event. It is
    // real evidence, but it must not be tallied beside single houses as if it were the same thing.
    countsAsDemandSignal: !multiUnit,
    note: multiUnit
      ? 'every unit went off sale between these readings - a stronger signal than a single house ' +
        'going, and a rarer one, so it is reported apart rather than counted alongside them'
      : 'was priced, then was not - the one state that is evidence something sold',
  };
}

export interface FieldAbsorption {
  /** Listings that went off sale between readings, single-unit only. */
  wentOffSale: Array<{ listingId: string; lastPrice: number | null; between: [string, string] }>;
  /** Multi-unit properties that sold out entirely. Reported apart, never pooled. */
  parksSoldOut: Array<{ listingId: string; between: [string, string] }>;
  stillOnSale: number;
  /** Listings with only one informative reading - the clock has not started for them. */
  tooEarly: number;
  noSignal: number;
  /** The honest headline. Never a percentage. */
  summary: string;
}

/** Roll per-listing verdicts into what can honestly be said about the window. */
export function summariseField(
  rows: Array<{ listingId: string; absorption: Absorption }>,
): FieldAbsorption {
  const wentOffSale = rows
    .filter((r) => r.absorption.verdict === 'went-off-sale' && !r.absorption.multiUnit)
    .map((r) => ({ listingId: r.listingId, lastPrice: r.absorption.transition!.lastPrice,
                   between: [r.absorption.transition!.lastPricedAt, r.absorption.transition!.goneBy] as [string, string] }));
  const parksSoldOut = rows
    .filter((r) => r.absorption.verdict === 'went-off-sale' && r.absorption.multiUnit)
    .map((r) => ({ listingId: r.listingId,
                   between: [r.absorption.transition!.lastPricedAt, r.absorption.transition!.goneBy] as [string, string] }));
  const stillOnSale = rows.filter((r) => r.absorption.verdict === 'on-sale' || r.absorption.verdict === 'came-back').length;
  const tooEarly = rows.filter((r) => r.absorption.verdict === 'single-reading'
    || (r.absorption.verdict === 'on-sale' && r.absorption.readings < 2)).length;
  const noSignal = rows.filter((r) => r.absorption.verdict === 'no-signal' || r.absorption.verdict === 'never-priced').length;

  const moved = wentOffSale.length + parksSoldOut.length;
  const parks = parksSoldOut.length
    ? `, and ${parksSoldOut.length} multi-unit propert${parksSoldOut.length === 1 ? 'y' : 'ies'} sold out entirely`
    : '';

  // The conclusion is scaled to the evidence. One transition is one booking: enough to know the
  // window is not dead, nowhere near enough to conclude that our own emptiness is a price problem.
  // The earlier version jumped straight from a single sale to "an empty week here is not a demand
  // problem" - which is an instruction to cut a price, drawn from n=1.
  const summary = moved === 0
    ? `Nothing in the set went off sale between readings; ${stillOnSale} still on sale. If this window ` +
      `is empty for us, the market is not selling it either.`
    : moved === 1
    ? `One property went off sale between readings${parks}; ${stillOnSale} still on sale. That is one ` +
      `booking, not a trend: enough to say the window is not dead, not enough to say our price is why ` +
      `it is empty for us. A third reading would tell you which.`
    : `${wentOffSale.length} of the set went off sale between readings${parks}; ${stillOnSale} still ` +
      `on sale. This window IS selling - so an empty week here is not a demand problem.`;

  return { wentOffSale, parksSoldOut, stillOnSale, tooEarly, noSignal, summary };
}
