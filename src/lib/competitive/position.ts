/**
 * Where the owner sits, on one window, in ONE channel's contest.
 *
 * C8 is the shape of this module: Airbnb and Booking are two separate fields, scored separately,
 * never pooled. A guest browsing Airbnb sees his Airbnb price beside other Airbnb listings, at a
 * price he sets separately from Booking's. A rank computed across both is a rank nobody experiences.
 *
 * Three things this refuses to do, each because the honest version is less flattering:
 *
 *  - **It does not rank the direct price.** Nobody browsing a channel sees it. It is carried as a
 *    reference line — it is the price he controls and wants booked — but it does not compete for a
 *    position it never appears in.
 *  - **It does not report a percentile.** With six to ten comparables that is false precision. Rank
 *    out of the number actually sampled, or nothing.
 *  - **It does not fold quality into price.** Rating sits beside the number. One flag fires, on a
 *    specific pair of listings, and only above a review floor — five of the nine Booking comparables
 *    score 9.5+, so score alone separates almost nothing and review count does the work.
 *
 * PURE. No I/O, no clock (`now` is injected). Prices come from `channelPriceObservations`; nothing
 * here reads or writes them.
 */
import type { PartyFit } from './set';

/** Below this many reviews a rating is UNMEASURED, which is different from low. */
export const REVIEW_FLOOR = 20;

/** Sample sizes at which a band and a rank become honest. */
export const CONFIDENCE = { indicative: 3, solid: 4 } as const;

export type Confidence = 'none' | 'indicative' | 'solid';

export interface CompetitorQuote {
  listingId: string;
  displayName: string;
  /**
   * Did a loyalty-programme discount apply to THIS price? Booking's Genius is per-property: some
   * comparables offer it, some do not, and the owner's own listing does. Comparing a member price
   * against anonymous ones is not like-for-like, and it flatters whichever side has the discount.
   */
  programApplied?: boolean;
  /** `captured` carries a total; anything else carries a reason and no number. */
  status: 'captured' | 'refused' | 'unavailable' | 'error';
  guestTotal: number | null;
  listTotal?: number | null;
  promoActive?: boolean;
  reason?: string;
  capturedAt: string;
  rating: number | null;
  reviewCount: number | null;
  largestUnit: number | null;
  /** The exact search or page URL the price was read from — it reproduces the reading. */
  url?: string;
  /** What the PAGE said it was quoting. Absent on rows captured before it was stored. */
  echo?: { checkIn?: string | null; checkOut?: string | null; nights?: number | null;
           adults?: number | null; children?: number | null; verified?: boolean };
}

export interface PositionInput {
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  partyLabel: string;
  channel: string;
  /** His own guest-facing total ON THIS CHANNEL. The only price that is ranked. */
  ourChannelPrice: number | null;
  /** His direct total for the same stay. Reference only — never ranked (see above). */
  ourDirectPrice: number | null;
  ourRating?: number | null;
  ourReviewCount?: number | null;
  /** Whether OUR captured channel price carries a programme discount (Booking Genius). */
  ourProgramApplied?: boolean;
  quotes: CompetitorQuote[];
  /** Comparables that cannot host this party at all. A finding, not a gap (C4). */
  outOfSet: Array<{ listingId: string; displayName: string; fit: PartyFit }>;
  /**
   * Comparables that COULD host this party and simply have not been read for this window.
   *
   * These must be passed in, because the alternative is what the first build did: drop them, and
   * print "4 of 7 quoted" for a Booking field of fifteen. That reads as near-complete coverage of a
   * market when it is under half of it, and it errs in the flattering direction — it is the same
   * mistake as treating unread capacity as a moat. An unread comparable is UNKNOWN, not absent.
   */
  unread?: Array<{ listingId: string; displayName: string }>;
  now: Date;
}

export interface Position {
  window: string;
  channel: string;
  partyLabel: string;
  confidence: Confidence;
  /**
   * How many comparables actually quoted, over how many were asked — plus how many of the field
   * nobody has asked yet, which is the number that decides whether the first two mean anything.
   */
  sample: { quoted: number; asked: number; unread: number; field: number; oldestAgeDays: number | null };
  band: { min: number; median: number; max: number } | null;
  /** Rank of his channel price among the quoted comparables plus himself. Null below the floor. */
  rank: { position: number; of: number } | null;
  ourChannelPrice: number | null;
  ourDirectPrice: number | null;
  /**
   * Sorted cheapest first, his own row included and marked.
   *
   * Each row carries what it takes to CHECK it: when it was read, the page's own statement of the
   * stay, and the URL that reproduces the search. The owner asked to be able to see the numbers
   * himself — so the evidence travels with the number rather than living in a log he cannot reach.
   */
  ladder: Array<{ listingId: string; name: string; total: number; isUs: boolean; promo: boolean;
                  rating: number | null; reviewCount: number | null;
                  listTotal?: number | null; capturedAt?: string; url?: string;
                  echo?: CompetitorQuote['echo'] }>;
  /** Comparables that did not quote, with the reason. Never silently dropped. */
  silent: Array<{ listingId: string; name: string; status: string; reason: string }>;
  outOfSet: Array<{ listingId: string; name: string; why: string }>;
  /** In the field, able to host this party, never read for this window. */
  unread: Array<{ listingId: string; name: string }>;
  flags: string[];
  notes: string[];
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function buildPosition(input: PositionInput): Position {
  const {
    checkIn, checkOut, nights, guests, partyLabel, channel,
    ourChannelPrice, ourDirectPrice, quotes, outOfSet, now,
  } = input;
  const unread = input.unread ?? [];

  const priced = quotes.filter((q) => q.status === 'captured' && typeof q.guestTotal === 'number');
  const silent = quotes
    .filter((q) => q.status !== 'captured')
    .map((q) => ({ listingId: q.listingId, name: q.displayName, status: q.status,
                   reason: q.reason ?? 'no reason recorded' }));

  const ages = quotes.map((q) => Math.floor((now.getTime() - Date.parse(q.capturedAt)) / 86_400_000))
    .filter((n) => Number.isFinite(n));
  const oldestAgeDays = ages.length ? Math.max(...ages) : null;

  const confidence: Confidence =
    priced.length >= CONFIDENCE.solid ? 'solid'
    : priced.length >= CONFIDENCE.indicative ? 'indicative'
    : 'none';

  const totals = priced.map((q) => q.guestTotal as number);
  // Below the floor the individual readings are still reported — a band and a rank are not.
  const band = confidence === 'none' ? null
    : { min: Math.min(...totals), median: median(totals), max: Math.max(...totals) };

  const ladder = [
    ...priced.map((q) => ({
      listingId: q.listingId, name: q.displayName, total: q.guestTotal as number,
      isUs: false, promo: !!q.promoActive, rating: q.rating, reviewCount: q.reviewCount,
      listTotal: q.listTotal ?? null, capturedAt: q.capturedAt, url: q.url, echo: q.echo,
    })),
    ...(ourChannelPrice !== null ? [{
      listingId: '(us)', name: 'US', total: ourChannelPrice, isUs: true, promo: false,
      rating: input.ourRating ?? null, reviewCount: input.ourReviewCount ?? null,
    }] : []),
  ].sort((a, b) => a.total - b.total);

  const rank = (confidence === 'none' || ourChannelPrice === null) ? null
    : { position: ladder.findIndex((r) => r.isUs) + 1, of: ladder.length };

  const flags: string[] = [];
  const notes: string[] = [];

  // The one checkable quality statement — a claim about a specific pair, not a model. Gated on the
  // review floor because a 5.0 from one review outranks nothing.
  if (ourChannelPrice !== null && input.ourRating != null) {
    for (const q of priced) {
      if (q.rating == null || q.reviewCount == null) continue;
      if (q.reviewCount < REVIEW_FLOOR) continue;
      if ((q.guestTotal as number) < ourChannelPrice
          && q.rating > (input.ourRating ?? 0)
          && q.reviewCount > (input.ourReviewCount ?? 0)) {
        flags.push(`priced above ${q.displayName} (${Math.round(q.guestTotal as number)} · ` +
                   `${q.rating} · ${q.reviewCount} reviews), which outranks you on both`);
      }
    }
  }

  // A programme discount is part of the OFFER, not a flaw in the measurement.
  //
  // An earlier version called this "NOT LIKE-FOR-LIKE" and said the position was "flattered". The
  // owner corrected it (2026-09-02) and he is right: captured from one signed-in session, these are
  // the prices that guest actually sees — ours discounted because our property offers Genius, Vila
  // Luna's not because theirs does not. That is a real difference in what is on sale, and hiding it
  // would understate an advantage rather than protect against one.
  //
  // What remains true and worth stating: the ORDER can differ for a guest who is not signed in. So
  // this is a note about who the ranking is for, never a correction to it — and it adjusts nothing.
  if (input.ourProgramApplied && priced.length) {
    const withProg = priced.filter((q) => q.programApplied === true).length;
    // Absent is UNMEASURED, not "no discount" — the search-page instrument cannot tell a Genius
    // discount from an ordinary promotion. Counting unknowns as absences would state as fact the
    // exact thing the capture declined to guess.
    const withoutProg = priced.filter((q) => q.programApplied === false).length;
    const unknown = priced.length - withProg - withoutProg;
    if (withProg < priced.length) {
      notes.push(
        `This ranking is as a signed-in member sees it. Our ${channel} price includes a loyalty ` +
        `discount; ` +
        (withoutProg ? `${withoutProg} of ${priced.length} comparables' prices demonstrably do not` : '') +
        (withoutProg && unknown ? `, and ` : '') +
        (unknown ? `${unknown} of ${priced.length} were read off the search page, which does not say ` +
                   `whether a discount is a loyalty one` : '') +
        `. A guest who is NOT signed in may see a different order.`);
    }
  }

  if (silent.length) {
    const gone = silent.filter((s) => s.status === 'unavailable');
    if (gone.length) {
      notes.push(
        `${gone.length} of ${quotes.length} ${gone.length === 1 ? 'is' : 'are'} not sellable on these ` +
        `dates (${gone.map((g) => g.name).join(', ')}). ` +
        `On ONE reading that is "not sellable", never "sold" — it becomes evidence of selling only if ` +
        `an earlier reading had it priced.`);
    }
  }
  if (outOfSet.length) {
    notes.push(
      `${outOfSet.length} comparable(s) cannot host ${partyLabel} at all — competition you do not face ` +
      `on this window, measured without a page load.`);
  }
  // Said before the confidence notes, because it changes what "solid" is solid ABOUT: four quotes out
  // of a field of fifteen is a firm reading of a third of the market, not a firm reading of the market.
  if (unread.length) {
    const field = quotes.length + outOfSet.length + unread.length;
    notes.push(
      `${unread.length} of the ${field} comparables on ${channel} have never been read for this window ` +
      `(${unread.map((u) => u.displayName).join(', ')}). The band and the rank are over the ` +
      `${priced.length} that quoted, not over the field — a comparable nobody asked is unknown, not absent.`);
  }
  if (confidence === 'indicative') {
    notes.push(`Only ${priced.length} comparables quoted. Band and rank are indicative, not settled.`);
  }
  if (confidence === 'none') {
    notes.push(
      `Fewer than ${CONFIDENCE.indicative} comparables quoted, so there is no band and no rank — ` +
      `the individual readings are reported and nothing is inferred from them.`);
  }

  return {
    window: `${checkIn} → ${checkOut} (${nights}n, ${guests}g)`,
    channel, partyLabel, confidence,
    sample: { quoted: priced.length, asked: quotes.length, unread: unread.length,
              field: quotes.length + outOfSet.length + unread.length, oldestAgeDays },
    band, rank, ourChannelPrice, ourDirectPrice, ladder, silent,
    outOfSet: outOfSet.map((o) => ({
      listingId: o.listingId, name: o.displayName,
      why: o.fit.kind === 'out-of-set' ? o.fit.reason : o.fit.kind,
    })),
    unread: unread.map((u) => ({ listingId: u.listingId, name: u.displayName })),
    flags, notes,
  };
}
