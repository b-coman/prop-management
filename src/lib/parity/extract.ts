/**
 * Reading a price off an OTA page, as a PURE function of the page's text.
 *
 * Until now every OTA number in this system was read by a human eye and retyped into a CLI. That is
 * why a full parity run costs an afternoon and has happened three times. This module is the half of
 * the capture loop that can be tested: text in, a structured verdict out, no I/O, no browser.
 *
 * Three rules shape everything here:
 *
 *  1. **Refuse rather than guess.** Every function can return `null`/`ok:false`. A page that did not
 *     render, a currency we did not expect, a layout that changed — all of those must produce an
 *     outcome the loop records as `error`, never a plausible-looking number. The store already has
 *     four observations where a USD figure was labelled RON; nothing downstream could tell.
 *
 *  2. **Echo the probe back.** Airbnb is a client-side router: navigating between date ranges
 *     re-renders in place, and across ~100 sequential captures a stale render is close to certain.
 *     So the parser extracts the dates and guest count the PAGE claims, and the caller must compare
 *     them with what it asked for. This is the single highest-value check in the loop.
 *
 *  3. **Say which offer it is.** Booking sells this property's peak windows non-refundable, and its
 *     apparent discount there is really the flexible/non-refundable gap. A number without its rate
 *     plan is not comparable.
 */

export type Channel = 'airbnb' | 'booking.com';

export interface ExtractedPrice {
  /** Guest-facing total for the whole stay, in the page's currency. */
  total: number;
  /** Struck-through original, when the page shows one. */
  listTotal: number | null;
  currency: string;
  promoActive: boolean;
  ratePlan: 'flexible' | 'non-refundable' | 'unknown';
  /** What the PAGE says it is quoting — the caller must reconcile these with the probe. */
  echo: { nights: number | null; guests: number | null; checkIn: string | null; checkOut: string | null };
  /** True when the page is telling us a cheaper price exists behind a login. */
  needsSignIn: boolean;
  /** Short slice of the source text, stored with the observation so a bad parse stays fixable. */
  excerpt: string;
}

export type ExtractResult =
  | { ok: true; value: ExtractedPrice }
  | { ok: false; reason: string; excerpt: string };

/** Page states that are an OUTCOME, not a failure — the loop records them and moves on. */
export type PageState =
  | 'priced'
  | 'no-availability'
  | 'min-stay'
  | 'bot-check'
  | 'not-loaded'
  /**
   * The page rendered, the dates were applied, and the channel still returns no quote — Airbnb shows
   * "Add dates for prices" with the range already set. Seen live on 2026-10-24 (3 nights), a window
   * where a 4-night minimum was separately recorded. It is a REFUSAL by the channel, not a parse
   * failure, and it must not be confused with `not-loaded`.
   *
   * This state matters for a second reason: such a page still carries prices, belonging to Airbnb's
   * "similar listings" recommendations. A parser that fell back to "any RON figure on the page" would
   * capture a COMPETITOR's price and file it as this property's.
   */
  | 'not-priced';

const norm = (s: string) => s.replace(/ /g, ' ').replace(/[ \t]+/g, ' ');
const excerptOf = (t: string, n = 600) => norm(t).slice(0, n);

/**
 * Parse a money figure as rendered by either site. Both use thousands separators and the RON pages
 * use a comma decimal in places, so a naive `parseFloat` silently truncates 3.578,32 to 3.
 */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  // Which separator is the DECIMAL one is decided by how many digits follow it, not by which symbol
  // it is. Both conventions appear on these pages, and guessing by symbol turns "2,064" into 2.064 —
  // a thousandfold error that still looks like a plausible per-night rate.
  const lastSep = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
  let out: string;
  if (lastSep === -1) {
    out = cleaned;
  } else {
    const decimals = cleaned.length - lastSep - 1;
    if (decimals === 3) {
      out = cleaned.replace(/[.,]/g, '');                                    // 2,064 / 1.500 -> thousands
    } else {
      out = cleaned.slice(0, lastSep).replace(/[.,]/g, '') + '.' + cleaned.slice(lastSep + 1);
    }
  }
  const n = Number(out);
  return Number.isFinite(n) ? n : null;
}

/**
 * Classify the page before trying to price it. A window an OTA will not sell is a real answer about
 * that window — Airbnb enforcing a 4-night minimum where the direct site allows 2 is a finding, not a
 * gap — and it must be distinguishable from "the page never rendered".
 */
export function classifyPage(text: string): PageState {
  const t = norm(text).toLowerCase();
  // Measure the RAW text: `norm` collapses runs of whitespace, so a page that is mostly layout
  // whitespace would look empty and be misreported as never having loaded.
  if (!t.trim() || text.length < 200) return 'not-loaded';
  if (/(are you a robot|unusual traffic|verify you are human|captcha|security check)/.test(t)) return 'bot-check';
  if (/(minimum stay|minimum-night stay|min\.? stay|stay of \d+ nights? or more|sejur minim|you need to stay \d+\+? nights?|add an extra night to your search)/.test(t)) return 'min-stay';
  if (/(no availability|not available for|sold out|dates are not available|nu este disponibil|unavailable for your dates)/.test(t)) {
    return 'no-availability';
  }
  // Dates applied but no quote returned. Checked AFTER unavailability, because a page can say both.
  if (/add dates for prices/.test(t)) return 'not-priced';
  return 'priced';
}

/** ISO date from the long forms both sites render, e.g. "11 Sept 2026" / "Sep 11, 2026". */
const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12',
};
export function parseLooseDate(raw: string, fallbackYear?: number): string | null {
  const t = norm(raw).toLowerCase();
  let m = t.match(/(\d{1,2})\s+([a-z]{3,9})\.?\s*(\d{4})?/);
  if (!m) m = t.match(/([a-z]{3,9})\.?\s+(\d{1,2}),?\s*(\d{4})?/);
  if (!m) return null;
  const a = m[1], b = m[2];
  const dayFirst = /^\d/.test(a);
  const day = dayFirst ? a : b;
  const monKey = (dayFirst ? b : a).slice(0, 4).replace(/[^a-z]/g, '');
  const mon = MONTHS[monKey] ?? MONTHS[monKey.slice(0, 3)];
  const year = m[3] ?? (fallbackYear ? String(fallbackYear) : null);
  if (!mon || !year) return null;
  return `${year}-${mon}-${String(day).padStart(2, '0')}`;
}

/**
 * AIRBNB. The room page renders a "… RON total" line, optionally a struck-through original when a
 * promotion is running, and a "N nights in …" heading that is our proof the page is showing the dates
 * we asked for.
 *
 * NOTE what this number is NOT: it is the price an anonymous browser sees. This listing gives a
 * standing 15% "top-rated guests" discount that almost every real guest qualifies for and that no
 * capture can observe. `evaluateParity` applies it; the parser must not, or the correction would be
 * applied twice.
 */
export function extractAirbnb(text: string, opts?: { year?: number }): ExtractResult {
  const t = norm(text);
  const excerpt = excerptOf(t);
  // Classify against the RAW text: `classifyPage` uses raw length to tell "page never rendered" from
  // "page rendered and says no", and `norm` collapses whitespace enough to defeat that.
  const state = classifyPage(text);
  if (state !== 'priced') return { ok: false, reason: `page state: ${state}`, excerpt };

  // WHICH number is the price is the highest-risk decision in this file, and the risk is asymmetric.
  //
  // Both sites render a discount as TWO adjacent figures: the struck-through original and the price
  // actually charged. Capturing the struck one overstates the OTA, which makes direct look CHEAPER
  // than it is — so a window you are losing reports as healthy. That is the failure that costs money
  // quietly, and it is the one to design against.
  //
  // So: never take the first match. Enumerate every "… total" candidate and take the MINIMUM, because
  // a discounted price is by definition the lower of the pair. Layouts can reorder; that invariant
  // cannot. The higher candidate becomes the list price, which is exactly the pair we want.
  const totalRe = /([\d.,]+)\s*(RON|lei|€|EUR|\$|USD)\s*total/gi;
  const totals: number[] = [];
  let currency = 'RON';
  for (let m = totalRe.exec(t); m !== null; m = totalRe.exec(t)) {
    const v = parseMoney(m[1]);
    if (v !== null && v > 0) { totals.push(v); currency = normCurrency(m[2]); }
  }
  if (!totals.length) {
    // Fall back to "total <sep> <number>", same discipline: collect all, take the lowest.
    const alt = /total[^\d]{0,20}([\d.,]+)\s*(RON|lei|€|EUR|\$|USD)/gi;
    for (let m = alt.exec(t); m !== null; m = alt.exec(t)) {
      const v = parseMoney(m[1]);
      if (v !== null && v > 0) { totals.push(v); currency = normCurrency(m[2]); }
    }
  }
  if (!totals.length) return { ok: false, reason: 'no "… total" line found', excerpt };

  // DEDUPE. Airbnb renders the same figure more than once — the panel and again after "Show price
  // breakdown" — so a page with a single price yields two identical matches. Treating those as a
  // pair produced a "list price equal to the charged price" and refused four otherwise-valid live
  // captures. Distinct values are a real pair; repeats are the same number twice.
  const distinct = [...new Set(totals)].sort((a, b) => a - b);
  const total = distinct[0];
  const promoActive = /(host is offering a discount|special offer|reducere|price were changed)/i.test(t);

  // The list price is the higher member of the pair when there is one.
  //
  // When there is only ONE "… total" on the page, the struck-through original still has to be found —
  // but it must be looked for in the ~140 characters IMMEDIATELY BEFORE the total, which is where both
  // sites render it ("L 3,210 RON  L 3,029 RON total"). Scanning the whole page instead reads
  // 10KB of unrelated figures: review counts, similar-listing prices, nightly rates. On a live
  // 2026-12-23 page that produced a "list price" of 8,496 against a true list of 3,210 — a fabricated
  // 64% discount, fed straight into the model that learns discount depth.
  //
  // The fixtures did not catch this because fixtures are short. Real pages are mostly other numbers.
  let listTotal: number | null = distinct.length > 1 ? distinct[distinct.length - 1] : null;
  if (listTotal === null) {
    const anchor = t.search(new RegExp(String.raw`[\d.,]+\s*(?:RON|lei|€|EUR|\$|USD)\s*total`, 'i'));
    if (anchor > -1) {
      const before = t.slice(Math.max(0, anchor - 140), anchor);
      const nearRe = /([\d.,]+)\s*(?:RON|lei|€|EUR|\$|USD)/gi;
      for (let m = nearRe.exec(before); m !== null; m = nearRe.exec(before)) {
        const v = parseMoney(m[1]);
        if (v !== null && v > total && v < total * 3 && (listTotal === null || v > listTotal)) listTotal = v;
      }
    }
  }

  const nights = readCount(t, 'nights?\\s+in') ?? readCount(t, 'nopt\\w*');
  // The guest count MUST come from the booking panel's "GUESTS <n> guests" block, not from the first
  // "<n> guests" on the page — that one is the listing header, "6 guests · 3 bedrooms · 6 beds", i.e.
  // the property's CAPACITY. Reading it made every one of 15 live cells echo 6 regardless of what was
  // searched, which would fail the echo check on every occupancy except the maximum.
  const panelGuests = t.match(/guests?\s+(\d{1,2})\s+guests?\b/i);
  const guests = panelGuests ? Number(panelGuests[1]) : readCount(t, 'guests?|adults?|oaspe\\w*');
  // Each side may or may not carry its own year ("24 Aug 2026 - 29 Aug 2026" and "Aug 24 - 29" both
  // occur), so the year is optional INSIDE each alternative rather than trailing the whole range.
  const SIDE = String.raw`(?:\d{1,2}\s+[A-Za-z]{3,9}\.?(?:\s+\d{4})?|[A-Za-z]{3,9}\.?\s*\d{1,2}(?:,?\s*\d{4})?)`;
  const range = t.match(new RegExp(`(${SIDE})\\s*[-\u2013\u2014]\\s*(${SIDE})`));

  return {
    ok: true,
    value: {
      total, listTotal, currency, promoActive,
      ratePlan: 'flexible',   // Airbnb's cancellation policy is a listing setting, not a rate plan choice
      echo: {
        nights, guests,
        checkIn: range ? parseLooseDate(range[1], opts?.year) : null,
        checkOut: range ? parseLooseDate(range[2], opts?.year) : null,
      },
      needsSignIn: false,
      excerpt,
    },
  };
}

/**
 * BOOKING.COM. The search/property page lists one row per rate plan, each with an optional
 * "Original price X Current price Y". We take the CHEAPEST plan, because that is what a guest
 * comparing prices sees — and we record which plan it was, since the peak windows here are
 * non-refundable and that is a different product from a flexible direct booking.
 */
export function extractBooking(text: string, opts?: { year?: number; guests?: number }): ExtractResult {
  const t = norm(text);
  const excerpt = excerptOf(t);
  // Classify against the RAW text: `classifyPage` uses raw length to tell "page never rendered" from
  // "page rendered and says no", and `norm` collapses whitespace enough to defeat that.
  const state = classifyPage(text);
  if (state !== 'priced') return { ok: false, reason: `page state: ${state}`, excerpt };

  const needsSignIn = /(sign in to unlock|members?-only price|autentifica-te pentru)/i.test(t);

  // Booking lists one row per room configuration, each with its own "Max persons: N". Taking the
  // global cheapest can therefore capture a price for a SMALLER party than was searched — a live
  // 2026-09-22 page offered "Max persons: 5" at 3,804 while the probe asked for 6 adults. That
  // understates the channel, which flatters nothing but does corrupt the discount model, and an
  // earlier hand-capture hit the same trap ("lowest plan seating 4; a 1,480 plan exists but is Max
  // persons 3"). So each price pair is attributed to the nearest PRECEDING capacity marker, and rows
  // too small for the party are discarded.
  //
  // Booking writes that marker TWO different ways, and the difference is not cosmetic:
  //   * adults-only search  -> "Max persons: 4"
  //   * search WITH children -> "Max adults: 4 <br> Max children: 2"
  // Matching only the first form meant that every capture including a child found no markers at
  // all, skipped the filter entirely, and fell through to "cheapest pair on the page". On the live
  // 2026-09-04 page that cheapest pair was the "Max adults: 3" row at 1,840 — recorded as the price
  // for a family of six, against a true 2,216. It made direct look 26% dearer than Booking when it
  // is in fact 4.6% dearer, and the same fault produced the +31% and +36% September readings. A
  // filter that silently matches nothing is worse than no filter, so an all-or-nothing capacity
  // read is treated as a parse failure below rather than as permission to take the minimum.
  const capAt: Array<{ at: number; max: number }> = [];
  const capRe = /max\s*(?:persons?|adults?)\s*:?\s*(\d{1,2})(?:[^\d]{0,20}?max\s*children\s*:?\s*(\d{1,2}))?/gi;
  for (let m = capRe.exec(t); m !== null; m = capRe.exec(t)) {
    const adults = Number(m[1]);
    const children = m[2] === undefined ? 0 : Number(m[2]);
    if (Number.isFinite(adults)) capAt.push({ at: m.index, max: adults + (Number.isFinite(children) ? children : 0) });
  }
  // When the caller supplies no headcount, read the one the PAGE says was searched — Booking prints
  // "4 adults · 2 children · 1 room". Without this the in-page copy, which has no caller to supply
  // it, would filter while this one did not, and the two would silently disagree.
  const statedParty = ((): number | null => {
    const pc = t.match(/(\d{1,2})\s*adults?\s*[·,]\s*(\d{1,2})\s*(?:children|child)/i);
    if (pc) return Number(pc[1]) + Number(pc[2]);
    const pa = t.match(/(\d{1,2})\s*adults?/i);
    return pa ? Number(pa[1]) : null;
  })();
  const wantedGuests = opts?.guests ?? statedParty;

  const capacityAt = (idx: number): number | null => {
    let best: number | null = null;
    for (const c of capAt) if (c.at <= idx) best = c.max;
    return best;
  };

  const candidates: Array<{ current: number; original: number | null; currency: string }> = [];
  let droppedTooSmall = 0;
  const pairRe = /original price[^\d]{0,20}([\d.,]+)[^\d]{0,40}?current price[^\d]{0,20}([\d.,]+)/gi;
  for (let m = pairRe.exec(t); m !== null; m = pairRe.exec(t)) {
    const orig = parseMoney(m[1]); const cur = parseMoney(m[2]);
    if (cur === null || cur <= 0) continue;
    const cap = capacityAt(m.index);
    if (wantedGuests && cap !== null && cap < wantedGuests) { droppedTooSmall++; continue; }
    candidates.push({ current: cur, original: orig, currency: 'RON' });
  }
  if (!candidates.length && droppedTooSmall > 0) {
    return {
      ok: false, excerpt,
      reason: `every priced row is too small for ${wantedGuests} guests ` +
              `(${droppedTooSmall} row(s) capped below it) — the channel has no offer for this party size`,
    };
  }
  if (wantedGuests && candidates.length > 1 && !capAt.length) {
    return {
      ok: false, excerpt,
      reason: `${candidates.length} priced rows but no capacity marker on the page — cannot tell ` +
              `which row is for ${wantedGuests} guests, and the cheapest is usually a smaller party`,
    };
  }
  if (!candidates.length) {
    // An UNDISCOUNTED Booking page has no "Original price / Current price" pair at all — it just
    // prints "Price 4,180 lei" per rate row. The only fallback here used to be `(RON|lei) <number>`,
    // which expects the currency FIRST and therefore never matched Booking's own format: every
    // undiscounted page came back `no price rows found`. It went unnoticed because this property's
    // own Booking listing nearly always carries a Genius discount, so the pair path covers it — but
    // a competitor without a promo, or our own listing on a window where Genius does not apply,
    // reads as a parse failure. Found live on 2026-09-01 against four comparables at once.
    //
    // The row-anchored form is tried first because it is precise: "Price " prefixes a real rate row,
    // where a bare number beside "lei" also matches the map, the similar-properties rail and the
    // review counts. And it is capacity-filtered like the pair path — taking the cheapest unfiltered
    // number on a multi-unit page is exactly the bug the filter above exists to prevent.
    const rowRe = /price\s+([\d.,]+)\s*(RON|lei)/gi;
    for (let m = rowRe.exec(t); m !== null; m = rowRe.exec(t)) {
      const v = parseMoney(m[1]);
      if (v === null || v <= 0) continue;
      const cap = capacityAt(m.index);
      if (wantedGuests && cap !== null && cap < wantedGuests) { droppedTooSmall++; continue; }
      candidates.push({ current: v, original: null, currency: normCurrency(m[2]) });
    }
  }
  if (!candidates.length && droppedTooSmall > 0) {
    return {
      ok: false, excerpt,
      reason: `every priced row is too small for ${wantedGuests} guests ` +
              `(${droppedTooSmall} row(s) capped below it) — the channel has no offer for this party size`,
    };
  }
  if (!candidates.length) {
    const bareRe = /(RON|lei)\s*([\d.,]+)/gi;
    for (let m = bareRe.exec(t); m !== null; m = bareRe.exec(t)) {
      const v = parseMoney(m[2]);
      if (v !== null && v > 0) candidates.push({ current: v, original: null, currency: normCurrency(m[1]) });
    }
  }
  if (!candidates.length) return { ok: false, reason: 'no price rows found', excerpt };

  const best = candidates.reduce((a, b) => (b.current < a.current ? b : a));
  // Booking words this several ways on the same site: "Non-refundable", "Fully refundable (by
  // Booking.com) before <date>", "Free cancellation". Seen live on 2026-08-29 — the first version of
  // this only knew "free cancellation" and read a fully-refundable plan as `unknown`.
  const nonRef = /(non-?refundable|nerambursabil|no refund)/i.test(t);
  const flex = /(free cancellation|fully refundable|anulare gratuit|rambursabil)/i.test(t);

  const nights = readBookingNights(t);
  const guests = readCount(t, 'adults?|guests?');

  return {
    ok: true,
    value: {
      total: best.current,
      listTotal: best.original,
      currency: best.currency,
      promoActive: best.original !== null && best.original > best.current,
      ratePlan: nonRef && !flex ? 'non-refundable' : flex ? 'flexible' : 'unknown',
      echo: {
        nights, guests,
        checkIn: null,
        checkOut: null,
      },
      needsSignIn,
      excerpt,
    },
  };
}

/**
 * Read a small count ("3 nights", "4 guests") out of page text.
 *
 * Bounding to 1-2 digits is not enough on its own: the live Airbnb panel renders
 * "CHECKOUT 9/28/2026 GUESTS 4 guests", where the year's trailing "26" sits immediately before the
 * word GUESTS. So the match must also not begin part-way through a longer number or a date. Both
 * mistakes were made in turn while writing this, and both produced a confident wrong count rather
 * than a failure — which the echo check would then have reported as a layout change on every cell.
 */
/**
 * How many nights Booking says it is quoting.
 *
 * At exactly seven nights Booking stops counting them and writes a week instead — the page reads
 * "1 week, 2 adults, 1 child" and "Price for 1 week", and the word "night" does not appear on it
 * anywhere. So the plain count returned null and the echo check, the one guard that catches a stale
 * render, had nothing to compare and could only pass the cell through unverified. Every seven-night
 * Booking cell in the 2026-08-31 sweep had to be confirmed by hand instead.
 *
 * Only exact multiples are worded that way: the same page at ten nights says "10 nights". Verified
 * live on 2026-09-01 against both lengths.
 *
 * The week form is read ANCHORED to the two phrasings the page actually uses, and it is deliberately
 * not shared with Airbnb, whose pages carry "2 weeks ago" and "3 weeks ago" in the review timestamps.
 * An unanchored reading there would have returned 14 nights on a seven-night stay and thrown away a
 * good capture. Airbnb states "7 nights in Comarnic" and needs none of this.
 */
/**
 * How many nights the RATE TABLE is quoting — not how many the page header says.
 *
 * The distinction is the whole point. Booking's search header and its rate table can disagree: on
 * 2026-09-02 a competitor's page echoed the requested 4 nights in the header while serving a price
 * block belonging to a different, shorter stay. The echo check passed on the header and a wrong
 * number was banked — it only surfaced because the same figure had been captured for a 3-night
 * window and an identical total across two stay lengths is impossible.
 *
 * `Price for N nights` is the rate table's OWN heading, so a stale table carries a stale heading and
 * the mismatch is caught. It is preferred over any bare "N nights" on the page for that reason.
 */
function readBookingNights(t: string): number | null {
  const fromRateTable = t.match(/price\s+for\s+(\d{1,2})\s+nights?/i);
  if (fromRateTable) return Number(fromRateTable[1]);
  const nights = readCount(t, 'nights?') ?? readCount(t, 'nopt\\w*');
  if (nights !== null) return nights;
  const WEEK = String.raw`(?:weeks?|s[\u0103a]pt[\u0103a]m[\u00e2a]n[\u0103i]\w*)`;
  const m =
    t.match(new RegExp(String.raw`\b(\d{1,2})\s+${WEEK}\s*[,\u00b7]\s*\d{1,2}\s*(?:adults?|adul[\u021bt]\w*)`, 'i')) ??
    t.match(new RegExp(String.raw`(?:price for|pre[\u021bt]\w*\s+pentru)\s+(\d{1,2})\s+${WEEK}\b`, 'i'));
  return m ? Number(m[1]) * 7 : null;
}

function readCount(text: string, words: string): number | null {
  const re = new RegExp(String.raw`(?:^|[^\d/.,])(\d{1,2})\s+(?:${words})\b`, 'i');
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

function normCurrency(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s === 'lei' || s === 'ron') return 'RON';
  if (s === '€' || s === 'eur') return 'EUR';
  if (s === '$' || s === 'usd') return 'USD';
  return raw.trim().toUpperCase();
}

/**
 * Structural checks that hold no matter how either site is laid out. They exist because a regex can
 * be defeated by a redesign, but arithmetic cannot: whatever the page looks like, a discounted price
 * is lower than the price it was discounted from.
 */
function guardDiscountPair(v: ExtractedPrice, excerpt: string): ExtractResult {
  // 1. A "discount" that is not a discount means the two figures were swapped — i.e. the struck-through
  //    original was captured as the price charged. Refuse; do not silently keep the higher one.
  if (v.listTotal !== null && v.listTotal < v.total) {
    return {
      ok: false,
      excerpt,
      reason: `list price ${v.listTotal} is BELOW the captured total ${v.total} — the struck-through ` +
              `original and the charged price look swapped. Refusing rather than banking the higher one.`,
    };
  }
  // 2. The page advertises a discount but we found only one figure. The likeliest explanation is that
  //    the pair was rendered in a way this parser did not recognise, and the single number we DID find
  //    may be the original rather than the charged price. That is the expensive direction, so refuse.
  // A promo with no list price is NOT refused. On Airbnb "X RON total" is definitionally what the
  // guest pays, so a single figure is the charged price even when a discount banner is present — the
  // original is simply not rendered for that window (confirmed on four live pages). Refusing here
  // threw away valid prices. What is genuinely lost is the DEPTH, and the report flags that
  // separately rather than the parser discarding the price.
  return { ok: true, value: v };
}

export function extract(channel: Channel, text: string, opts?: { year?: number; guests?: number }): ExtractResult {
  const r = channel === 'airbnb' ? extractAirbnb(text, opts) : extractBooking(text, opts);
  return r.ok ? guardDiscountPair(r.value, r.value.excerpt) : r;
}

/**
 * The echo check, as a hard gate. A mismatch means the SPA re-rendered the previous cell's price and
 * we are about to bank it against the wrong window — the failure mode that silently corrupts a run.
 * Fields the page did not state are not evidence either way and are skipped.
 */
export function verifyEcho(
  value: ExtractedPrice,
  probe: { nights: number; guests: number; checkIn?: string; checkOut?: string },
): { ok: true } | { ok: false; reason: string } {
  const e = value.echo;
  if (e.nights !== null && e.nights !== probe.nights) {
    return { ok: false, reason: `page shows ${e.nights} nights, probe asked for ${probe.nights}` };
  }
  if (e.guests !== null && e.guests !== probe.guests) {
    return { ok: false, reason: `page shows ${e.guests} guests, probe asked for ${probe.guests}` };
  }
  if (probe.checkIn && e.checkIn && e.checkIn !== probe.checkIn) {
    return { ok: false, reason: `page shows check-in ${e.checkIn}, probe asked for ${probe.checkIn}` };
  }
  return { ok: true };
}
