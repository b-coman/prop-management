/**
 * Reading a whole competitive field off ONE search-results page.
 *
 * This is the primary capture instrument, and it beats probing listings one at a time on every axis
 * that matters (owner's suggestion, 2026-09-02):
 *
 *  - **One page load instead of N.** A Comarnic search returns ~25 properties at once.
 *  - **Identical conditions by construction.** One session, one party, one date range, one moment —
 *    where per-listing probes hold that only by discipline.
 *  - **The echo is inside each card.** Every card states `2 nights, 2 adults, 2 children` next to its
 *    own price. On a detail page the equivalent echo sits in the header, which is exactly what lied
 *    when a stale rate table served a different stay (§21.2).
 *  - **It shows properties outside the curated set** — the guest's actual view of the market, which
 *    is how Moon Village (874 reviews) turned up after being invisible to curation.
 *
 * WHAT IT IS NOT. The search returns a PAGE, not the market, and it silently omits any property that
 * will not take the party — an adults-only listing or a child-age bar simply is not there (§24.2).
 * That omission is INFORMATION, not a gap: the search is the authority on whether a property will
 * sell to this party, and the detail page is not.
 *
 * PURE. Card text in, structured cards out. The DOM-only parts — which element is a card, and the
 * slug from its link — are supplied by `IN_PAGE_SEARCH_COLLECTOR`.
 */
import type { CompetitorListing } from './set';

export interface SearchCard {
  /** Booking's hotel slug, from the card's own link. The join key — never the display name. */
  slug: string;
  name: string;
  /** Guest-facing total for the whole stay, as displayed. */
  price: number | null;
  /** Struck-through pre-discount total, when the card shows one. */
  listPrice: number | null;
  /** What the CARD says it is quoting: nights / adults / children. The per-card echo. */
  echo: { nights: number | null; adults: number | null; children: number | null };
  distanceKm: number | null;
  score: number | null;
  reviewCount: number | null;
  beds: number | null;
  sqm: number | null;
}

/** Booking writes a non-breaking space in prices and labels. Normalise before matching anything. */
export const norm = (s: string): string => s.replace(/ /g, ' ');

/** Exported so the compiled source can be shipped into the page — see {@link parserSnippet}. */
export const money = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * One card's text into a record.
 *
 * Prices come in TWO forms and a parser that reads only the first misses more than half: of 25 cards
 * on a live page, 11 carried `Original price X. Current price Y.` and 14 a bare `Price X lei`.
 */
export function parseSearchCard(slug: string, name: string, rawText: string): SearchCard {
  const t = norm(rawText);
  const pair = t.match(/Original price\s+([\d.,]+)\s*lei\.\s*Current price\s+([\d.,]+)\s*lei/i);
  const single = t.match(/\bPrice\s+([\d.,]+)\s*lei/i);
  // Booking writes the stay length as "4 nights" OR "1 week" — and for ten nights, "1 week, 3
  // nights". A regex that demanded digits-then-"nights" returned null for the WHOLE echo on every
  // seven-night stay, taking the adult and child counts down with it, which left the batch check
  // with nothing to compare and passing silently (§35).
  const echo = t.match(/((?:\d+\s*(?:weeks?|nights?)\s*,\s*)+)(\d+)\s*adults?(?:\s*,\s*(\d+)\s*child(?:ren)?)?/i);
  const nights = echo
    ? [...echo[1].matchAll(/(\d+)\s*(week|night)/gi)]
        .reduce((n, m) => n + Number(m[1]) * (m[2].toLowerCase() === 'week' ? 7 : 1), 0)
    : null;
  const km = t.match(/([\d.]+)\s*km from centre/);
  const m = t.match(/(\d+)\s*m from centre/);

  return {
    slug,
    name: name.trim(),
    price: money(pair ? pair[2] : single?.[1]),
    listPrice: money(pair?.[1]),
    echo: {
      nights,
      adults: echo ? Number(echo[2]) : null,
      children: echo?.[3] !== undefined ? Number(echo[3]) : (echo ? 0 : null),
    },
    distanceKm: km ? Number(km[1]) : (m ? Number((Number(m[1]) / 1000).toFixed(1)) : null),
    score: (() => { const x = t.match(/Scored\s+([\d.]+)/); return x ? Number(x[1]) : null; })(),
    reviewCount: (() => { const x = t.match(/([\d,]+)\s+reviews?/); return x ? Number(x[1].replace(/,/g, '')) : null; })(),
    beds: (() => { const x = t.match(/(\d+)\s*beds?\s*\(/); return x ? Number(x[1]) : null; })(),
    sqm: (() => { const x = t.match(/(\d+)\s*m²/); return x ? Number(x[1]) : null; })(),
  };
}

export interface SearchProbe {
  nights: number;
  adults: number;
  children: number;
}

export interface SearchBatch {
  ok: boolean;
  cards: SearchCard[];
  /** Cards whose own echo disagreed with the probe. Discarded, never banked. */
  mismatched: Array<{ slug: string; echo: SearchCard['echo'] }>;
  problem?: string;
}

/**
 * Accept a page's cards only if EVERY card's own echo matches what was asked.
 *
 * A whole-batch check is possible here in a way it never was on a detail page: 25 cards rendered
 * together either all describe the requested search or the page is mid-update. A single card
 * disagreeing is the signal that the render is inconsistent, so the batch is refused rather than
 * partially banked — the cheapest fix is one more page load, and the alternative is a stale price
 * with a plausible number on it.
 */
export function verifySearchBatch(cards: SearchCard[], probe: SearchProbe): SearchBatch {
  if (!cards.length) {
    return { ok: false, cards: [], mismatched: [], problem: 'no cards parsed — the page did not render, or the layout changed' };
  }
  const mismatched = cards.filter((c) =>
    (c.echo.nights !== null && c.echo.nights !== probe.nights)
    || (c.echo.adults !== null && c.echo.adults !== probe.adults)
    || (c.echo.children !== null && c.echo.children !== probe.children))
    .map((c) => ({ slug: c.slug, echo: c.echo }));

  // "Nothing disagreed" is not "everything agreed". A page where NO card states an echo passes every
  // comparison below by vacuous truth, and the check quietly becomes a no-op — which is exactly what
  // happened on a seven-night search whose cards read "1 week" and parsed to null. A batch that
  // cannot be verified is refused, not banked.
  if (!cards.some((c) => c.echo.nights !== null || c.echo.adults !== null)) {
    return {
      ok: false, cards: [], mismatched: [],
      problem: `none of the ${cards.length} cards states what stay it is quoting, so the echo check ` +
               `has nothing to compare — the layout changed, or the parser cannot read this form. ` +
               `Refusing rather than banking ${cards.length} unverified prices.`,
    };
  }

  const priced = cards.filter((c) => c.price !== null);
  if (mismatched.length) {
    return {
      ok: false, cards: [], mismatched,
      problem: `${mismatched.length} of ${cards.length} cards echo a different search than was asked ` +
               `(${probe.nights}n, ${probe.adults}a+${probe.children}c) — the page is mid-update. Re-load.`,
    };
  }
  if (!priced.length) {
    return { ok: false, cards: [], mismatched: [], problem: 'cards rendered but none carried a price' };
  }
  return { ok: true, cards, mismatched: [] };
}

/** The Booking hotel slug inside a stored listing URL — the join key between a card and the set. */
export function slugOf(url: string): string | null {
  return (url.match(/\/hotel\/[a-z]{2}\/([^.?/]+)/) || [])[1] ?? null;
}

export interface MatchedField {
  /** Cards that are in the curated set, paired with their listing. */
  curated: Array<{ card: SearchCard; listing: CompetitorListing }>;
  /** Cards that are NOT curated — the candidate feed. The page proposes; the owner disposes (C1). */
  candidates: SearchCard[];
  /** Curated listings on this channel that the search did NOT return, with why that matters. */
  absent: CompetitorListing[];
}

/**
 * Split a page's cards against the curated set, by SLUG.
 *
 * Never by display name: Booking's slug and its title disagree often enough to matter — `Casa
 * Drumetului` lives at `vila-drumetului-comarnic`, `Cabana Talea Residence` at `vila-talea-residence`.
 *
 * `absent` is deliberately reported. A curated listing missing from the results is not noise: it is
 * either not selling those dates or it refuses the party, and both are findings (§24.2). What it is
 * NOT is evidence of nothing.
 */
export function matchToSet(
  cards: SearchCard[],
  listings: CompetitorListing[],
  channel = 'booking.com',
): MatchedField {
  const field = listings.filter((l) => l.channel === channel && l.active);
  const bySlug = new Map<string, CompetitorListing>();
  for (const l of field) { const s = slugOf(l.url); if (s) bySlug.set(s, l); }

  const curated: MatchedField['curated'] = [];
  const candidates: SearchCard[] = [];
  for (const card of cards) {
    const listing = bySlug.get(card.slug);
    if (listing) curated.push({ card, listing });
    else candidates.push(card);
  }
  const seen = new Set(curated.map((c) => c.listing.listingId));
  return { curated, candidates, absent: field.filter((l) => !seen.has(l.listingId)) };
}

/**
 * The DOM collector, as a string to run inside the page.
 *
 * 🔴 **The results list is VIRTUALISED.** Off-screen cards are removed from the DOM: one page held 25
 * cards at the top and **6** after scrolling to the bottom. So this collects what is rendered NOW and
 * the caller must run it BEFORE scrolling, or scroll-and-merge across calls. Never scroll then grab.
 *
 * Cards are found by `[data-testid="property-card"]`, which is a DOM dependency — but one that fails
 * LOUDLY (zero cards, refused by `verifySearchBatch`) rather than silently returning something wrong.
 */
/**
 * The tested parser, as source, ready to paste into a page.
 *
 * The same move as `airbnbSearch.parserSnippet`, and for the same reason it was built there: a
 * Booking results page is ~15KB of raw text carrying 72 non-breaking spaces, the extension blocks
 * bulk egress, and `javascript_tool` truncates its return near 1KB. Transcribing that by hand costs
 * seventeen slices and a whitespace repair, and it went wrong the first time (§29.4). Parsing in the
 * page cuts the payload by two thirds and removes every NBSP before it can be lost.
 *
 * This is NOT a second implementation. It is the compiled source of `parseSearchCard`, so it changes
 * when the parser changes. `norm` and `money` live in this module, so unlike the Airbnb snippet there
 * is no namespace reference to rewrite — only the esbuild `__name` tag to stand in for.
 */
export function parserSnippet(): string {
  return [
    'var __name = function(f){ return f; };',
    `var norm = ${norm.toString()};`,
    `var money = ${money.toString()};`,
    `var parseSearchCard = ${parseSearchCard.toString()};`,
  ].join('\n');
}

export const IN_PAGE_SEARCH_COLLECTOR = String.raw`
(function(){
  var cards = document.querySelectorAll('[data-testid="property-card"]');
  var out = [];
  for (var i = 0; i < cards.length; i++) {
    var el = cards[i];
    var a = el.querySelector('a[href*="/hotel/"]');
    var slug = a ? (a.href.match(/\/hotel\/[a-z]{2}\/([^.?\/]+)/) || [])[1] : null;
    if (!slug) continue;
    var titleEl = el.querySelector('[data-testid="title"]');
    var img = el.querySelector('img[src*="bstatic"]');
    out.push({
      slug: slug,
      name: titleEl ? titleEl.textContent : '',
      photo: img ? img.src.split('?')[0] : null,
      text: el.innerText
    });
  }
  return JSON.stringify({ n: cards.length, collected: out.length, cards: out });
})()`;
