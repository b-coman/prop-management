/**
 * Reading a listing's IDENTITY off its page - what the property is, not what it costs.
 *
 * This is a different job from `parity/extract.ts` and must not share its approach. Price capture is
 * mechanical, runs hundreds of times against a known layout, and has an echo check and a magnitude
 * guard behind it. Identity capture runs rarely, on a handful of listings, and being wrong is
 * SILENT: a bad capacity record makes `hostsParty` report a moat that does not exist, and nothing
 * downstream can tell.
 *
 * That failure is not hypothetical. Regexing these pages for "bedrooms" returned plausible, wrong
 * answers on three of nine Booking listings - a village of villas read as one villa, a four-bedroom
 * house read as eleven bedrooms. So this module reads the fields the page actually states, and
 * refuses the ones that only look like facts:
 *
 * 🔴 **`Sleeps:` and `Recommended for` ECHO THE SEARCH.** The same Vila Luna unit reads
 * "Sleeps: 4 adults, 2 children" or "Sleeps: 8 adults" depending only on the URL you asked with. Its
 * real capacity is 11. They are parsed here ONLY so `reconcile()` can prove they moved and throw them
 * away; nothing may ever read them as capacity.
 *
 * Capacity comes from, in strict order:
 *   1. `Max persons: N` / `Max adults: N (+ Max children: M)` - but NOT on every page: Booking renders
 *      it only where several rows must be told apart, so a single-unit listing has none at all.
 *   2. The bed configuration, counted. Always present, and invariant across searches.
 *
 * PURE. Text in, a structured identity out. No I/O, no DOM - the DOM-only parts (the hero photo) are
 * supplied by the caller, because they cannot be derived from text.
 */

export type VerifyChannel = 'airbnb' | 'booking.com';

export interface VerifiedUnit {
  label: string;
  maxPersons: number;
  /** How many units of this type were bookable on the probed dates - a LOWER BOUND on inventory. */
  count: number;
  sqm: number | null;
}

export type IdentityState =
  | 'ok'
  /** The channel has no offer for these dates. Not a parse failure, and itself a real datum. */
  | 'no-availability'
  | 'bot-check'
  | 'not-loaded'
  /** The page rendered but states no capacity in any readable form. Refuse rather than guess. */
  | 'no-capacity';

export interface Identity {
  state: IdentityState;
  units: VerifiedUnit[];
  /** Beds counted across the whole availability section - the fallback, and the cross-check. */
  bedsTotal: number | null;
  rating: number | null;
  reviewCount: number | null;
  city: string | null;
  /**
   * The fields that move with the search. Recorded ONLY as evidence for `reconcile()`. Reading either
   * as capacity is the single worst mistake this module can make.
   */
  echo: { sleeps: string | null; recommendedFor: string | null };
}

/**
 * Sleeping capacity per bed, calibrated against two independent confirmations rather than assumed:
 * Vila Luna's configuration counts to 11, matching both its `Max persons: 11` and the owner's own
 * figure; Villa The Frame's counts to 8, matching its Airbnb listing's stated "8 guests". `sofa = 1`
 * was the genuinely uncertain value and both checks land on it.
 */
export const BED_VALUES: Record<string, number> = {
  single: 1, twin: 1, sofa: 1, futon: 1,
  double: 2, 'large double': 2, 'extra-large double': 2, bunk: 2,
};

/** Booking writes a non-breaking space before the currency and inside some labels. Normalise FIRST. */
export const norm = (s: string): string => s.replace(/ /g, ' ');

const BED_RE = /(\d+)\s+((?:extra-large |large )?(?:single|twin|double|sofa|bunk|futon))\s*bed/gi;

export function countBeds(text: string): number {
  let n = 0;
  for (let m = BED_RE.exec(text); m !== null; m = BED_RE.exec(text)) {
    n += Number(m[1]) * (BED_VALUES[m[2].toLowerCase()] ?? 0);
  }
  BED_RE.lastIndex = 0;
  return n;
}

/** Lines that are layout, price or amenity chrome - never a unit name. */
const NOISE = new RegExp(
  '^(Price|Includes|Free|Non|Select|Only|We have|Genius|Original|Current|Bathrooms|Cot|Entire|' +
  'Private|Balcony|Garden|Mountain|City|Inner|Air|Dish|Flat|Sound|Barbecue|Terrace|Coffee|Sauna|' +
  'Compare|Pay|No |I\'ll|It only|You won|Recommended|Sleeps|Bedroom|Living|Lower|Breakfast|Parking|' +
  'Kitchen|Patio|Ensuite|Landmark|Accommodation|Room type|Number|Your choices|Getting|Hosted|' +
  'Something|Show|Reserve|This|Prices|Max|Availability|Guests)',
);

/**
 * One entry per unit BLOCK in an availability section: a title line followed shortly by a bed
 * configuration. Amenity and price chrome never is, which is what separates a unit from a label.
 *
 * **Deliberately NOT de-duplicated.** Casutele de la Poienita lists three rooms all named "Double
 * Room"; de-duplicating collapsed them to one, the bed fallback fired anyway, and the property came
 * back as a single 9-person unit. Three identical names are three units.
 *
 * Used to decide whether the bed fallback may fire at all - see `parseBooking`.
 */
export function unitHeadings(seg: string): string[] {
  const titles = (seg.match(/^[A-Z][^\n]{2,58}$/gm) ?? []).filter((n) => !NOISE.test(n));
  return titles
    .filter((n) => {
      const at = seg.indexOf(`\n${n}\n`);
      return at > -1 && /\d+ [a-z- ]*bed\b/i.test(seg.slice(at, at + 400));
    })
    .map((n) => n.trim());
}

export function classifyIdentity(text: string): IdentityState {
  const l = text.toLowerCase();
  if (!l.trim() || text.length < 200) return 'not-loaded';
  if (/(are you a robot|unusual traffic|verify you are human|captcha|security check)/.test(l)) return 'bot-check';
  if (/we have no availability here|no rooms available|not available for your dates/.test(l)) return 'no-availability';
  return 'ok';
}

function parseRatingBooking(t: string): { rating: number | null; reviewCount: number | null } {
  // "Scored 9.9 | 9.9 | Rated exceptional | Exceptional | 15 reviews". Anchored to the whole block:
  // the FIRST "rated N/10" on the page is the LOCATION sub-score, and reading it as the property
  // score is a mistake the page invites.
  const m = t.match(/Scored\s+([\d.,]+)[\s\S]{0,80}?Rated\s+\w+[\s\S]{0,80}?([\d,]+)\s+reviews?/i);
  if (m) return { rating: Number(m[1].replace(',', '.')), reviewCount: Number(m[2].replace(/,/g, '')) };
  return { rating: null, reviewCount: null };
}

function parseAirbnb(t: string): Identity {
  // The header line is a PROPERTY ATTRIBUTE - verified unchanged across ?adults=2 and ?adults=5 on
  // the same listing, unlike anything equivalent on Booking.
  const cap = t.match(/(\d{1,2})\s+guests?\s*·\s*(\d{1,2})\s+bedrooms?/i);
  const guests = cap ? Number(cap[1]) : null;
  const rating = t.match(/\b([45]\.\d{1,2})\b/);
  const reviews = t.match(/(\d[\d,]*)\s+reviews?/i);
  const city = t.match(/Entire\s+[a-z]+\s+in\s+([^,\n]+)/i);
  return {
    state: guests ? 'ok' : 'no-capacity',
    units: guests ? [{ label: 'Entire listing', maxPersons: guests, count: 1, sqm: null }] : [],
    bedsTotal: countBeds(t) || null,
    rating: rating ? Number(rating[1]) : null,
    reviewCount: reviews ? Number(reviews[1].replace(/,/g, '')) : null,
    city: city ? city[1].trim() : null,
    echo: { sleeps: null, recommendedFor: null },
  };
}

/**
 * The unit table, built from PER-UNIT BLOCKS.
 *
 * 🔴 **`Max persons` is a LOWER BOUND that grows with the search.** Measured 2026-09-02 on the same
 * page: Chalet Husky read `Max persons: 2` and `1` when searched with 2 adults, and `4` and `3` when
 * searched with 4. Booking renders rate rows around the party you asked for, so a small search sees
 * only small-occupancy rows. §14.2 called it authoritative and it is not - Vila Luna's `11` was
 * correct only because that search happened to be large enough.
 *
 * The **bed configuration is invariant**: all seven listings probed at 2 and at 4 adults produced
 * byte-identical per-unit bed counts. So capacity per unit is `max(beds in this block, any Max marker
 * in this block)` - the bed count carries it, and the marker can only raise it.
 *
 * Counting beds must be PER BLOCK, never per section: summing the section turned Moon Village's six
 * tiny houses into one 22-person unit, which is the §19.1 error in a new place.
 *
 * A bed count is an UPPER bound on real capacity (our own listing counts to 9 beds against a stated
 * max of 7, because bunks sleep fewer than they seat). That errs in the safe direction: it can only
 * over-include a comparable, never invent a moat, and an over-included one is corrected by the probe
 * that comes back `refused`.
 */
function bookingUnits(seg: string): VerifiedUnit[] {
  const titles: Array<{ at: number; name: string }> = [];
  const re = /^([A-Z][^\n]{2,58})$/gm;
  for (let m = re.exec(seg); m !== null; m = re.exec(seg)) {
    if (!NOISE.test(m[1])) titles.push({ at: m.index, name: m[1].trim() });
  }
  const out: VerifiedUnit[] = [];
  titles.forEach((p, k) => {
    const body = seg.slice(p.at, k + 1 < titles.length ? titles[k + 1].at : seg.length);
    const beds = countBeds(body);
    if (!beds) return;   // a heading with no bed configuration is not a unit
    const marker = [...body.matchAll(/Max\s*(?:persons?|adults?)\s*:?\s*(\d{1,2})(?:[^\d]{0,20}?Max\s*children\s*:?\s*(\d{1,2}))?/gi)]
      .map((m) => Number(m[1]) + (m[2] === undefined ? 0 : Number(m[2])));
    const cap = Math.max(beds, ...(marker.length ? marker : [0]));
    const sqm = (body.match(/(\d+)\s*m²/) || [])[1];
    const same = out.find((u) => u.label === p.name && u.maxPersons === cap);
    if (same) same.count += 1;
    else out.push({ label: p.name.slice(0, 60), maxPersons: cap, count: 1, sqm: sqm ? Number(sqm) : null });
  });
  return out;
}

function parseBooking(t: string): Identity {
  const { rating, reviewCount } = parseRatingBooking(t);
  const cityM = t.match(/,\s*\d{5,6}\s+([A-ZȘȚĂÎÂ][\w șțăîâ.-]+),\s*Romania/)
    ?? t.match(/([A-ZȘȚĂÎÂ][\w șțăîâ.-]+),\s*Romania/);
  const city = cityM ? cityM[1].trim() : null;

  const echo = {
    sleeps: (t.match(/Sleeps:\s*([^\n]{1,40})/i) || [, null])[1] as string | null,
    recommendedFor: (t.match(/Recommended for\s*([^\n]{1,40})/i) || [, null])[1] as string | null,
  };

  const start = t.search(/Select an accommodation type|Select a room type|All available/i);
  if (start < 0) {
    return { state: classifyIdentity(t) === 'ok' ? 'no-capacity' : classifyIdentity(t),
             units: [], bedsTotal: null, rating, reviewCount, city, echo };
  }
  const seg = t.slice(start);
  const units = bookingUnits(seg);
  const bedsTotal = countBeds(seg) || null;
  if (!units.length) {
    return { state: 'no-capacity', units: [], bedsTotal, rating, reviewCount, city, echo };
  }
  return { state: 'ok', units, bedsTotal, rating, reviewCount, city, echo };
}

export function parseIdentity(channel: VerifyChannel, rawText: string): Identity {
  const t = norm(rawText);
  const state = classifyIdentity(t);
  if (state !== 'ok') {
    const partial = channel === 'booking.com' ? parseRatingBooking(t) : { rating: null, reviewCount: null };
    return {
      state, units: [], bedsTotal: null,
      rating: partial.rating, reviewCount: partial.reviewCount, city: null,
      echo: { sleeps: null, recommendedFor: null },
    };
  }
  return channel === 'airbnb' ? parseAirbnb(t) : parseBooking(t);
}

// ---------------------------------------------------------------------------------------------
// The two-occupancy self-check
// ---------------------------------------------------------------------------------------------

export interface ReconcileInput {
  /** The two reads, taken at DIFFERENT search occupancies. */
  a: { occupancy: number; identity: Identity };
  b: { occupancy: number; identity: Identity };
}

export interface Reconciled {
  ok: boolean;
  /** Only the fields that were IDENTICAL across both reads. Anything else is not a fact. */
  stable: Pick<Identity, 'units' | 'bedsTotal' | 'rating' | 'reviewCount' | 'city'>;
  /** Fields that changed between the two reads - proven to be search echoes, discarded. */
  moved: string[];
  /** Why the check could not be run, when it could not. */
  problem?: string;
}

/**
 * What must match for two reads to describe the same property: the unit LABELS and their CAPACITY.
 *
 * `count` is deliberately excluded. It is a lower bound read from however many rate rows the page
 * chose to render, and it moves with the search occupancy - The Cliff Village showed 6 One-Bedroom
 * Villas at 4 adults and 5 at 2 adults, on the same day. Requiring it to match would reject a
 * perfectly good pair over a field that is closer to an echo than a fact, and `sqm` is omitted for
 * the same reason (it is read from whichever row rendered last).
 */
const unitKey = (u: VerifiedUnit[]): string =>
  JSON.stringify([...u].map((x) => [x.label, x.maxPersons]).sort());

/** Inventory is a lower bound, so two reads disagreeing means the larger one saw more of it. */
function mergeCounts(a: VerifiedUnit[], b: VerifiedUnit[]): VerifiedUnit[] {
  return a.map((u) => {
    const other = b.find((x) => x.label === u.label && x.maxPersons === u.maxPersons);
    return {
      ...u,
      count: Math.max(u.count, other?.count ?? 0),
      sqm: u.sqm ?? other?.sqm ?? null,
    };
  });
}

/**
 * Keep only what did not move between two reads of the same listing at two different occupancies.
 *
 * This is the echo check from `extract.ts`, run in reverse. There, a value that fails to move signals
 * a stale render; here, a value that DOES move signals a field that is not a fact. Two page loads per
 * listing, once, at curation time - and it makes the whole class of error impossible rather than
 * merely documented.
 */
export function reconcile({ a, b }: ReconcileInput): Reconciled {
  const empty = { units: [], bedsTotal: null, rating: null, reviewCount: null, city: null };
  if (a.occupancy === b.occupancy) {
    return {
      ok: false, stable: empty, moved: [],
      problem: `both reads used occupancy ${a.occupancy} - the check only means something when the ` +
               `two searches differ, and an unrun check must never pass silently`,
    };
  }
  if (a.identity.state !== 'ok' || b.identity.state !== 'ok') {
    return {
      ok: false, stable: empty, moved: [],
      problem: `reads are ${a.identity.state} / ${b.identity.state} - nothing to reconcile`,
    };
  }

  const moved: string[] = [];
  const same = <T>(x: T, y: T, name: string, eq = (p: T, q: T) => p === q): T | null => {
    if (eq(x, y)) return x;
    moved.push(name);
    return null;
  };

  const unitsAgree = unitKey(a.identity.units) === unitKey(b.identity.units);
  if (!unitsAgree) moved.push('units');
  const units = unitsAgree ? mergeCounts(a.identity.units, b.identity.units) : null;
  const bedsTotal = same(a.identity.bedsTotal, b.identity.bedsTotal, 'bedsTotal');
  const rating = same(a.identity.rating, b.identity.rating, 'rating');
  const reviewCount = same(a.identity.reviewCount, b.identity.reviewCount, 'reviewCount');
  const city = same(a.identity.city, b.identity.city, 'city');

  // The echo fields SHOULD move. If they did not, either the page states nothing (fine) or the two
  // probes were not really different (already caught above) - worth reporting, never worth trusting.
  const echoMoved =
    a.identity.echo.sleeps !== b.identity.echo.sleeps ||
    a.identity.echo.recommendedFor !== b.identity.echo.recommendedFor;

  return {
    ok: units !== null && units.length > 0,
    stable: { units: units ?? [], bedsTotal, rating, reviewCount, city },
    moved,
    ...(units === null
      ? { problem: 'capacity DIFFERED between the two reads - the value read is a search echo, not a fact' }
      : !echoMoved && (a.identity.echo.sleeps || a.identity.echo.recommendedFor)
        ? { problem: 'the echo fields did not move, so this check proves less than it appears to' }
        : {}),
  };
}

/**
 * The identity parser as a string of JavaScript, to run INSIDE the page.
 *
 * There must be two implementations - the extension refuses to let a page's text out in bulk - and a
 * drifted pair is worse than either alone, because the tested one passes while the running one is
 * wrong. `__tests__/verify.test.ts` evaluates this string and asserts it agrees with `parseIdentity`
 * on every fixture. Change one and that test fails until you change the other.
 */
export const IN_PAGE_VERIFIER = String.raw`
var __BEDV={single:1,twin:1,sofa:1,futon:1,double:2,'large double':2,'extra-large double':2,bunk:2};
function __norm(s){return s.replace(/ /g,' ');}
function __beds(s){var re=/(\d+)\s+((?:extra-large |large )?(?:single|twin|double|sofa|bunk|futon))\s*bed/gi,m,n=0;
  while((m=re.exec(s))!==null){n+=(+m[1])*(__BEDV[m[2].toLowerCase()]||0);} return n;}
var __NOISE=/^(Price|Includes|Free|Non|Select|Only|We have|Genius|Original|Current|Bathrooms|Cot|Entire|Private|Balcony|Garden|Mountain|City|Inner|Air|Dish|Flat|Sound|Barbecue|Terrace|Coffee|Sauna|Compare|Pay|No |I'll|It only|You won|Recommended|Sleeps|Bedroom|Living|Lower|Breakfast|Parking|Kitchen|Patio|Ensuite|Landmark|Accommodation|Room type|Number|Your choices|Getting|Hosted|Something|Show|Reserve|This|Prices|Max|Availability|Guests)/;
function __headings(seg){
  var titles=(seg.match(/^[A-Z][^\n]{2,58}$/gm)||[]).filter(function(n){return !__NOISE.test(n);});
  var out=[];
  for(var i=0;i<titles.length;i++){var n=titles[i],at=seg.indexOf('\n'+n+'\n');
    if(at>-1&&/\d+ [a-z- ]*bed\b/i.test(seg.slice(at,at+400))) out.push(n.trim());}
  return out;}
function __classify(t){var l=t.toLowerCase();
  if(!l.trim()||t.length<200) return 'not-loaded';
  if(/(are you a robot|unusual traffic|verify you are human|captcha|security check)/.test(l)) return 'bot-check';
  if(/we have no availability here|no rooms available|not available for your dates/.test(l)) return 'no-availability';
  return 'ok';}
function __bkRating(t){var m=t.match(/Scored\s+([\d.,]+)[\s\S]{0,80}?Rated\s+\w+[\s\S]{0,80}?([\d,]+)\s+reviews?/i);
  return m?{rating:Number(m[1].replace(',','.')),reviewCount:Number(m[2].replace(/,/g,''))}:{rating:null,reviewCount:null};}
function __airbnb(t){
  var cap=t.match(/(\d{1,2})\s+guests?\s*·\s*(\d{1,2})\s+bedrooms?/i);
  var g=cap?Number(cap[1]):null;
  var r=t.match(/\b([45]\.\d{1,2})\b/), rv=t.match(/(\d[\d,]*)\s+reviews?/i), c=t.match(/Entire\s+[a-z]+\s+in\s+([^,\n]+)/i);
  return {state:g?'ok':'no-capacity',
    units:g?[{label:'Entire listing',maxPersons:g,count:1,sqm:null}]:[],
    bedsTotal:__beds(t)||null, rating:r?Number(r[1]):null,
    reviewCount:rv?Number(rv[1].replace(/,/g,'')):null, city:c?c[1].trim():null,
    echo:{sleeps:null,recommendedFor:null}};}
function __bkUnits(seg){
  var titles=[], re=/^([A-Z][^\n]{2,58})$/gm, m;
  while((m=re.exec(seg))!==null){ if(!__NOISE.test(m[1])) titles.push({at:m.index,name:m[1].trim()}); }
  var out=[];
  titles.forEach(function(p,k){
    var body=seg.slice(p.at, k+1<titles.length?titles[k+1].at:seg.length);
    var b=__beds(body); if(!b) return;
    var mk=/Max\s*(?:persons?|adults?)\s*:?\s*(\d{1,2})(?:[^\d]{0,20}?Max\s*children\s*:?\s*(\d{1,2}))?/gi, mm, best=0;
    while((mm=mk.exec(body))!==null){ best=Math.max(best, Number(mm[1])+(mm[2]===undefined?0:Number(mm[2]))); }
    var cap=Math.max(b,best);
    var sq=(body.match(/(\d+)\s*m²/)||[])[1];
    var same=out.filter(function(u){return u.label===p.name.slice(0,60)&&u.maxPersons===cap;})[0];
    if(same) same.count+=1;
    else out.push({label:p.name.slice(0,60),maxPersons:cap,count:1,sqm:sq?Number(sq):null});
  });
  return out;
}
function __booking(t){
  var rr=__bkRating(t);
  var cm=t.match(/,\s*\d{5,6}\s+([A-ZȘȚĂÎÂ][\w șțăîâ.-]+),\s*Romania/)||t.match(/([A-ZȘȚĂÎÂ][\w șțăîâ.-]+),\s*Romania/);
  var city=cm?cm[1].trim():null;
  var sl=t.match(/Sleeps:\s*([^\n]{1,40})/i), rf=t.match(/Recommended for\s*([^\n]{1,40})/i);
  var echo={sleeps:sl?sl[1]:null,recommendedFor:rf?rf[1]:null};
  var start=t.search(/Select an accommodation type|Select a room type|All available/i);
  if(start<0) return {state:__classify(t)==='ok'?'no-capacity':__classify(t),units:[],bedsTotal:null,rating:rr.rating,reviewCount:rr.reviewCount,city:city,echo:echo};
  var seg=t.slice(start);
  var u=__bkUnits(seg); var bt=__beds(seg)||null;
  if(!u.length) return {state:'no-capacity',units:[],bedsTotal:bt,rating:rr.rating,reviewCount:rr.reviewCount,city:city,echo:echo};
  return {state:'ok',units:u,bedsTotal:bt,rating:rr.rating,reviewCount:rr.reviewCount,city:city,echo:echo};
}
function __identity(channel,raw){
  var t=__norm(raw); var st=__classify(t);
  if(st!=='ok'){ var p = channel==='booking.com'?__bkRating(t):{rating:null,reviewCount:null};
    return {state:st,units:[],bedsTotal:null,rating:p.rating,reviewCount:p.reviewCount,city:null,echo:{sleeps:null,recommendedFor:null}};}
  return channel==='airbnb'?__airbnb(t):__booking(t);}
`;

/** The snippet to run in the page after navigating: parses the live document and adds the hero photo. */
export function inPageVerifyRunner(channel: VerifyChannel, listingId: string, occupancy: number): string {
  return `${IN_PAGE_VERIFIER}
(function(){
  var id = __identity('${channel}', document.body.innerText);
  var og = (document.querySelector('meta[property="og:image"]')||{}).content || null;
  // The path embeds the listing id on newer Airbnb listings and on nothing else, so provenance is
  // recorded rather than claimed - an older listing returns a bare uuid and is trusted only because
  // it came from this page load.
  // The listing id may be embedded plainly (Hosting-1404937633401111364) or base64-encoded
  // (Hosting-U3RheVN1cHBseUxpc3Rpbmc6MTA0Ni... decodes to "StaySupplyListing:1046..."). Reading only
  // the plain form filed Villa The Frame's perfectly self-verifying photo as capture-context, which
  // understates provenance. Older listings carry a bare uuid and genuinely have neither.
  var __num = ('${listingId}'.match(/\\d{6,}/) || [''])[0];
  var __hs = og ? (og.match(/Hosting-([A-Za-z0-9+\/=]+)/) || [])[1] : '';
  var __dec = '';
  try { if (__hs && !/^\\d+$/.test(__hs)) __dec = atob(__hs); } catch (e) { __dec = ''; }
  var prov = !og ? null
    : ((__hs && (__hs === __num || (__num && __dec.indexOf(__num) > -1))) || /Hosting-\\d+/.test(og))
      ? 'id-matched' : 'capture-context';
  return JSON.stringify({
    listingId: '${listingId}', occupancy: ${occupancy}, identity: id,
    heroPhotoUrl: og ? og.split('?')[0] : null, photoProvenance: prov,
    len: document.body.innerText.length,
  });
})()`;
}
