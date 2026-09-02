/**
 * Turning per-window positions into a board the owner can read in ten seconds.
 *
 * WHY THIS MODULE EXISTS. The first market screen showed, per window, a ladder of prices with our own
 * row marked. Every number on it was correct and the owner could not use it: *"can't understand easy
 * and fast my property position against competition"*. The December capture showed why, and it is not
 * a layout problem.
 *
 * > 30 Dec – 2 Jan: you 7,243 on Booking, **dearest of 4**.
 *
 * True, and the opposite of what it looks like. Ten of the thirteen party-eligible comparables had
 * nothing left. The three still quoting were the remainder nobody had booked, so being top of that
 * ladder is not evidence of being overpriced — it is close to evidence of the reverse. A rank on its
 * own is not just incomplete, it points the wrong way.
 *
 * **So the unit here is two axes, never one:**
 *
 * |            | most of the field GONE            | field still OPEN                  |
 * |------------|-----------------------------------|-----------------------------------|
 * | you dear   | dearest of what is left — fine    | EXPOSED — real choice, you're dear|
 * | you cheap  | LEFT MONEY — in-demand window     | cheap and still quiet — demand    |
 *
 * The bottom-left is the money leak the ladder screen would have shown as "good news, you are the
 * cheapest". The top-left is the false alarm it showed on New Year. Same numbers, opposite actions.
 *
 * **Scarcity is readable from ONE capture.** How many of the field are on sale *right now* is a
 * state, not an event, so it needs no second reading — unlike absorption (`absorption.ts`), which
 * asks whether that share CHANGED and needs two. That is why this board works on a first capture and
 * absorption sharpens it later rather than gating it.
 *
 * WHAT IT REFUSES TO DO. It never suggests a price. It names which of the four states a window is in
 * and what that state means; the decision stays the owner's (C2). And below three quotes it says so
 * and ranks nothing, because a "position" against two comparables is a number pretending to be one.
 *
 * PURE. Rows in, ranked rows out. No I/O, no clock.
 */

/** Gap to the field median, beyond which we call it dear or cheap rather than level. */
export const LEVEL_BAND_PCT = 10;

/**
 * Share of the party-eligible field still quoting.
 *
 * Below TIGHT the field on offer is a remainder rather than a market, and a rank inside it says more
 * about who is left than about us. Above OPEN there is real choice and a rank means what it looks
 * like. Between them, neither reading is safe on its own, which is what `mixed` records.
 */
export const SCARCITY = { tight: 0.4, open: 0.75 } as const;

/** Below this many quotes there is no band and no rank — the same floor `position.ts` enforces. */
export const MIN_QUOTES = 3;

/**
 * A gap this large is worth attention whatever the scarcity band says.
 *
 * The verdict was built on position × scarcity alone, which made it blind to MAGNITUDE — and on the
 * live board that produced a visible absurdity: 22-28 Sep on Airbnb sat grey at −60% beside a red
 * −38%, because 3-of-7 lands a single point above the "tight" threshold. The bigger gap looked
 * calmer. A threshold that turns a 60% gap quiet is measuring the wrong thing.
 *
 * This does not override the two axes; it stops them silencing an outlier. A cheap-and-open window
 * is still a demand story, not a price one — but at this distance from the field it is a story worth
 * being told about, so the row escalates to `watch` rather than to `act`.
 */
export const LOUD_GAP_PCT = 35;

export type Position = 'dear' | 'level' | 'cheap' | 'unknown';
export type Scarcity = 'tight' | 'mixed' | 'open' | 'unknown';
export type Attention = 'act' | 'watch' | 'ok' | 'thin';

export interface BoardRowInput {
  key: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  partyLabel: string;
  channel: string;
  channelLabel: string;
  /** Our guest-facing total on THIS channel. The only price that is ranked. */
  ourPrice: number | null;
  /** Our direct total for the same stay. Context, never ranked. */
  ourDirect: number | null;
  /** Median of the comparables that quoted. Null below the floor. */
  fieldMedian: number | null;
  fieldMin: number | null;
  fieldMax: number | null;
  /** Comparables that gave a price. */
  quoted: number;
  /** Comparables that COULD host this party — the honest denominator. */
  eligible: number;
  /** Eligible, asked, and not on sale. */
  nothingLeft: number;
  /** Cannot host this party at all. Competition we do not face; never in the denominator. */
  cantHost: number;
  /** Eligible but never read for this window. Unknown, and it weakens every share below. */
  unread: number;
  oldestAgeDays: number | null;
  /** Nights of this window already booked for us. A sold window needs no pricing decision. */
  soldNights: number;
  /** Someone in the field went off sale between readings. Only ever true with 2+ readings. */
  movedSinceLastReading: number;
}

export interface BoardRow extends BoardRowInput {
  /** Our price against the field median, in percent. The one number that scans across windows. */
  gapPct: number | null;
  /** Dearer than every comparable that quoted — crisper than a median on a field of three. */
  aboveAll: boolean;
  onSaleShare: number | null;
  position: Position;
  scarcity: Scarcity;
  attention: Attention;
  /** Two or three words, for the column. */
  label: string;
  /** One sentence, for the reader who stops on the row. */
  why: string;
  /** What is riding on this window: our direct price for the nights still unsold. */
  atStake: number;
  fullySold: boolean;
}

const pct = (a: number, b: number) => ((a - b) / b) * 100;

function classify(row: BoardRowInput): { position: Position; scarcity: Scarcity; gapPct: number | null } {
  const gapPct = row.ourPrice !== null && row.fieldMedian ? pct(row.ourPrice, row.fieldMedian) : null;

  const position: Position =
    row.quoted < MIN_QUOTES || gapPct === null ? 'unknown'
    : gapPct > LEVEL_BAND_PCT ? 'dear'
    : gapPct < -LEVEL_BAND_PCT ? 'cheap'
    : 'level';

  // Scarcity is a BOUND, not a point, because unread comparables could be on sale or gone and we do
  // not know which. Take the worst and best cases; if they land in different bands the honest answer
  // is `unknown`, not the flattering end of the range.
  //
  // This is not hypothetical. The Airbnb reading for 22-28 Sep was 3 quoted, 0 known gone, 4 never
  // read — and a point estimate of 3/3 called the market OPEN, which would have turned a window
  // where we are 60% under the field into "cheap and quiet, it is a demand problem". The bounds are
  // 3/7 and 7/7: mixed to open, so nothing can be concluded until those four are probed.
  const field = row.quoted + row.nothingLeft + row.unread;
  const band = (share: number): Scarcity =>
    share < SCARCITY.tight ? 'tight' : share > SCARCITY.open ? 'open' : 'mixed';
  const worst = field > 0 ? row.quoted / field : null;
  const best = field > 0 ? (row.quoted + row.unread) / field : null;
  const scarcity: Scarcity =
    worst === null || best === null ? 'unknown'
    : band(worst) === band(best) ? band(worst)
    : 'unknown';
  // The share we DISPLAY stays the measured one — what quoted, of what was actually asked.
  const asked = row.quoted + row.nothingLeft;
  const share = asked > 0 ? row.quoted / asked : null;
  void share;

  return { position, scarcity, gapPct };
}

/**
 * The verdict. Nine cells, and only two of them are worth interrupting him for.
 *
 * The asymmetry is deliberate: an owner who is told everything is urgent stops reading, and the whole
 * complaint that produced this module was that the screen did not separate signal from listing.
 */
function verdict(row: BoardRowInput, position: Position, scarcity: Scarcity, aboveAll: boolean,
                 gapPct: number | null): { attention: Attention; label: string; why: string } {

  if (row.quoted < MIN_QUOTES) {
    return {
      attention: 'thin', label: 'Too thin',
      why: `Only ${row.quoted} comparable${row.quoted === 1 ? '' : 's'} quoted - no rank, and nothing ` +
           `inferred from ${row.quoted === 1 ? 'it' : 'them'}.` +
           (row.nothingLeft ? ` ${row.nothingLeft} of the field had nothing left, which is itself the finding.` : ''),
    };
  }

  // A window already booked out is history, not a decision. It stays on the board because seeing what
  // a sold window looked like is how you price the next one, but it never asks for attention.
  if (row.soldNights >= row.nights) {
    return { attention: 'ok', label: 'Sold',
             why: 'Already booked for us - nothing to decide here, but worth remembering what the field looked like.' };
  }

  if (position === 'cheap' && scarcity === 'tight') {
    return {
      attention: 'act', label: 'Left money',
      why: `Only ${row.quoted} of ${row.quoted + row.nothingLeft} comparables are still on sale, and ` +
           `you are the cheap one among them. A window this picked-over is in demand, and you are ` +
           `priced as though it were not.`,
    };
  }

  if (position === 'dear' && scarcity === 'open') {
    return {
      attention: 'watch', label: 'Exposed',
      why: `${row.quoted} of ${row.quoted + row.nothingLeft} comparables are still bookable, so a guest ` +
           `has real choice${aboveAll ? ' - and every one of them is cheaper than you' : ''}. This is ` +
           `the case where being dear actually costs you.`,
    };
  }

  if (position === 'dear' && scarcity === 'tight') {
    return {
      attention: 'ok', label: 'Cleared above you',
      why: `Most of the field is gone - only ${row.quoted} of ${row.quoted + row.nothingLeft} still on ` +
           `sale. You are dearest of what REMAINS, which is the leftovers, not the market. That is not ` +
           `evidence you are overpriced; if anything it is the reverse.`,
    };
  }

  if (position === 'cheap' && scarcity === 'open') {
    return {
      attention: 'ok', label: 'Cheap, market quiet',
      why: `You are below the field and most of the field is still bookable. Cheapness is not buying ` +
           `you anything here - an empty week on this window is a demand problem, not a price one.`,
    };
  }

  // Scarcity unknown means the unread ones decide it, so say that rather than guessing a quadrant.
  if (scarcity === 'unknown' && row.unread > 0) {
    const far = gapPct !== null && Math.abs(gapPct) >= LOUD_GAP_PCT;
    return {
      // A gap this size is worth a look even while the market state is undecidable — but the advice
      // stays "probe first", because the unread comparables are what decide whether it costs anything.
      attention: far ? 'watch' : 'ok',
      label: position === 'dear' ? `${far ? 'Far above' : 'Above'} the field, coverage thin`
           : position === 'cheap' ? `${far ? 'Far below' : 'Below'} the field, coverage thin`
           : 'In line, coverage thin',
      why: `${row.quoted} quoted and ${row.unread} never read, so whether this window has largely sold ` +
           `or is wide open is not yet decidable - and that is what decides whether being ` +
           `${position === 'cheap' ? 'cheap here costs you money or nothing' : 'dear here matters'}. ` +
           `Probe the ${row.unread} before acting.`,
    };
  }

  // Magnitude, before the middle-ground labels swallow it. See LOUD_GAP_PCT.
  //
  // Deliberately does NOT reach an OPEN market: cheap-and-open is a demand story and stays one at any
  // distance — if every comparable is bookable and nobody is booking, being further below them is not
  // the lever. `unknown` is handled above, where the honest advice is to probe before acting.
  if (gapPct !== null && Math.abs(gapPct) >= LOUD_GAP_PCT
      && scarcity !== 'open' && scarcity !== 'unknown') {
    const under = gapPct < 0;
    return {
      attention: 'watch',
      label: under ? 'Far below the field' : 'Far above the field',
      why: `${Math.abs(Math.round(gapPct))}% ${under ? 'below' : 'above'} the field median - too far ` +
           `to explain by position alone, whatever the scarcity band says. ${row.quoted} of ` +
           `${row.quoted + row.nothingLeft} comparables are still bookable, so this is not a cleared ` +
           `market; it is a gap worth understanding before the window gets closer.`,
    };
  }

  if (position === 'unknown') {
    return { attention: 'thin', label: 'No price of ours',
             why: `${row.quoted} comparables quoted, but we have no captured price on ${row.channelLabel} ` +
                  `for this stay - so there is nothing to place among them.` };
  }

  const onSale = `${row.quoted} of ${row.quoted + row.nothingLeft} still bookable`;

  if (scarcity === 'tight') {
    return { attention: 'ok', label: `Cleared, you're level`,
             why: `In line with the ${row.quoted} still on sale, and most of the field has gone. Nothing to fix.` };
  }

  // The middle ground. It is deliberately NOT "In line" for a price that is not: an earlier version
  // fell every mixed-scarcity row through to that label, and the October Airbnb row rendered a 48%
  // gap beside the word "In line". A screen that contradicts its own number in the same row is worse
  // than one that says nothing, because the reader stops believing the rest of it.
  if (position === 'dear') {
    return { attention: 'ok', label: 'Above the field',
             why: `You are above the field median with ${onSale}. Not enough choice left to call this ` +
                  `exposed, not scarce enough to call it cleared - a window to re-read rather than to act on.` };
  }
  if (position === 'cheap') {
    return { attention: 'ok', label: 'Below the field',
             why: `You are below the field median with ${onSale}. Whether that is a bargain you are ` +
                  `giving away depends on which way the field moves next, so it wants a second reading.` };
  }

  return { attention: 'ok', label: 'In line',
           why: `Within ${LEVEL_BAND_PCT}% of the field median, with ${onSale}.` };
}

/**
 * Sort weight. `thin` sits LAST, below `ok`.
 *
 * It used to sit above it, which put 23 rows that refuse to say anything — "Too thin", "No price of
 * ours" — at the top of the board, ahead of quiet findings that had something to report. Forty per
 * cent of the screen was refusals styled as findings. A row that declines to rank is the least
 * urgent thing on the page, not the third most.
 */
const RANK: Record<Attention, number> = { act: 0, watch: 1, ok: 2, thin: 3 };

/**
 * Build the board, most consequential first.
 *
 * Ordering is attention, then money — the same rule the year board uses, because "what should I look
 * at" is answered by how much is riding on it, not by which date comes first.
 */
export function buildBoard(rows: BoardRowInput[]): BoardRow[] {
  return rows
    .map((row): BoardRow => {
      const { position, scarcity, gapPct } = classify(row);
      const aboveAll = row.ourPrice !== null && row.fieldMax !== null && row.ourPrice > row.fieldMax;
      const v = verdict(row, position, scarcity, aboveAll, gapPct);
      const asked = row.quoted + row.nothingLeft;
      const unsoldNights = Math.max(0, row.nights - row.soldNights);
      return {
        ...row,
        gapPct, aboveAll,
        onSaleShare: asked > 0 ? row.quoted / asked : null,
        position, scarcity,
        attention: v.attention, label: v.label, why: v.why,
        // Pro-rated by the nights still unsold: a window half booked has half the decision riding on it.
        atStake: row.ourDirect !== null && row.nights > 0
          ? Math.round((row.ourDirect * unsoldNights) / row.nights) : 0,
        fullySold: row.soldNights >= row.nights,
      };
    })
    .sort((a, b) => RANK[a.attention] - RANK[b.attention]
      || b.atStake - a.atStake
      || a.checkIn.localeCompare(b.checkIn));
}

export interface BoardSummary {
  windows: number;
  channelReadings: number;
  act: number;
  watch: number;
  /** The plain-English headline. Never a percentage of a market we did not read. */
  headline: string;
}

/**
 * Count WINDOWS, not contests.
 *
 * The headline used to say "10 where you are cheap in a market that has largely sold" while counting
 * rows — and those ten rows were seven windows, because the same window fires at two party sizes. He
 * read ten problems where he had seven decisions. A decision is a window; a contest is evidence for
 * one.
 */
export function summariseBoard(rows: BoardRow[]): BoardSummary {
  // A DATE-window, not `key` — `key` carries the party, so counting it said "29 windows" for the
  // thirteen date ranges actually read. Three parties on one stay is one set of dates to decide about.
  const dates = (r: BoardRow) => `${r.checkIn}|${r.checkOut}`;
  const windowsOf = (level: Attention) =>
    new Set(rows.filter((r) => r.attention === level).map(dates)).size;
  const windows = new Set(rows.map(dates)).size;
  const act = windowsOf('act');
  const watch = windowsOf('watch');

  const headline =
    !rows.length ? 'Nothing captured yet.'
    : act + watch === 0
      ? `${windows} window${windows === 1 ? '' : 's'} read across ${rows.length} channel contest${rows.length === 1 ? '' : 's'}. ` +
        `Nothing is out of line - no window is both mispriced and facing real competition.`
      : `${windows} window${windows === 1 ? '' : 's'} read. ` +
        [act && `${act} where you are cheap in a market that has largely sold`,
         watch && `${watch} where you are dear and buyers still have choice`]
          .filter(Boolean).join(', ') + '.';

  return { windows, channelReadings: rows.length, act, watch, headline };
}
