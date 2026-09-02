/**
 * Reading a competitive field off ONE Airbnb search-results page.
 *
 * The sibling of `searchResults.ts`, and deliberately not the same module: the two pages agree about
 * what a card is and disagree about the one thing that matters most, which is what an ABSENCE means.
 *
 * WHAT IT GIVES US, and it is more than the protocol claimed for months — `docs/ota-capture-protocol.md`
 * said Airbnb had "no equivalent" and that line went unchallenged until the owner sent a search URL
 * (2026-09-02):
 *
 *  - **A stay TOTAL on every card**, struck-through and discounted, in the search currency:
 *    `L 2,595 RON  L 2,369 RON total`. Our own listing's card read 2,369 against a stored detail
 *    probe of 2,369, and three comparables matched to the leu.
 *  - **A per-card echo, in the card's own LINK.** Each `/rooms/<id>` href carries `check_in`,
 *    `check_out`, `adults` and `children`. Booking states its echo in card text; Airbnb states it in
 *    the href. Either way the check is per card and the batch is refused if one disagrees.
 *  - **The room id is in that href too**, so the join to the curated set is by id and never by name.
 *  - **A candidate feed.** Thirteen of the eighteen cards on page one were not in the curated set.
 *
 * WHAT IT DOES NOT GIVE US: a verdict on a listing that is missing.
 *
 * A Booking search returns the whole town in one page, so a curated property that is absent has been
 * excluded, and that is a finding. Airbnb paginates eighteen at a time across FIFTEEN pages of a much
 * wider radius, so an absence has two possible causes — no availability, or ranked below where we
 * stopped reading — and they are not distinguishable from the page.
 *
 * The owner's reading (2026-09-02) is that absence from the first pages of a Comarnic search usually
 * IS unavailability, and the evidence backs him: all three absentees on the first run had a real
 * cause (one sleeps 3 against a party of 4; one we already held as unavailable; one had gone off sale
 * between readings, confirmed on its own page). "Usually" is not "always", and this system has been
 * burned twice by recording a plausible value nobody measured — so absentees come back from
 * {@link matchAirbnbToSet} as a **probe list**, never as `unavailable` rows. One detail load each
 * settles it, and the run is still cheaper than probing the whole set.
 *
 * PURE. Card text and href in, structured cards out. The DOM-only parts are in
 * {@link IN_PAGE_AIRBNB_COLLECTOR}.
 */
import type { CompetitorListing } from './set';
import { norm } from './searchResults';

export interface AirbnbCard {
  /** The numeric room id from the card's own link. The join key — never the display name. */
  roomId: string;
  name: string;
  /** "Chalet in Comarnic" — the type-and-place line, which is where the city comes from. */
  title: string;
  /** Guest-facing total for the whole stay, as displayed. */
  price: number | null;
  /** Struck-through pre-discount total, when the card shows one. */
  listPrice: number | null;
  /** What the card's own LINK says it is quoting. The per-card echo. */
  echo: { checkIn: string | null; checkOut: string | null; adults: number | null; children: number | null };
  rating: number | null;
  reviewCount: number | null;
  beds: number | null;
  bedrooms: number | null;
}

/** Exported so the compiled source can be shipped into the page — see `IN_PAGE_AIRBNB_COLLECTOR`. */
export const money = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export interface RawAirbnbCard {
  roomId: string;
  name: string;
  title: string;
  href: string;
  priceText: string;
  text: string;
}

/**
 * One card into a record.
 *
 * The price row prints the discounted total last and marks it with the word `total`; a struck-through
 * original, when there is one, comes first. Matching only the labelled figure is what keeps a
 * discounted card from being read at its pre-discount price.
 */
export function parseAirbnbCard(raw: RawAirbnbCard): AirbnbCard {
  const p = norm(raw.priceText);
  const t = norm(raw.text);
  const total = p.match(/([\d.,]+)\s*RON\s*total/i);
  const every = [...p.matchAll(/([\d.,]+)\s*RON/gi)].map((m) => m[1]);
  const listPrice = total && every.length >= 2 && every[0] !== total[1] ? money(every[0]) : null;

  // The echo lives in the href, so it survives a card whose text is still rendering.
  const q = (() => {
    try { return new URL(raw.href, 'https://www.airbnb.com').searchParams; } catch { return null; }
  })();
  const num = (v: string | null | undefined) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

  // A card with no children in the URL is quoting a party with none, which is 0 and not "unknown" —
  // Airbnb simply omits the parameter. Adults are always present; their absence means the href did
  // not parse, and that is what null is for.
  const adults = num(q?.get('adults'));
  const children = q?.get('children') != null ? num(q.get('children')) : (adults !== null ? 0 : null);

  const rating = t.match(/(\d(?:\.\d+)?)\s*out of 5 average rating/i) ?? t.match(/(\d\.\d+)\s*\(/);
  const reviews = t.match(/average rating,\s*([\d,]+)\s*reviews?/i) ?? t.match(/\((\d[\d,]*)\)/);

  return {
    roomId: raw.roomId,
    name: raw.name.trim(),
    title: raw.title.trim(),
    price: money(total?.[1]),
    listPrice,
    echo: {
      checkIn: q?.get('check_in') ?? null,
      checkOut: q?.get('check_out') ?? null,
      adults,
      children,
    },
    rating: rating ? Number(rating[1]) : null,
    reviewCount: reviews ? Number(reviews[1].replace(/,/g, '')) : null,
    beds: (() => { const x = t.match(/(\d+)\s*beds?\b/i); return x ? Number(x[1]) : null; })(),
    bedrooms: (() => { const x = t.match(/(\d+)\s*bedrooms?\b/i); return x ? Number(x[1]) : null; })(),
  };
}

export interface AirbnbProbe {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

export interface AirbnbBatch {
  ok: boolean;
  cards: AirbnbCard[];
  mismatched: Array<{ roomId: string; echo: AirbnbCard['echo'] }>;
  problem?: string;
}

/**
 * Keep the cards whose own link echoes what was asked, and drop the rest by name.
 *
 * **This does NOT work like the Booking batch, and the difference is a measured one.** Booking does
 * not mix stays: a card echoing another search means the page is mid-update, so the whole batch is
 * refused. Airbnb DOES mix them — it quietly seeds "alternative dates" into the same grid, visually
 * identical to the rest, and only the card's own href gives it away. A 24-29 Dec search returned AVA
 * Chalet echoing 26-29 Dec at 3,630, beside two more echoing 24-28. Banking that page would have
 * stored a three-night price as a five-night one, which is a large error pointing the wrong way.
 *
 * So a mismatch here is not evidence the page is stale — it is evidence that CARD is about a
 * different stay. Dropping the offenders and keeping the rest is the honest reading, and refusing all
 * thirty-nine because Airbnb suggested three alternatives would be the kind of false alarm that gets
 * a check switched off.
 *
 * Two things still refuse the page outright: nothing matching at all, and more mismatched than
 * matched — either means the render is about a search we did not ask for.
 *
 * A curated listing seen ONLY on a dropped card is not present. It falls through to the probe list,
 * which is where an unknown belongs.
 */
export function verifyAirbnbBatch(cards: AirbnbCard[], probe: AirbnbProbe): AirbnbBatch {
  if (!cards.length) {
    return { ok: false, cards: [], mismatched: [],
             problem: 'no cards parsed — the page did not render, or the layout changed' };
  }
  const mismatched = cards.filter((c) =>
    (c.echo.checkIn !== null && c.echo.checkIn !== probe.checkIn)
    || (c.echo.checkOut !== null && c.echo.checkOut !== probe.checkOut)
    || (c.echo.adults !== null && c.echo.adults !== probe.adults)
    || (c.echo.children !== null && c.echo.children !== probe.children))
    .map((c) => ({ roomId: c.roomId, echo: c.echo }));

  const kept = cards.filter((c) => !mismatched.some((m) => m.roomId === c.roomId));

  if (!kept.length || mismatched.length > kept.length) {
    return {
      ok: false, cards: [], mismatched,
      problem: `${mismatched.length} of ${cards.length} cards echo a different search than was asked ` +
               `(${probe.checkIn}→${probe.checkOut}, ${probe.adults}a+${probe.children}c) — that is ` +
               `too many to be Airbnb's alternative-date suggestions, so the render is about another ` +
               `search. Re-load.`,
    };
  }
  if (!kept.some((c) => c.price !== null)) {
    return { ok: false, cards: [], mismatched, problem: 'cards rendered but none carried a total' };
  }
  return {
    ok: true, cards: kept, mismatched,
    problem: mismatched.length
      ? `${mismatched.length} card(s) dropped — they echo other dates, which is Airbnb offering ` +
        `alternatives rather than the stay that was asked for.`
      : undefined,
  };
}

/** The room id inside a stored Airbnb listing URL — the join key between a card and the set. */
export function roomIdOf(url: string): string | null {
  return (url.match(/\/rooms\/(\d+)/) || [])[1] ?? null;
}

export interface AirbnbField {
  /** Cards that are in the curated set, paired with their listing. */
  curated: Array<{ card: AirbnbCard; listing: CompetitorListing }>;
  /**
   * Curated listings the search did NOT return.
   *
   * A probe list, not a verdict. See the module note: Airbnb's fifteen pages make absence ambiguous
   * in a way Booking's single page never is, and this system does not record what it has not read.
   */
  toProbe: CompetitorListing[];
  /** Cards that are not curated — the candidate feed. The page proposes; the owner disposes (C1). */
  candidates: AirbnbCard[];
  /** Our own listing's card, when the search returned it. A free cross-check on the instrument. */
  ours?: AirbnbCard;
}

export function matchAirbnbToSet(
  cards: AirbnbCard[],
  listings: CompetitorListing[],
  ourRoomId?: string | null,
): AirbnbField {
  const byRoom = new Map<string, CompetitorListing>();
  for (const l of listings) {
    const id = roomIdOf(l.url);
    if (id) byRoom.set(id, l);
  }

  const curated: AirbnbField['curated'] = [];
  const candidates: AirbnbCard[] = [];
  let ours: AirbnbCard | undefined;
  for (const card of cards) {
    if (ourRoomId && card.roomId === ourRoomId) { ours = card; continue; }
    const listing = byRoom.get(card.roomId);
    if (listing) curated.push({ card, listing });
    else candidates.push(card);
  }

  const seen = new Set(cards.map((c) => c.roomId));
  const toProbe = listings.filter((l) => {
    const id = roomIdOf(l.url);
    return id ? !seen.has(id) : false;
  });

  return { curated, toProbe, candidates, ours };
}

/**
 * Collect every card on the CURRENT page.
 *
 * Run it BEFORE scrolling and once per page, merging by `roomId` — the Airbnb list re-renders as you
 * move through it, and the Booking page taught this lesson expensively (25 cards at the top became 6
 * at the bottom).
 *
 * Returns raw strings only. Every judgement about what they mean belongs to `parseAirbnbCard`.
 *
 * A page of Airbnb cards is ~16KB of raw text and the extension blocks bulk egress, so getting it out
 * intact costs dozens of hand-transcribed slices — the Booking run needed seventeen, plus a patch for
 * 72 non-breaking spaces; a two-page Airbnb run holds 608. So the parse happens IN THE PAGE, and
 * `parserSnippet()` ships the COMPILED SOURCE of `parseAirbnbCard` there rather than a hand-written
 * copy of it. That is the opposite of the two-implementation trap the protocol warns about: there is
 * one implementation, the tested one, executed in both places.
 */
/**
 * The tested parser, as source, ready to paste into a page.
 *
 * Whatever compiles this file rewrites the cross-module call to `norm` into a namespace reference,
 * and the namespace is named differently by each toolchain — `import_searchResults.norm` under tsx,
 * `_searchResults.norm` under jest. Binding a shim to one of those names would work in the tool that
 * generated it and throw in the other, silently, on a live page. So the reference is rewritten back
 * to a bare `norm` instead of being shimmed, which depends on no toolchain's naming at all.
 *
 * Everything else is verbatim compiled output: change `parseAirbnbCard` and this changes with it,
 * which is the whole point of shipping it rather than re-writing it.
 */
export function parserSnippet(): string {
  const body = parseAirbnbCard.toString()
    // `(0, ns.norm)(x)` and `ns.norm(x)` both become `norm(x)`.
    .replace(/\(\s*0\s*,\s*[A-Za-z_$][\w$]*\.norm\s*\)/g, 'norm')
    .replace(/\b[A-Za-z_$][\w$]*\.norm\b/g, 'norm');
  return [
    // esbuild tags functions with this; other toolchains do not emit it. Defining it is harmless.
    'var __name = function(f){ return f; };',
    `var norm = ${norm.toString()};`,
    `var money = ${money.toString()};`,
    `var parseAirbnbCard = ${body};`,
  ].join('\n');
}

export const IN_PAGE_AIRBNB_COLLECTOR = `
(function(){
  var cards = document.querySelectorAll('[itemprop="itemListElement"]');
  var out = [];
  for (var i = 0; i < cards.length; i++) {
    var el = cards[i];
    var a = el.querySelector('a[href*="/rooms/"]');
    var id = a ? (a.href.match(/\\/rooms\\/(\\d+)/) || [])[1] : null;
    if (!id) continue;
    var g = function(sel){ var e = el.querySelector(sel); return e ? e.innerText : ''; };
    out.push({
      roomId: id,
      name: g('[data-testid="listing-card-name"]'),
      title: g('[data-testid="listing-card-title"]'),
      href: a.href,
      priceText: g('[data-testid="price-availability-row"]'),
      text: el.innerText
    });
  }
  return JSON.stringify({ n: cards.length, collected: out.length, cards: out });
})()
`.trim();
