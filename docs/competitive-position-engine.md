# The Competitive Position Engine

**Status:** design, 2026-09-01. Companion to `docs/pricing-parity-engine.md`, which deferred this as
decision **D4** ("competitor tracking is wanted, later; build the extension point now, the feature
later") and sketched it in §6. This document is that feature, and it revises §6 in two places where
the owner's own account of how guests choose contradicts the original sketch.

**Audience:** the owner, and any agent executing a phase of the plan in §9.

---

## 0. The decisions that bind this design

Some are inherited from the parity engine and still hold. The new ones are stated as such.

| # | Decision | Consequence |
|---|---|---|
| D1 | *(inherited)* **Airbnb's base prices are not going up.** | Competitor data may never be used to argue for raising a channel base. It reports; the owner decides. |
| D2 | *(inherited)* **Any correction happens on the direct price, downward.** | `indifferencePrice` remains the only hard floor. Market position never overrides it. |
| D4 | *(inherited)* Competitor tracking reuses the parity machinery. | Same store, same write path, same provenance rules, same append-only history. |
| **C1** | **The comparable set is owner-curated and periodically re-verified.** Auto-discovery produces garbage comparables. | `competitorListings` carries `curatedBy` + `verifiedAt`, and the set **ages**: an entry unverified past the budget reads as unverified, not as fact. |
| **C2** | **A competitor observation never moves a price, automatically or by recommendation-with-one-click.** | It is context for a human decision. No solver reads it. `apply-band-pricing.ts` must not import from `src/lib/competitive/`. |
| **C3** | **The comparison unit is the guest-facing total for a stated party on stated dates** - not price per guest-night. | Revises §6 of the parity doc. Reasoning in §2.2. Per-guest-night survives as a *diagnostic*, never as the headline. |
| **C4** | **A comparable that cannot host the party is a finding, not a gap.** | Capacity is a moat on large-party windows. It is reported as position, and it costs zero page loads. |
| **C5** | **Competitor windows are derived from the parity worklist. Never independently.** | If a window has no self quote in the store, it is not probed for competitors. One calendar, one party mix, one set of windows, or the comparison has nothing to compare against. |
| **C6** | **Coverage is replaced by sampling.** Parity's "run until COMPLETE" contract cannot survive N× the cells and would report INCOMPLETE forever. | Every reported figure states its sample size and age. Below a stated threshold the system refuses to rank rather than ranking thinly. |
| **C7** | **A run that costs more than ~40 page loads will not happen.** | Not a preference, an observed fact about this system (parity §1: a 100-load ritual "has run three times, ever"). The default run shape is deliberately narrow, and breadth is the rare mode. §5. |
| **C8** | **Each channel is a separate competitive field. Prices are never pooled across them.** Owner, 2026-09-01: *"comparations are different airbnb vs booking. The audience is different. Even my prices are different. I'm compared in the listing against the properties on the same listing."* | A rank is always *within* one channel, against his price *on that channel*. A property listed on both channels competes in both fields, once in each - that is not double counting, it is two contests. §4.1. |

---

## 1. What this is actually for

Not "what do competitors charge". That question, answered on its own, produces a table nobody acts
on. The owner's stated need is **position** - where he sits, and what to do about it.

Position has **two dimensions**, and the second is the one his existing instruments structurally
cannot see:

**Price position.** For this window and this party, what does the set charge, and where in that range
does he sit? This is the obvious half.

**Absorption.** Which of the set is *still on sale* for that window, and which has gone off sale since
the last reading? This is the half that changes decisions, because it separates the two explanations
of an empty window that look identical from inside his own data:

> *The autumn school break is empty. Is that because he is priced wrong, or because nobody is
> travelling that week?*

His own system cannot answer that. It can tell him he is 13% dearer than Airbnb on 24-28 October
(and it did). It cannot tell him whether six of eight comparable houses sold that week at higher
prices than his - in which case the problem is not price at all - or whether all eight are still
sitting empty, in which case it is demand and no rate change will fix it.

Absorption comes free with the same page load. A page that quotes no price because the dates are
taken is a *recorded outcome* in this system already (`ObservationStatus = 'unavailable'`), and
`extract.ts` already distinguishes it from a minimum-stay refusal and from a failed load. The
machinery exists. Nobody has ever pointed it at anyone else's listing.

**Two further readings fall out of the same data at no extra cost:**

- **Market-wide discounting.** If five of eight comparables drop their October price inside a week,
  a `losing` verdict on his October window means "the market is discounting", not "I am overpriced".
  Those are opposite instructions. The parity engine cannot tell them apart and currently reports
  the first as if it were the second.
- **Where he has less competition.** On a 4+2 party, comparables that sleep four are not competing
  for that booking at all. A window where only three of eight can host the party is a window where
  he has pricing room he does not have on a 2+1 stay. This is C4, and it is measured by *not*
  probing rather than by probing.

---

## 2. Apples to apples, which is the whole difficulty

### 2.1 The set is defined by substitutability, and only the owner knows it

Owner, 2026-09-01:

> *"competition means more or less similar properties [...] even when a family of 2+1 wants to book,
> they book my house because is a nice house with a yard, and will compare me against similar
> properties, not to an apartment"*

Two things in that sentence do design work.

First, **the substitution set is not a capacity band.** An apartment sleeping six is not a comparable
even though the numbers match; a house with a yard sleeping five is, even though they do not. The
criterion is what a guest treats as an alternative, and there is no formula for it. Hence C1: the set
is curated, each entry carries the owner's stated reason it belongs, and that reason is what gets
re-read when the entry is re-verified.

Second, **the same party compares the same set.** A 2+1 family does not shop in the "3-guest
apartment" market and then wander into the house market. They shop houses. So the party is a *probe
parameter*, not a segmentation of the set.

### 2.2 The comparison unit is the party total (revising §6)

The parity doc's §6 proposed normalising to price per guest-night or per bedroom-night within a
capacity band. That is the wrong headline, and the owner's sentence is the evidence.

A family of 2+1 booking a whole house pays **the whole-house price**. They do not pay per head, they
do not compute per-bedroom, and they are not troubled that the house sleeps seven. Their comparison
is: *this house costs 1,490 for our four nights; that one costs 1,780.* That is the comparison that
decides the booking, so it is the comparison the system must report.

Per-guest-night is demoted to a **diagnostic**, and a useful one: it answers "am I dearer because I
am bigger?", which is a question the owner has and the guest does not. It appears as a secondary
column, never as the position.

The practical effect is large and good: **the primary comparison is the same probe shape the parity
system already uses** - same dates, same party, guest-facing total including fees. No new
normalisation layer, no capacity-adjusted index nobody can audit. Apples to apples was already
solved; it just needs pointing at other listings.

### 2.3 Where capacity does enter

Three places, all of them explicit:

1. **Membership.** Owner-curated (C1), with capacity recorded so probes can be skipped rather than
   refused (C4).
2. **Out-of-set probes.** A party above a comparable's capacity is `out-of-set` and costs no page
   load. This is a *positioning fact* and is reported.
3. **The diagnostic column.** Per-guest-night, for explanation only.

What must **not** happen is sending a party a comparable cannot host and filing the refusal as a data
gap. That is precisely the `adults=6` incident from `party.ts` - 38 wrong observations, and refusals
misread as gaps in a listing - repeated at N times the scale, against listings whose capacity we did
not set and cannot correct.

### 2.4 Quality sits beside price, never inside it

A 4.5 with 300 reviews is not a 5.0 with 8. But with six to ten comparables, a hedonic model that
prices those apart is fake science with a confidence interval wider than the answer.

So: **rating and review count are reported next to each comparable's price, and never folded into a
single adjusted number.** The owner reads "the two cheaper ones are 4.6 with 40 reviews; the three
above me are 4.9 with 200+" and makes a judgement no model could make on this sample.

One rule *is* checkable, and is worth firing as a flag because it is unambiguous:

> **priced above a comparable that outranks you on both rating and review count.**

That is a statement about a specific pair of listings, not a model. It goes in `flags[]`.

**The flag needs a review-count floor**, and the measured set (§12) is why: five of the six Airbnb
comparables have fewer than fifteen reviews, and three of those show a perfect 5.0 - one of them from
a single review. Without a floor the flag fires constantly on noise, and a rule that always fires is a
rule nobody reads. A comparable must clear a minimum review count before its rating is allowed to
outrank anything; below that its quality is *unmeasured*, which is different from *low*.

---

## 3. Absorption, and the honesty it requires

This is the highest-value output and the easiest to state dishonestly.

**A page that will not quote is not a sold-out page.** It can be: dates taken, host-blocked, seasonal
closure, a minimum stay longer than the probe, or a listing paused. Four of those are not demand.

So the vocabulary is strict:

| Reading | What it means | What it does NOT mean |
|---|---|---|
| `priced` | On sale at total T | - |
| `not-sellable` | The channel returns no quote for these dates | **not** "sold" |
| `min-stay:N` | Refused, naming a longer minimum | not a gap, and not demand |
| `out-of-set` | Party exceeds recorded capacity | not a refusal; no page was loaded |
| `unknown` | Never sampled, or stale past budget | never borrows a neighbour's value |

The signal that is genuinely strong is a **transition**: a cell observed `priced` on one date and
`not-sellable` on a later one. That one went on sale and came off. Only a transition is described as
"went off sale", and it is always reported with both dates and the last price seen:

> *Casa X was 2,100 on 12 Oct, off sale by 26 Oct.*

Three consequences for the design:

1. **Absorption needs the same cell sampled repeatedly.** That competes with breadth for the page-load
   budget, and the competition has to be resolved deliberately rather than by whoever runs the script.
   §5 makes it an allocation rule.
2. **The append-only store is what makes this possible**, and is already built. A transition is two
   rows for one cell. Nothing new is required of the store.
3. **No percentage-sold is ever reported.** "5 of 7 sampled comparables are no longer on sale for this
   window" is a true sentence. "71% occupancy in the set" is not.

---

## 4. The comparison, assembled

### 4.1 One contest per channel (C8)

An earlier draft of this document pooled the channels: one comparable property, priced at the cheapest
of its listings, ranked once. The owner corrected it, and the correction is structural:

> *"comparations are different airbnb vs booking. The audience is different. Even my prices are
> different. I'm compared in the listing against the properties on the same listing."*

So **there is no single competitive set. There are two**, and they are scored separately:

- **The Airbnb field** - his Airbnb price against the comparables listed on Airbnb.
- **The Booking field** - his Booking price against the comparables listed on Booking.

A house on both channels appears in both fields. That is **not** double counting, because they are two
different contests in front of two different audiences, and his own price differs between them too.
Pooling them would produce a rank that no guest anywhere experiences.

**Consequences that fall out of this, all of them good:**

- The comparison price on his side is always his price **on that channel** - which is already in
  `channelPriceObservations` from the parity run, at no extra cost.
- **His direct price is not a rank.** Nobody browsing a channel sees it beside a competitor. It is
  carried as a **reference line** on every card (it is the price he actually wants booked, and the one
  he controls), but it does not compete for a position it never appears in.
- **A run is scoped to one channel.** This fits the ~30-load sentinel budget neatly instead of
  straining it, and the two fields can run at different cadences - which is right, because he does not
  have the same amount at stake on each.
- Cross-channel identity (`sameAs`, §6.2) becomes **display metadata, not arithmetic**. Knowing Casa X
  is in both sets is useful for curation hygiene and for reading their channel strategy. It never
  merges two rows into one.

### 4.2 What one window looks like

```
24-28 Oct (4n) · family of 3 · Vacanta Toamna          AIRBNB FIELD
  the set     5 of 6 sampled · oldest 9d
              quoted 1,780 - 3,120   median 2,340
              1 not quoting:  AVA Chalet   not sellable (was 2,100 on 12 Oct → off sale by 26 Oct)
  you         2,369  →  4th of 6 on Airbnb
  reference   your direct price for the same stay is 2,281 (not ranked — no guest sees it here)
  flags       priced above Villa The Frame (2,190 · 4.93 · 28 reviews), which outranks you on both
  read        the set is not discounting; one of six has gone off sale since the last run
```

The Booking field renders as its own card, with his Booking price and the Booking comparables. The two
are never averaged, never merged, and may legitimately disagree - that disagreement is a finding about
a channel dial, not a contradiction in the data.

Every number on that card is traceable to a stored observation with a URL, a timestamp and a session.
None of it is computed from a neighbour.

### 4.3 When to refuse to answer

With a curated set of six to ten, a percentile is false precision. **Rank out of N sampled** is
honest, and even that needs a floor:

| Sampled comparables quoting | Output |
|---|---|
| 0-2 | no band, no rank. `confidence: none`. Report the individual readings only. |
| 3 | band and rank, `confidence: indicative` |
| 4+ | band and rank, `confidence: solid` |

`confidence` decays with age on the same schedule the parity board uses. A window whose freshest
comparable is 50 days old is a hypothesis about October written in August.

---

## 5. The budget, which is a first-class resource

This is where the design most differs from parity, and C7 is the reason.

Parity: ~24 windows × 3 parties × 3 channels ≈ 160 cells, "work until complete". It has run three
times, ever.

Competitors with the same ambition: 8 comparables × 24 windows × 3 parties ≈ **576 page loads**. That
is not a slow run, it is a run that will never happen once, and it is also the exact pattern that gets
a residential session bot-flagged.

So the unit of planning is not coverage. It is **three named run shapes with stated budgets**, chosen
by what decision is waiting:

| Run | When | Shape | Budget |
|---|---|---|---|
| **Sentinel** | every 1-2 weeks; the default | the modal party only (2+1), on the 3-5 windows where a decision is live | **~30 loads** |
| **Sweep** | every 6-8 weeks, split across sessions | one representative window per forward pricing period, modal party | ~80-100 loads |
| **Deep** | on demand, before repricing one period | that period only, **all three parties**, full set | ~24 loads |

Priority within any run, because the budget is always smaller than the set:

1. Windows the owner is about to price, or is paying to advertise
2. Windows his own parity board reads `losing` or `overshoot` - the set explains which
3. Near-term **unsold** inventory - where absorption is most actionable and most urgent
4. High-value peaks (NYE, Christmas, Easter, the autumn break)
5. Rotation, for baseline

The sentinel run is deliberately the default, and it is deliberately narrow enough to finish in one
sitting. A system that requires an afternoon decays into a system that ran three times.

### 5.1 How many parties per run, and why the frequent run can use one

The owner asked directly (2026-09-01): *"Should be just one party?"* The honest answer is that one
party is a **budget constraint, not a correctness claim** - more parties is strictly better
information - but the resolution is not "always three" either. **The party count belongs to the run
shape**, and there is a principled reason the frequent run gets most of its value from one.

**Absorption is party-independent; price position is not.** Whether a comparable's dates are taken
does not depend on which party asked about them. But what it *charges* very much does, because these
listings price extra guests differently from each other and from him. So the frequent run - whose
main job is watching who goes off sale - loses little by asking about one party, while the run that
sets a rate loses everything.

**And that one party should be the smallest, 2 adults + 1 child.** Three reasons, in order of weight:

1. **It is the only party the whole field answers.** At 3 guests all 7 comparables can host (§12.2).
   Probing 4+2 drops two of them on capacity - and those two then contribute *no absorption reading
   either*, because no page is loaded. Watching the market with the large party makes the market
   smaller.
2. 3 guests is his `baseOccupancy`, so it is the party his advertised "de la" rate speaks to and the
   one his landing pages quote from.
3. It is the cheapest cell to keep fresh, which is what a sentinel is for.

**Depth of party belongs to the Deep run**, and it is cheap there: 7 comparables × 3 parties × 1
window = **21 loads** for a complete party picture on the period he is about to reprice. That is
exactly when a party-specific mispricing costs real money, and exactly when he is paying attention.

**The arithmetic he is choosing between**, at seven comparables and one channel:

| shape | loads |
|---|---|
| 1 party × 4 windows | **28** |
| 2 parties × 3 windows | 42 |
| 3 parties × 2 windows | 42 |
| 3 parties × 4 windows | 84 |

So the real trade at a ~30-40 load budget is **breadth of windows against depth of party**, and it is
a business choice rather than a technical one.

**If he wants more than one without paying for it: rotate.** The sentinel probes 2+1 every run and
rotates a *second* party across runs, so party coverage accumulates over a cycle instead of being
bought in one go. `parity-pack.ts` already does exactly this with ordinary weekends (a deterministic
week-number rotation), so it is an existing pattern rather than new machinery.

One thing that is **not** being chosen here: the party mix itself. `property.channelPricing.compareParties`
already states it - 2a+1c, 4a, 4a+2c - and the competitive engine reuses it unchanged (C5). What a run
shape picks is the sampling *order*, never a different mix. Two systems disagreeing about what a party
is would be the `adults=6` incident again, in a new place.

**Pacing must move from prose into code.** Today the dwell times, batch sizes and the stop-on-CAPTCHA
rule live only as English inside `SKILL.md`. With N subjects that is no longer a discipline problem,
it is a rate-limit problem, and the run planner should emit the pacing alongside the work rather than
trusting the reader.

---

## 6. Data model

### 6.1 `competitorListings/{propertyId}_{listingId}` (new)

```ts
interface CompetitorListing {
  listingId: string;             // owner-assigned stable slug; part of the cell id, so it never changes
  propertyId: string;            // whose comparable set — never a global list (multi-property rule)
  displayName: string;

  /**
   * The channel this listing competes on. A listing belongs to exactly ONE channel field (C8); the
   * same house on two channels is two records, linked by `sameAs` for display only.
   */
  channel: ChannelId;
  url: string;

  /** ---- what the admin list must show (owner, 2026-09-01): name, city, picture, link ---- */
  city: string;                  // "Comarnic", "Poiana", "Ghioșești" — as the listing states it
  /**
   * Hero photo, from the page's `og:image` — NOT by scraping <img> tags, which return host avatars
   * and UI icons ahead of the listing photo, and which need a fully rendered gallery. The meta tag
   * survives a thin/lazy render (measured: one listing renders at 3.2KB where others reach 9KB).
   *
   * Self-verification is only PARTIAL and must not be over-claimed. Newer listings carry the id in
   * the path (`.../pictures/hosting/Hosting-<listingId>/...`), so the photo proves which listing it
   * belongs to. Older ones do not: listing 27595549 returns a bare
   * `.../pictures/<uuid>.jpg` with no id anywhere in it. So the id check is applied when the pattern
   * is present and the photo is otherwise trusted by CAPTURE CONTEXT (it came from that page load),
   * which is weaker and should be recorded as such.
   *
   * Refreshed at verification; a rotted URL is a signal the set has aged.
   */
  heroPhotoUrl: string | null;

  /** The same physical house on the other channel. Owner-asserted. DISPLAY ONLY — never merged (C8). */
  sameAs?: { listingId: string; assertedBy: string; basis: string };

  capacity: { guests: number; bedrooms: number | null; beds: number | null; bathrooms: number | null };
  propertyType: 'whole-house' | 'cabin' | 'apartment' | 'other';
  distanceKm: number | null;     // from the property, or from a demand anchor (Sinaia, Bușteni)

  /** Quality, as a snapshot with its own date. Never folded into a price (§2.4). */
  rating: number | null;
  reviewCount: number | null;
  qualityAsOf: string | null;

  /** The price-moving ones only: ciubăr, sauna, pool, fireplace, yard. Not a feature dump. */
  amenities: string[];

  /**
   * WHY this competes, in the owner's own words. This is the field that gets re-read at verification
   * time, and it is the only defence against a set that silently rots into "houses near Comarnic".
   */
  substitutionBasis: string;

  active: boolean;
  retiredReason?: string;
  curatedBy: string;
  verifiedAt: string;            // the set AGES (C1)
}
```

### 6.2 A listing belongs to one field; a house may belong to two

Superseded by C8. An earlier draft made the channel a budget-saving *choice* ("pick one canonical
channel per comparable"). It is not a choice - it is what the record **is**. A listing exists on a
channel, competes on that channel, and is ranked there.

So when the owner's Booking set arrives and some entries are the same houses as the Airbnb set, they
become **separate records in separate fields**, linked by `sameAs`. The link is asserted by the owner
with its basis recorded (matching name, capacity, photos, coordinates) because it cannot be inferred
reliably, and it is never used in a calculation.

What the link buys, since it buys nothing arithmetically:

- **Curation hygiene** - the owner can see he has entered the same house twice on purpose, rather than
  wondering whether he has a duplicate.
- **A read on their channel strategy** - the same house priced differently on the two channels is the
  same decomposition his own `anchorPricing` performs on himself. It costs nothing to display and is
  occasionally the most interesting thing on the page.

### 6.3 `channelPriceObservations` - reused, with `subject` finally load-bearing

No new collection, no migration of the 790 existing rows. Two changes:

**Cell identity.** `cellId` is today `propertyId|checkIn|checkOut|guests|channel`. I checked every
use: it is built, compared and sorted, and **never parsed**. So a competitor cell appends a segment
and a self cell is byte-identical to what is already stored:

```
self        prahova-mountain-chalet|2026-10-24|2026-10-28|3|airbnb
competitor  prahova-mountain-chalet|2026-10-24|2026-10-28|3|airbnb|comp:casa-cires
```

Zero migration; collision impossible.

**Scoped reads, enforced at runtime as well as by types.** `loadObservations()` filters only on
`propertyId` and `latestByCell()` keys only on `cellId`. Every reader - including
`apply-band-pricing.ts`, which **writes live prices** - would otherwise ingest competitor rows
silently.

```ts
export type ObservationScope =
  | { kind: 'self' }
  | { kind: 'competitor'; listingId?: string }   // omit listingId for the whole set
  | { kind: 'all' };                             // must be asked for, explicitly, in writing

export async function latestByCell(
  propertyId: string,
  scope: ObservationScope,          // REQUIRED — no default
  sinceIso?: string,
): Promise<Map<string, ObservationRecord>>;
```

A required parameter would normally break every call site at compile time. **It will not here:**
`tsconfig.json` excludes `scripts/`, which is where most callers live, and that exclusion has already
let a broken annotation through once (`parity-pack.ts`, `SpecialPeriodOptions`). So the guard is
**also a runtime throw** when `scope` is absent. Belt and braces, because the failure mode is a
competitor's price silently becoming the owner's on a board that feeds a write path.

### 6.4 Per-subject corrections

Three corrections in the current system are keyed by channel and are only true of the owner's own
listing. Applied to a competitor they fabricate numbers, in the flattering direction.

| Correction | Today | For a competitor |
|---|---|---|
| `standingGuestDiscountPct` | per channel, from `channels` config | **not applicable.** We know the owner's is 0 because he set it. A competitor's is unknowable. Never apply; record the capture as the anonymous list price and say so. |
| `getSettingsChanges` / supersession | keyed to the owner's channel settings | **never supersede a competitor row.** His discount change says nothing about their price. Competitor rows age; they are never superseded. |
| Magnitude guard (`referenceTotal`, 0.5x-2x of direct) | catches units errors | a comparable legitimately at 2.5x is a real reading. Reference becomes **that listing's own recent history**; on a first capture the band widens to 0.25x-4x with the reason recorded. |

And one that must be made unreachable rather than adjusted: **`evaluateParity` must never run on a
competitor row.** `indifferencePrice`, `netAdvantage` and `headroomPct` are computed from commissions
the owner pays. They are meaningless against a listing whose economics he does not know and does not
pay. The type system should make it impossible, not the reader's discipline.

### 6.5 Firestore

- **The missing index finally bites.** `(propertyId ASC, capturedAt ASC)` is in neither
  `firestore.indexes.json` nor the live project, and `loadObservations(propertyId, sinceIso)` needs
  it. At 790 rows nothing has noticed; competitor sampling makes this the normal read path.
  **Caution:** `bookings (status + holdUntil)` and `housekeepingMessages (bookingId + changeType +
  createdAt)` are deployed but absent from the file, so `firebase deploy --only firestore:indexes` is
  **not** a no-op. Reconcile the file with the live project first.
- **`competitorListings` needs a rules block**, in the house style, adjacent to its neighbours:
  `allow read: if isSuperAdmin() || isPropertyOwner(); allow write: if false;` with the writer named
  in a trailing comment.

---

## 7. Code architecture

### 7.1 What is reused unchanged

This is most of it, and it is the argument for building the feature here rather than beside it:

`extract.ts` · `inPage.ts` · `minStay.ts` · `buildCaptureUrl()` · the worklist cell/coverage
primitives · the append-only store · `parity-capture.ts` as the single write path · the echo check ·
the session/provenance rules.

### 7.2 What is new

```
src/lib/competitive/
  set.ts          CompetitorListing type · probesFor(listing, parties) → the parties it can host,
                  and the ones that are out-of-set. PURE.
  position.ts     window × party × self prices × set observations → MarketPosition.
                  Band, rank, sample size, confidence, flags. PURE. Refuses below threshold (§4.3).
  absorption.ts   the append-only history of a (listing, window) → on-sale · went-off-sale(dates,
                  last price) · min-stay-blocked · never-seen. PURE.
  budget.ts       run shape + priority rules (§5) → the allocated work list and its pacing. PURE.

src/services/competitorSetService.ts    CRUD on competitorListings. Admin SDK. Verification aging.

scripts/
  comp-pack.ts    derives the probe list FROM the parity worklist (C5), allocates by budget.ts
  comp-next.ts    outstanding cells with URLs pre-built (reuses buildCaptureUrl)
  comp-report.ts  renders position from the store. Never hand-assembled.
  # capture: EXTEND parity-capture.ts with --subject. Do not fork the write path.
```

Everything decision-shaped is pure and unit-testable. Everything with I/O is a thin service. That is
the existing house pattern (`parityMath`, `parityWorklist`, `parityView`) and it is why those pieces
have tests and the browser loop does not.

### 7.3 The capture protocol has to leave the skill file

Today the loop - navigate, stash in `sessionStorage`, parse once with `IN_PAGE_EXTRACTOR`, echo-check
as a hard abort, pace, record through one write path - exists **only as English inside a 45KB
`SKILL.md`**. A second skill that reuses it becomes a second copy of prose, and prose drifts
invisibly because both copies read as reasonable.

`inPage.ts` already carries this exact lesson: two implementations are tolerable *only* because a test
forces them to agree.

So: extract the loop into **`docs/ota-capture-protocol.md`**, one canonical description, and have both
`ota-parity` and the new `competitive-position` skill point at it rather than restate it. The
skill-specific parts (what to probe, how to judge) stay in each skill; the mechanics live once.

### 7.4 The skill

`competitive-position` - reads a deterministic pack (`comp-pack.ts`), drives the capture loop per
`docs/ota-capture-protocol.md`, records through `parity-capture.ts --subject`, and renders
`comp-report.ts`. It **measures and reports; it never recommends a price** (C2), which makes it a
strictly smaller skill than `ota-parity` - it has no §6b write path at all.

---

## 8. Where it surfaces (this is what makes it a citizen)

A fourth standalone CLI report the owner must remember to run is plumbing. Three integrations make it
part of the system:

1. **`/admin/pricing` → a fifth tab, "The market".** Beside the parity board, because market position
   is a pricing input and the two are read together. **Two panels, one per channel field** (C8), never
   a merged table.

   Plus the **comparable-set manager**, which the owner specified directly (2026-09-01): each entry
   shows its **name, city, a picture, and the link to its Airbnb or Booking listing** - so the set can
   be recognised and checked at a glance rather than read as a list of ids. Alongside those, the
   `verifiedAt` age, so a rotting set is visible without being hunted for, and the `sameAs` link where
   the same house is curated on both channels.

   The picture is not decoration. A curated set is only as good as the owner's ability to look at it
   and say "that one is not really a competitor any more" - and nobody does that from a URL.
2. **The year board gains a market column** per period, next to the parity position it already shows.
   One row per period, two positions, one glance.
3. **The situation pack gains a `market` section.** `SituationPack` today has `inventory`, `channels`,
   `product`, `bookingPace` - and no pricing or market section at all (noted as not built in the
   parity doc §2.3). With one, the analyst can route what is currently unroutable:

   > *"Your emptiest window is one where six of eight comparables are still on sale. That is demand,
   > not price - do not discount it. Your December window is one where five of eight have gone off
   > sale above your rate. That is price."*

   Those are opposite instructions, and today nothing in the system can produce either.

**What must not integrate:** `apply-band-pricing.ts` and the solver must not read
`src/lib/competitive/`. C2 is enforced by import boundary, not by intention. `band-verify` may
*display* market position as context beneath its output; it may not use it as a constraint.

---

## 9. The plan

Phases 0-2 must land in order. Phase 5 waits for data, on the same discipline as D3.

| Phase | | Gate |
|---|---|---|
| **0** | ~~**The seam.**~~ **DONE 2026-09-01** — see §16. | ~~Before a single competitor row exists.~~ |
| **1** | **The set.** ~~`competitorListings` + `competitorSetService` + `set.ts` + the admin management surface.~~ **BUILT 2026-09-01 — see §17.** Outstanding: the owner corrects each `substitutionBasis`, and a verification pass sets `verifiedAt`. | A verified set, or there is nothing to probe. |
| **2** | **Derivation and budget.** `comp-pack.ts` from the parity worklist (C5) + `budget.ts` run shapes. Emits work and pacing; captures nothing. | Reviewed against a real parity worklist before any browser runs. |
| **3** | **Capture.** `docs/ota-capture-protocol.md` extracted; `ota-parity` updated to point at it; `parity-capture.ts --subject`; the `competitive-position` skill. First **sentinel** run only (~30 loads), on windows with a live decision. | First run reviewed end to end before a sweep. |
| **4** | **Reading.** `position.ts` + `absorption.ts` + `comp-report.ts`, with the confidence thresholds of §4.3. | Two sentinel runs apart, or absorption has nothing to compare. |
| **5** | **Surfaces.** The market tab, the year-board column, the situation-pack `market` section. | Only after §4 has produced readings the owner has actually used. |

Phase 0 is small and unglamorous and is the one that must not be skipped: it is the difference between
a competitor's price being a new fact and a competitor's price silently becoming the owner's on a
board that feeds a live write path.

---

## 10. Honesty rules

The parity engine's rules (§7 of that document) all carry over. These are additional, and specific to
having other people's prices in the same store:

- **Sample size and age on every figure.** "6 of 8, oldest 9d" is part of the number, not a footnote.
- **`not-sellable`, never `sold`.** Only an observed transition is described as going off sale, and
  always with both dates and the last price seen (§3).
- **Rank, never percentile.** And no rank at all below three quoting comparables.
- **Quality beside price, never inside it** (§2.4). One checkable flag; no hedonic model.
- **Out-of-set is a finding, not a gap** (C4). It is never counted against coverage.
- **A competitor row is never superseded by the owner's own settings change** (§6.4), and never
  carries a standing-discount correction.
- **Parity verdicts are unreachable from competitor rows** (§6.4). Not discouraged - unreachable.
- **The set ages.** An entry unverified past its budget renders as unverified. A stale comparable is a
  hypothesis about a listing that may have been remodelled, repriced or delisted.
- **Read only, and public prices only.** Same as parity: never sign in as anyone, never complete a
  reservation, stop on the first bot check. Nothing is collected but the publicly displayed price,
  availability and rating of a listing anyone can see.
- **It never moves a price** (C2).

---

## 11. Open questions for the owner

None of these block the design; all of them are parameters it needs.

1. ~~**The set.**~~ **Settled 2026-09-01.** 7 Airbnb (§12) + 8 Booking (§13, §14) active; Pensiunea
   PIRI LAND retired. Still owed per entry: `substitutionBasis` in the owner's own words - the field
   §2.1 exists for, and the only defence against a set that rots into "houses near Comarnic".
1b. **A 2-guest party is now the sharpest gap in the mix.** 11% of his 174 live bookings are 1-2 people,
   and `compareParties` has nothing below 3. With Casutele de la Poienita (3 rooms of 2) and MoodySun
   (sleeps 3) deliberately kept in the set, both are near-invisible under the current mix: Casutele de
   la is in-set for exactly one party and MoodySun for exactly one other. A 2-guest party would let both
   compete properly and would cover a real tenth of his demand. See also the 5-guest gap below.
2. ~~**The modal party.**~~ **Answered in §5.1**, and it turned out not to be a preference: the
   sentinel probes **2 adults + 1 child** because it is the only party all seven comparables answer,
   so any larger party shrinks the field it is meant to watch. Depth of party moves to the Deep run
   (21 loads for a full party picture on one period). What remains open is only whether he wants the
   optional **second-party rotation** on top, at roughly +14 loads per sentinel run.
3. **Cadence.** Sentinel every 1-2 weeks is proposed. It is a standing commitment of about half an
   hour, and the design should match what he will really do rather than what sounds diligent. Now
   doubled by C8: two fields, and they need not run at the same cadence.
4. **Which field matters more.** Two contests now (C8) and the budget funds roughly one sentinel run
   at a time. Airbnb carries the lower commission and the anchor role in his own pricing model; Booking
   takes 23%. Which field does he want watched closely, and which occasionally?
5. **The 5-guest gap.** 36 of 174 bookings are 5 guests - his third-largest party - and it is not in
   `compareParties` at all, while 6 guests (21 bookings) is. This predates the competitive engine: it
   is equally a gap in the existing parity system.
6. **Absorption vs breadth.** When budget is tight, does he want the same few windows watched closely
   (absorption) or more windows seen once (position)? §5 assumes absorption wins on near-term unsold
   inventory and breadth wins on peaks; that is a guess about his priorities and he should correct it.
7. **The amenity finding (§12.3).** Three of six comparables have a wet amenity and he has none. Does
   he want that tracked as a standing structural note on every card, or is it a one-off observation he
   has already priced in and does not need repeated at him?

---

## 12. The Airbnb field, as measured (2026-09-01)

Seven listings supplied by the owner, profiled read-only (9 page loads, no store writes -
Phase 0 is not built yet). This is the identity pass that Phase 1's `comp-verify.ts` will automate;
it is recorded here because it already settles two design questions and raises a business one.

| # | listing | city | type | guests / BR / beds / baths | rating | reviews | amenities seen |
|---|---|---|---|---|---|---|---|
| 1 | Panoramic View Cabin Escape With Bathtub | Comarnic | entire cabin | **4** / 2 / 2 / 2 | 5.0 | **1** | *(thin render)* |
| 2 | Peaceful Forest Haven, Cozy 3-Bedroom Villa | Comarnic | entire cabin | 6 / 3 / 3 / 3 | 5.0 | 5 | hot tub, pool |
| 3 | Adorable 2 Bedroom Tiny Home | Comarnic | entire villa | 6 / 2 / 3 / 1 | 4.75 | 8 | pool |
| 4 | AVA Chalet with Jacuzzi | Comarnic | entire villa | 6 / 2 / 3 / 2 | 4.93 | 28 | hot tub, jacuzzi, fireplace |
| 5 | Villa The Frame · 4BR, Sauna, BBQ & Playground | Ghioșești | entire home | **8** / 4 / 6 / 3 | 5.0 | 13 | sauna, fireplace, bbq, playground |
| 6 | MSC Forest Retreat, Premium A-Frame | Poiana | entire cabin | **3** / 1 / 2 / 1 | 5.0 | 12 | — |
| 7 | Panoramic View & Nature Escape, Ceas cu Cuc Cabin | Gura Beliei | entire cabin | **10** / 4 / 7 / 4 | 4.98 | **98** | fireplace, playground |
| — | **Prahova Mountain Chalet** *(self)* | Comarnic | — | **7** (6 on Airbnb) / 3 / 5 / 2 | — | — | wifi, kitchen, parking, fireplace, tv, garden, mountain-view |

### 12.1 The curation is sound, and the type filter holds

All seven are whole-property listings - "entire cabin", "entire villa", "entire home". No apartments,
no private rooms. The owner's substitutability criterion (§2.1) survives contact with the actual set,
which is not something to take for granted: an auto-discovered set of "6-guest places near Comarnic"
would have pulled in apartments and been worthless.

### 12.2 C4 fires immediately, and it is measured without a single price probe

Capacity runs from 3 to 10. Against the configured party mix, the field **changes size with the party**:

| party | comparables that can host | out-of-set |
|---|---|---|
| 2 adults + 1 child (3) | **7 of 7** | — |
| 4 adults (4) | **6 of 7** | MSC Forest Retreat (3) |
| 4 adults + 2 children (6) | **5 of 7** | MSC (3), Panoramic View Cabin (4) |

This is the moat, quantified, for zero page loads. On a family-of-six stay two of his seven
comparables cannot take the booking at all - which is pricing room he does not have on a 2+1 weekend.
It cuts the other way at the top: **two comparables are LARGER than he is** (Villa The Frame at 8, Ceas
cu Cuc at 10), so on a big-party stay he is mid-field rather than the biggest house in the set. It also
vindicates C3 over the capacity-band normalisation the parity doc originally proposed: a per-guest-night
index would have silently compared him against houses that cannot host the guest.

### 12.3 One incumbent and six new entrants

Review counts: **1, 5, 8, 28, 13, 12** - and then **98**.

The set splits cleanly in two, and the Airbnb listing id gives it away before the reviews do. Six
comparables carry 19-digit ids (recently created); Ceas cu Cuc carries an 8-digit one and has 98
reviews at 4.98. It is the **incumbent**. The other six are **new supply**, four of them wearing a
"Guest favourite" badge earned on fewer than thirty reviews.

That is a market being built out around him, and the two halves are different competitive problems:

- **The incumbent** is bigger (10 guests to his 7), established, and highly rated on a real sample. It
  is the listing whose price genuinely means something, and the one whose absorption is worth watching
  closely - when a house with 98 reviews goes off sale for a window, that window is selling.
- **The new entrants** arrived **with amenities**: hot tub, jacuzzi, pool, sauna, BBQ, playground.
  **Four of the seven have a wet amenity** (hot tub, jacuzzi, pool or sauna). His own recorded list -
  wifi, kitchen, parking, fireplace, tv, garden, mountain-view - has none.

Three consequences, of three different kinds:

- **For the engine:** ratings across the new six carry almost no information (§2.4's review floor
  exists because of this table), and their absorption will be noisy early - a listing with one review
  sells differently from one with ninety-eight, and for reasons that are not price.
- **For sampling:** the incumbent and the new entrants deserve different treatment. A run that can only
  afford part of the field should not drop the one listing whose numbers are load-bearing.
- **For the owner, and this is the largest:** if four of seven comparables have a wet amenity and he
  does not, part of any price gap is **structural, and no rate change will close it**. That is a
  capital-expenditure question wearing a pricing question's clothes. This system should surface it and
  then refuse to act on it - whether it is worth acting on needs demand evidence it does not have.

### 12.4 What is still missing from these records

`distanceKm` (his coordinates are 45.2547, 25.6431; three of the seven are outside Comarnic -
Ghioșești, Poiana and Gura Beliei), `heroPhotoUrl` for six of the seven, and the display name for
listing 1, whose page renders thin
(3.2KB against 9KB for the richest) and did so on both attempts. That thin render is itself a design
input: **`comp-verify.ts` must poll a readiness predicate, not wait a fixed interval**, or it will
file a real listing as unreadable.

---

## 13. The Booking field, as measured (2026-09-01)

Nine listings supplied by the owner, profiled read-only (10 page loads, no store writes). Under C8
this is a **separate contest**, not an extension of §12.

| # | listing | largest SINGLE unit | size | score /10 | reviews | what it actually is |
|---|---|---|---|---|---|---|
| B1 | The Cliff Village | **max 8-9 adults** (Deluxe Villa) | 200-300 m² | **10** | 68 | a village of separately bookable whole villas: 2BR/200 m² (max 6), 3BR (max 8-9), 4BR/300 m² |
| B2 | Casutele din Poienita | **max 4 adults** (Two-Bedroom Chalet) | 40-65 m² | 9.6 | **157** | chalet park: one 2BR chalet + several 1BR chalets (max 2 each) |
| B3 | Casutele de la Poienita | 3 × Double Room, **max 2 each** (1 left of each) | 17 m² | 9.9 | 15 | hosts 4 across two cabins (§13.9). **A different property from B2** (owner-confirmed) |
| B4 | Villa The Frame | max 8 *(Airbnb)* | 195 m², 4BR | 9.7 | 21 | single whole house · = A5 |
| B5 | MoodySun Studio, remote tiny home | studio | **21 m²** | 9.3 | 49 | a studio |
| B6 | Pensiunea PIRI LAND | **max 2 adults** (King Room) | 19 m² | 9.7 | 35 | guesthouse letting rooms |
| B7 | AVA Chalet | max 6 *(Airbnb)* | 120 m² | 9.5 | 11 | single whole house · = A4 |
| B8 | Cozy A-Frame Ayda | 2BR | 80 m² | — | **0** | brand new, no reviews yet |
| B9 | Vila Luna | **Max persons: 11** | 200 m², 4BR | **10** | 57 | one Four-Bedroom House, LARGER than his (owner-corrected - see §13.7) |

**Read, not scraped.** The first pass regexed these pages and got three of them badly wrong: The Cliff
Village as a single 200 m² villa (it is a village), Vila Luna as "11 bedrooms" (it is one four-bedroom
house), AVA Chalet as "6 bedrooms". The numbers were plausible and wrong, which is the dangerous
combination. See §13.6.

### 13.1 Only two identities are confident, and under C8 that is fine

Proposed `sameAs` links, for the owner to **assert or reject** - never inferred (§6.2):

| confidence | link | evidence |
|---|---|---|
| **high** | B4 ↔ A5 Villa The Frame | identical name, 4 bedrooms both, 195 m² against 8 guests/4BR |
| **high** | B7 ↔ A4 AVA Chalet | identical name, same town |
| **low - probably NOT the same** | B8 Cozy A-Frame Ayda ↔ A6 MSC Forest Retreat | both A-frames, but different names, different towns (Comarnic vs Poiana) and different sizes (2BR/80 m² vs 3 guests/1BR). **Two A-frames, not one listed twice.** |

Five Booking entries have no Airbnb counterpart and five Airbnb entries have no Booking counterpart.
Under the pooled model this would have been a problem to solve. Under C8 it is simply the shape of the
two markets: **he faces different competitors on each channel**, which is itself worth knowing and is
an argument for watching both.

### 13.2 The comparable is the UNIT, not the property

An earlier draft of this section said multi-unit properties "break absorption and must be flagged out".
Having actually read the pages rather than regexed them, that was both wrong and more complicated than
necessary. The real model is simpler.

**A property offering several units is offering several possible substitutes.** The Cliff Village is not
one competitor with an asterisk; it is a 200 m² two-bedroom villa (max 6 adults) *and* a three-bedroom
deluxe (max 8-9) *and* a four-bedroom 300 m², each separately bookable, each a whole house with its own
kitchen. A family of six choosing between his chalet and the Cliff Village's two-bedroom villa is an
ordinary head-to-head contest. Nothing about it needs special handling.

**So the rule is one line:**

> The comparable price for a party is **the cheapest single unit that can host the whole party.**

And the useful discovery: **`extract.ts` already implements exactly this.** It attributes each price to
its nearest preceding capacity marker and discards rows too small for the party - built to stop a
three-adult rate being banked as the price for a family of six. That is precisely the multi-unit rule.
**No new price machinery is needed at all.**

### 13.2b Splitting a party across units: deliberately not modelled

The owner raised the real subtlety (2026-09-01):

> *"for example we are a group of 6 adults, we can share 2 or 3 units. If I'm with kids, is less likely
> to put small children in another unit. I can do that if they are older."*

That is correct, and it is also the thing to **not** build. His own reasoning gives the rule for free:

- **Parties with children do not split.** Two of his three configured parties (2a+1c and 4a+2c) have
  children, so for those the single-unit rule is not an approximation - it is the right answer.
- **The all-adult party might split**, and modelling that means pricing every combination of units,
  which is a solver nobody asked for, over a possibility the channel may or may not sell.

So: when no single unit can host the party, the cell is recorded as
**`refused: no single unit fits this party`** - an honest **unknown**, never a moat. That direction
matters. Recording it as "no competition here" would claim he is unopposed on exactly the windows where
a park could sell two cabins, and it would claim it in the flattering direction, which §10 forbids.

If he ever wants a combination price for a specific window, it is one manual look at the page. It is not
a feature.

**One new field carries all of this:**

```ts
/**
 * The capacity of the LARGEST single unit — not the property's total capacity.
 *
 * This is what decides substitutability, because the parties that matter here do not split (§13.2b).
 * Casutele din Poienita sleeps a dozen people across its chalets and its largest single unit takes
 * 4 adults, so it is a comparable for a family of three and NOT for a family of six. Total capacity
 * would have said the opposite.
 *
 * Known from the listing page on Airbnb; on Booking it comes from the first priced probe (§13.3).
 */
largestUnitCapacity: { adults: number; children?: number } | null;

/** Descriptive only, for the admin card: how many separately bookable units the listing offers. */
unitCount: number | null;
```

### 13.2c Absorption on a multi-unit property, corrected

The earlier draft excluded these listings from the absorption signal. Reading the pages showed that is
throwing away the **better** data, not protecting against worse:

- Booking states scarcity out loud. The Cliff Village's villas each carry **"We have 1 left"**, and
  Casutele de la Poienita's rooms do too. That is inventory pressure - strictly richer than the binary
  on-sale/off-sale a single house gives.
- A multi-unit property that stops quoting **entirely** has sold *every* unit. That is a stronger demand
  signal than one house going off sale, not a weaker one. It is simply rarer, so it should not be
  expected at the same frequency.

The honest rule: **record the scarcity line when the page states it; never read "still quoting" from a
multi-unit property as evidence the window is empty.** No exclusion needed.

### 13.3 Capacity is asymmetric between the two channels

Airbnb states guest capacity on the listing page (`6 guests · 3 bedrooms · 3 beds · 3 baths`), read
cleanly for all seven in §12. **Booking does not.** The bedroom counts scraped from the undated page
are unusable - 6 for The Cliff Village, 6 for AVA Chalet, 11 for a 200 m² Vila Luna - because the
number is picked from unit lists and facility text, not from a capacity field.

Booking's authoritative capacity lives in the **rate rows of a priced probe**, worded `Max persons: 4`
or `Max adults: 4 / Max children: 2` - which `extract.ts` **already parses**, because reading it wrong
is what once banked a three-adult rate as the price for a family of six.

Consequence for the plan: **on Booking, capacity (and therefore C4's out-of-set moat) is only known
after the first priced probe.** Phase 1 records `capacity: null` for Booking entries and Phase 3 fills
it from the first capture. Do not let an identity pass guess it.

### 13.4 Which of these can actually host his parties

With `largestUnitCapacity` read from the pages, the Booking field resolves cleanly - and it is a
*different field per party*, exactly as C4 predicted:

| listing | largest single unit | 2a+1c (3) | 4 adults | 4a+2c (6) |
|---|---|---|---|---|
| The Cliff Village | **10** (Deluxe Villa) | ✓ | ✓ | ✓ |
| Villa The Frame | 8 | ✓ | ✓ | ✓ |
| Vila Luna | **11** | ✓ | ✓ | ✓ |
| AVA Chalet | 6 | ✓ | ✓ | ✓ |
| Cozy A-Frame Ayda | 5 | ✓ | ✓ | ✗ |
| Casutele din Poienita | 4 (Two-Bedroom Chalet) | ✓ | ✓ | **✗ single unit** |
| MoodySun Studio | **3** (double + sofa) | ✓ | ✗ | ✗ |
| Casutele de la Poienita | **2** per room, ×3 | ✗ *(child; no single unit takes 3)* | **✓ 2 rooms** | ✗ |
| ~~Pensiunea PIRI LAND~~ | 2 | *retired 2026-09-01* | | |

**The field changes size and membership with the party**, which is the whole of C4 made concrete:

| party | Booking field | who drops out |
|---|---|---|
| 2 adults + 1 child | **7 of 8** | Casutele de la Poienita |
| 4 adults | **7 of 8** | MoodySun Studio |
| 4 adults + 2 children | **4 of 8** | Ayda, Casutele din, MoodySun, Casutele de la |

At six people he faces four houses. At three he faces seven - **but not the same seven**. MoodySun and
Casutele de la Poienita are each in-set for exactly one party, and never the same one, so the two never
appear on a card together.

**Vila Luna deserves singling out**, though not for the reason the first pass gave. It is one
Four-Bedroom House, 200 m², **Max persons: 11** - so it is not his structural twin, it is a *larger*
house than his (7). It competes for every one of his parties AND for groups he cannot take at all.
Perfect 10 on 57 reviews, in his town. For 24-28 Oct at 4 adults + 2 children it quoted **4,180 lei for
4 nights, free cancellation, no prepayment, no credit card needed**, and "We have 1 left". §13.7 covers
what reading it carelessly got wrong, and what its pricing reveals.

**The set is settled (owner, 2026-09-01).**

- **Out: Pensiunea PIRI LAND.** Its largest unit is a King Room for 2 adults and it lets rooms rather
  than houses. Recorded as `active: false` with the reason, not deleted, so the judgement stays visible
  and reverses in one click. *(Caveat: my own reading of PIRI LAND was a sliced one, §13.10, so it is
  not independent evidence. The removal rests on the owner's knowledge of the property - the right
  authority under C1 - but re-read the page in full if it is ever reconsidered.)*
- **In: Casutele de la Poienita.** Nearly removed on my sliced reading; read properly it hosts four
  adults across two of its three cabins (§13.9).
- **In: MoodySun Studio.** 21 m², one large double plus a sofa bed - it takes a party of three in a
  single unit, so it is a genuine comparable for a 2+1 family.

Owner's reasoning, and it overrides my earlier hesitation: *"they're both real competitors."* He knows
the market; my objection was a guess about guest behaviour dressed as an analysis, and it was made on
incomplete reads of both pages.

**Why keeping the small units is safe, structurally.** My earlier worry was that they would drag the
band's floor down and make him look expensive. They cannot: comparison is per-party (C3/C4), and a
listing that cannot host the party is out-of-set and never enters that party's band at all. Casutele de
la Poienita's 1,647 lei cabin sits in the 4-adult band, where it is a real alternative, and is absent
from the 4+2 band entirely. The design already handles this; it is not a risk being accepted.

*(Owner-confirmed 2026-09-01: "din" and "de la" Poienita are genuinely different properties, and the
data agrees - "din" lets chalets up to 4 adults, "de la" lets 17 m² double rooms.)*

### 13.5 The rating scales never meet, and C8 is why

Airbnb rates out of 5 (4.75 to 5.0 here), Booking out of 10 (9.3 to 10). Any pooled model would have
needed a scale reconciliation nobody could validate on this sample size. Because C8 keeps the fields
separate, **the two scales never appear in the same comparison** and no reconciliation is needed. The
quality flag (§2.4) compares within a field, against its own scale, with its own review floor.

A worked example of why the floor matters, from this data: five of the nine Booking listings score 9.5
or above, and two score a perfect 10. On Booking's distribution that is close to undifferentiated.
Score alone separates almost nothing here; review count does the work.


### 13.6 Method: identity is READ, price is PARSED

The most useful thing this pass produced is a correction about how to capture.

The first attempt regexed the Booking pages for bedrooms, capacity and type. It returned plausible
numbers that were wrong on three of nine listings - a village of villas read as one 200 m² villa, a
four-bedroom house read as eleven bedrooms, a 120 m² chalet read as six bedrooms. Nothing in the output
looked broken. Had those gone into `competitorListings`, the set would have carried three false capacity
records and C4 would have computed moats that do not exist.

Reading the pages' **availability section verbatim** answered every question immediately and
unambiguously, because Booking states it plainly: *"Accommodation Type"*, *"Two-Bedroom Villa"*,
*"Recommended for 4 adults, 2 children"*, *"Max adults: 6"*, *"We have 1 left"*.

So the two capture jobs are different in kind and must not share an approach:

| job | method | why |
|---|---|---|
| **Identity / curation** (`comp-verify.ts`) | pull the availability section as **text** and read it | It is a judgement task run rarely, on a handful of listings, where being wrong is silent and poisons everything downstream. |
| **Price** (the capture loop) | the tested parser, `extract.ts` | It is a mechanical task run hundreds of times, on a known layout, with an echo check and a magnitude guard behind it. |

This is not a contradiction of the parity skill's "do not hand-roll page-reading regex" rule - it is the
same rule. That rule exists because a tested parser already handles the repeated mechanical read. There
is no tested parser for "what kind of property is this", there should not be one, and the answer to a
question asked eleven times is to look.

### 13.7 "Sleeps" and "Recommended for" ECHO THE SEARCH. They are not capacity.

The owner corrected the record (2026-09-01): *"Villa Luna has 4 bedrooms. It has a max capacity of 11
people (the count also sofa beds)."* He is right, and chasing why the page said otherwise turned up the
sharpest extraction trap in this document.

**The experiment.** The same unit, the same dates, two searches:

| searched occupancy | what the unit's line said | bed configuration |
|---|---|---|
| `group_adults=4&group_children=2` | "Recommended for **4 adults, 2 children**" · "Sleeps: **4 adults, 2 children**" | unchanged |
| `group_adults=8&group_children=0` | "Recommended for **8 adults**" · "Sleeps: **8 adults**" | unchanged |

**Both fields simply restate what you asked for.** They carry no information about the unit whatsoever.
An identity pass that read either one would record whatever occupancy it happened to search with - so
two verification runs would disagree, neither would be reproducible, and the recorded capacity would be
an artefact of the URL rather than a fact about the house.

The damage that would do is specific and one-directional: under-recording capacity marks a unit
**out-of-set** for larger parties, which C4 then reports as a **moat**. The system would tell him he has
no competition on precisely the windows where he does. That is the flattering-direction error §10
forbids, arriving through a field that looks like a fact.

**Where capacity actually lives**, both stable across searches:

1. **`Max persons: 11`** (adults-only search) or `Max adults: N / Max children: M` (when the search
   includes children) - the rate row's capacity marker. **`extract.ts` already parses both wordings**,
   because attributing prices to the right capacity marker is the trap it was written for. Nothing new
   to build; it just has to be the field that is read.
2. **The bed configuration** - `Bedroom 1: 1 single bed and 1 large double bed · Bedroom 2: 1 double
   bed · Bedroom 3: 1 double bed · Bedroom 4: 1 large double bed · Living room: 1 sofa bed · Living
   room: 1 sofa bed`. Identical under both searches. Counted: 3 + 2 + 2 + 2 = 9 in the bedrooms, plus
   two sofa beds = **11**, which is exactly the owner's figure. This is the human-readable ground truth
   and it is what `comp-verify.ts` should surface for a person to confirm.

**A free self-check falls out of this.** Because the echo fields move with the search and the real
fields do not, `comp-verify.ts` can *prove* it read a stable field: probe the same unit at two
occupancies and keep only what did not change. Two page loads per listing, once, at curation time - and
it makes the whole class of error impossible rather than merely documented. It is the echo check from
`extract.ts` run in reverse: there, a value that fails to move signals a stale render; here, a value
that moves signals a field that is not a fact.

### 13.8 Vila Luna prices the whole house flat, and that is a finding about HIS pricing

The same probe answered a second question by accident. For 24-28 October, four nights:

| party | Vila Luna |
|---|---|
| 4 adults + 2 children (6 people) | **4,180 lei** |
| 8 adults | **4,180 lei** |

**Identical.** It sells the house, not the heads - at least across 6 to 8 people.

His own engine does the opposite: `extraGuestFee` of 75 per head above a `baseOccupancy` of 3. On a
party of six that is 3 × 75 = **225 lei per night** added to his price, against **zero** at Vila Luna.
Over four nights that is 900 lei of pure structural gap, before either party's nightly rate is
considered.

This is not a new phenomenon in this system - it is the one the parity skill already warns about in §5
(*"the two extra heads cost 450 lei on his site and 24 on Booking"*), where the fix is **the fee, not the
nightly rate**, because a solver asked to close a per-head gap by moving the rate will move the whole
period and still fail. What is new is that a competitor now demonstrates it too, so it is a market norm
rather than an OTA quirk.

Two things follow, and only the first belongs to this engine:

- **The competitive engine must report the party-size gap explicitly**, not just the headline. A window
  can be healthy at 2+1 and losing at 4+2 for reasons no rate change can fix, and the card should say
  which.
- **Whether to keep charging per head is his decision**, and it is a pricing decision, not a competitive
  one. C2 holds: this system surfaces the fact and stops there.

### 13.9 Combinations ARE priced for adult parties (correcting §13.2b)

Owner, 2026-09-01, on Casutele de la Poienita: *"they can accommodate 4, no problem. Have you
checked?"* He was right and §13.2b was too conservative. Re-read with `group_adults=4` over the **whole**
8,450-character availability section:

```
Select a room type and the number of rooms you want to reserve.
  Double Room · 1 large double bed · 17 m² · Max persons: 2 · 1,647 lei (was 1,850, 11% Genius) · We have 1 left
  Double Room · 1 double bed      · 17 m² · Max persons: 2 · 1,850 lei                          · We have 1 left
  Double Room ·                     17 m² · Max persons: 2 ·                                     · We have 1 left
```

No single unit takes 4. But **three units are available, six person-places in total**, and Booking's own
UI is built for it: *"select ... the number of rooms you want to reserve"*, with a quantity control per
row. A party of four books two cabins for roughly **3,497 lei / 4 nights**. That is a real, purchasable,
comparable offer, and §13.2b would have recorded it as `unknown`.

**The corrected rule, still one line and still not a solver:**

> For a party **without children**, the comparable price is the **cheapest combination of available
> units that seats the party** - a greedy sum over the unit rows, cheapest first, respecting each row's
> remaining stock. For a party **with children**, it remains the cheapest **single** unit that fits.

Every input is already on the page and already parsed: `extract.ts` reads the capacity markers, the
prices and the promo pair. The change is that instead of *discarding* rows too small for the party, an
adults-only probe *accumulates* them. Roughly fifteen lines, no optimisation, no search.

Two guards keep it honest:

- **Stock is binding.** "We have 1 left" means the cheapest row cannot simply be doubled. A combination
  that ignores availability invents a price nobody can buy.
- **The card must SAY it is a combination** - `3,497 (2 units)`, never a bare 3,497. Two 17 m² cabins
  are a different product from one house, and the owner is entitled to see that in the number rather
  than have it averaged away.

The child rule is unchanged and remains the owner's: *"If I'm with kids, is less likely to put small
children in another unit."*

**So `largestUnitCapacity` was the wrong shape.** A scalar cannot express "three rooms of two". The
record is a **unit table**, which is also exactly what the combination rule consumes:

```ts
/**
 * Every separately bookable unit type, as the availability section lists them. Replaces the scalar
 * `largestUnitCapacity`, which could not express "three rooms of two, one of each left" — and which
 * would have written off a property that comfortably hosts a party of four.
 *
 * `count` is stock AT THE TIME OF CAPTURE, not a property of the listing: it moves as the place sells,
 * and that movement is the absorption signal (§13.2c).
 */
units: Array<{ label: string; maxPersons: number; count: number | null }>;
```

### 13.10 I sliced the page twice and was wrong twice

Both errors in this section came from the same act: reading the first ~780 characters of the
availability section instead of all of it. It cost a wrong capacity for The Cliff Village (a village of
villas read as one villa) and a wrong verdict on Casutele de la Poienita (written off as unable to host
a party it hosts comfortably).

The rule was already written down, in `ota-parity/SKILL.md` §4.9:

> **Never slice the page.** A 700-char `head` looks sufficient and is not: Booking's rate rows sit far
> below the fold, so a slice captures the summary price and silently misses every capacity marker.

It is stated there about price capture. It is at least as true of identity capture, and this document
should not have needed to rediscover it. **`comp-verify.ts` reads the availability section in full and
records every unit row.** A partial read is not a smaller answer, it is a confidently wrong one.

---

## 14. The full read (2026-09-01)

Every listing re-read in full, per §13.10, on one standardised probe: **24-28 Oct 2026 (4 nights),
2 adults, RON** - deliberately a small party so no unit row is filtered out. 14 further page loads.

### 14.1 The Booking field, properly

| listing | units offered | largest single unit | from (4n) | stock |
|---|---|---|---|---|
| The Cliff Village | **3 types** | One-Bedroom Villa max 4 (80 m², 4,480) · Two-Bedroom Villa max 6 (200 m², 7,600) · **Deluxe Villa max 10** (300 m², 13,300) | 4,480 | 1 left on the smaller two |
| Casutele din Poienita | **3 units** | Two-Bedroom Chalet, 4 (65 m²) · 2× One-Bedroom Chalet, 3 each (40 m²) | — | ~10 person-places |
| Casutele de la Poienita | **3 × Double Room** | 2 each (17 m²) | 1,647 | 1 left of each |
| Villa The Frame | single | Superior Villa, **beds 8** (195 m²) | **4,752** (19% off 5,887) | 1 left |
| AVA Chalet | single | Two-Bedroom Chalet, **beds 6** (120 m²) | **5,040** | — |
| Cozy A-Frame Ayda | single | Two-Bedroom Chalet, **beds 5** (80 m²) | **2,803** | — |
| MoodySun Studio | single | 21 m², 1 large double + 1 sofa = **3** | — | **NO AVAILABILITY 24-28 Oct** |
| Vila Luna | single | Four-Bedroom House, **Max persons 11** (200 m²) | 4,180 *(read at 4a+2c)* | 1 left |

Corrections this pass produced against the sliced read: The Cliff Village's largest unit is **10**, not
8-9. AVA Chalet is a single Two-Bedroom Chalet sleeping 6, not "6 bedrooms". Casutele din Poienita's
One-Bedroom Chalets sleep **3** (a sofa bed), not 2.

**These are exploratory reads, not observations.** Nothing here has been through `parity-capture.ts`,
so none of it carries provenance, a session record or a magnitude guard. It demonstrates the instrument;
it is not the measurement. No comparison against his own prices should be drawn from this table - his
Booking price for the same window has to come from the store, or it is the like-for-like violation §10
forbids.

### 14.2 Capacity has three sources, in strict order

| rank | source | when it exists | trust |
|---|---|---|---|
| 1 | **`Max persons: N` / `Max adults: N`** | multi-unit pages only, and not on every search | authoritative; `extract.ts` already parses both wordings |
| 2 | **bed configuration**, counted | always | authoritative, and validated twice below |
| 3 | ~~`Sleeps:` / `Recommended for`~~ | always | **never use** - echoes the search (§13.7) |

Rank 1 is not always available: **Villa The Frame's page carries no capacity marker at all**
(`hasMax: false`), because Booking only renders that column where multiple rows must be told apart. A
verifier relying on it alone silently fails on every single-unit property - which is most of the field.

**The bed table**, calibrated against two independent checks:

```
single 1 · twin 1 · sofa 1 · futon 1 · double 2 · large double 2 · extra-large double 2 · bunk 2
```

- Vila Luna: 3+2+2+2 across four bedrooms, plus two sofa beds = **11**, matching `Max persons: 11`
  *and* the owner's own figure.
- Villa The Frame: 4 × large double = **8**, matching its Airbnb listing's stated "8 guests".

Two independent confirmations, from two different sources, on two different properties. `sofa = 1` is
the one value that was genuinely uncertain and both checks land on it.

### 14.3 Airbnb states capacity; Booking echoes the search. Proven both ways.

The same listing (AVA Chalet, Airbnb) loaded at two occupancies:

| `?adults=2` | `?adults=5` |
|---|---|
| `6 guests · 2 bedrooms · 3 beds · 2 baths` | `6 guests · 2 bedrooms · 3 beds · 2 baths` |

**Unchanged.** Airbnb's header is a property attribute, so reading it once is safe and the seven Airbnb
records in §12 stand. Booking's `Sleeps:` line moved from "4 adults, 2 children" to "8 adults" under the
same test (§13.7). Same experiment, opposite results, and it is exactly the self-check §13.7 proposed -
so run it, once, per channel, rather than trusting either page's wording.

### 14.4 The first absorption reading arrived for free

**MoodySun Studio: "We have no availability here between Sat 24 Oct 2026 and Wed 28 Oct 2026."**

One probe, one standardised window, and the studio is already not sellable for his emptiest week while
every other comparable still quotes. That is the signal this whole engine exists to produce, and it
turned up on the first properly-run pass without costing an extra page load - exactly as §1 argued it
would.

It is **one** reading, so it is `not-sellable`, not "sold" (§3). It becomes evidence of selling only if a
later probe shows it was priced before and is not now. That is the second data point the sentinel
cadence exists to collect.

### 14.5 A parsing gotcha worth carrying into the code

Booking renders prices with a **non-breaking space** before the currency: `Price 5,040 lei` is
`Price 5,040 lei`. A plain-space regex returns nothing and, worse, returns it *silently* - the first
run of this extractor reported every price as `?` while getting capacities right, which reads like a
layout change rather than a whitespace bug.

`extract.ts` already normalises this (`norm = s.replace(/ /g,' ')`). `comp-verify.ts` must do the
same on its very first line, before any matching.

---

## 15. `substitutionBasis` - first drafts, for the owner to correct

C1 requires each entry to carry **the owner's** stated reason it competes. These are **not that yet**.
They are drafts written from the measured data (§12, §13, §14) so that correcting is cheaper than
composing. Until he edits them, every row carries `curatedBy: 'claude (draft)'` and
`verifiedAt: null` - an un-corrected draft recorded as the owner's reasoning would defeat the entire
purpose of the field.

The test each line has to pass: **a year from now, can someone read it and check whether it is still
true?** "Similar house nearby" fails. A capacity, a party and a reason pass.

### 15.1 Airbnb field

| listing | draft `substitutionBasis` |
|---|---|
| Peaceful Forest Haven (6 · 3BR) | Closest Airbnb match on layout: same town, whole cabin, **three bedrooms like ours**, same headcount. Adds a hot tub and pool we do not have. The default comparison for a family of 5-6. |
| AVA Chalet with Jacuzzi (6 · 2BR) | Same guest cap as our Airbnb listing, same town, whole villa. Leads on a jacuzzi, so it takes the guest who is choosing on amenity rather than space. |
| Adorable 2 Bedroom Tiny Home (6 · 2BR · 1 bath) | Same headcount, fewer bedrooms and a single bathroom. Competes on price for a family of six willing to share, not on comfort. |
| Panoramic View Cabin (4 · 2BR) | Whole cabin in Comarnic for a smaller party. Competes for 2+1 and 4-adult stays where the draw is the view and privacy rather than the biggest house. **Least confident of the seven** - its page renders thin and was never read in full. |
| Villa The Frame (8 · 4BR) | A size up, family-oriented (playground, BBQ, sauna), ~10 min away. Takes our larger family bookings and groups we cannot host at all. |
| Ceas cu Cuc Cabin (10 · 4BR · 98 reviews) | The established incumbent: bigger, and the only listing in the set with real review history. Competes for larger groups and for guests who filter on review count, where we lose to it on volume. |
| MSC Forest Retreat A-Frame (3 · 1BR) | Design-led small cabin. Competes only for couples and 2+1 who want the A-frame experience over space - it cannot take our core party. |

### 15.2 Booking field

| listing | draft `substitutionBasis` |
|---|---|
| Vila Luna (11 · 4BR · 200 m² · 10/57) | Our most direct Booking competitor: a whole house of our size in our town, perfect score on real volume, and **flat-rate whatever the party size** - so it beats us by more the larger the group (§13.8). |
| The Cliff Village (3 villas, up to 10 · 10/68) | Three villa sizes on one site, so it competes at *every* party size we sell. Its 200 m² two-bedroom villa is a direct match for our family bookings. |
| Villa The Frame (8 · 195 m² · 9.7/21) | Same property as the Airbnb entry, competing separately here (C8), and it discounts on Booking (19% off when read). Watch the two channels apart. |
| AVA Chalet (6 · 120 m² · 9.5/11) | Same property as the Airbnb entry. Same guest cap as us, same town - a like-for-like whole-chalet alternative on our core party. |
| Cozy A-Frame Ayda (5 · 80 m² · new) | Currently the **cheapest whole place** in the Booking field. Brand new with no reviews, so it is buying its first bookings on price - which makes it a short-term threat on 3-5 guest stays and an unknown after that. |
| Casutele din Poienita (largest unit 4 · 9.6/157) | A chalet park with the most reviews in the set. Takes a family of 3-4 wanting a whole cabin cheaply. Cannot take six in one unit, so it drops out of our largest party. |
| MoodySun Studio (3 · 21 m² · 9.3/49) | A well-reviewed 21 m² studio that sleeps three in one unit. Competes for the couple or 2+1 who choose setting and price over space - a real slice, since **11% of our bookings are 1-2 people**. |
| Casutele de la Poienita (2 per room, ×3) | Three small cabins with private kitchens. Competes for couples, and for a **group of four willing to take two cabins** - which is a real choice for adults and not for families with young children (§13.9). |

### 15.3 What these drafts are missing, and only he can supply

Three kinds of thing no page read can produce, and each is the sort of reason that keeps a set honest:

- **Guests who told him.** Anyone who mentioned they were also looking at one of these, or booked
  elsewhere and said where. That is direct evidence of substitution and outranks every inference here.
- **Local knowledge.** Shared owners, properties actually under the same management, a listing that is
  new or about to expand, one whose photos flatter it, one whose access road is bad in winter.
- **Why something is NOT in the set.** The set is defined as much by exclusions, and the reasoning for
  those disappears unless it is written down - which is exactly what happened to PIRI LAND until it was
  recorded as `active: false` with a reason rather than deleted.

---

## 16. Phase 0, as built (2026-09-01)

The seam. Nothing here adds a feature; all of it makes the feature safe to add.

### 16.1 What changed

| # | change | file |
|---|---|---|
| 1 | `cellId` takes an optional `ObservationSubject`. **A self id is byte-identical** to the 790 stored ones; a competitor id appends `\|comp:<listingId>`. Refuses a listingId containing `\|` or an empty one. | `src/lib/growth/parityWorklist.ts` |
| 2 | `ObservationSubject`, `ObservationScope`, `subjectOf`, `matchesScope`, `requireScope` — all **pure**, moved to sit beside `cellId` which consumes them. The service re-exports them so callers keep one import. | `src/lib/growth/parityWorklist.ts` |
| 3 | `loadObservations` / `latestByCell` take a **required** `ObservationScope`, enforced by `requireScope` at **runtime** as well as by the type. | `src/services/growth/parityObservations.ts` |
| 4 | `recordObservation` refuses a `cellId` and `subject` that disagree — a competitor price filed under a self id, or the reverse. | `src/services/growth/parityObservations.ts` |
| 5 | All **12** existing readers scoped to `{ kind: 'self' }` and checked by eye, one at a time. | 1 in `src/`, 11 in `scripts/` |
| 6 | `channelPriceObservations (propertyId, capturedAt)` index added, **plus three live indexes that were missing from the file** (§16.3). | `firestore.indexes.json` |
| 7 | `competitorListings` rules block: read for owner/superadmin, `write: if false` (Admin SDK only). | `firestore.rules` |
| 8 | 38 new tests: the cell-id seam, scope filtering, the runtime guard, and the C2 import boundary. | `src/lib/growth/__tests__/` |

### 16.2 Two decisions the live data forced

**Scope is filtered in memory, not in the query.** **199 of the 790 stored rows carry no `subject`
field at all** — they predate it. A Firestore `where('subject.kind','==','self')` would have dropped a
quarter of the history silently. `subjectOf` reads a missing subject as `self`, which is what those
rows are: competitor capture had never run. Verified against the live store: all 199 remain visible
under `{ kind: 'self' }`.

**The scope guard had to be a runtime throw, not just a required parameter.** `tsconfig.json` excludes
`scripts/`, and **11 of the 12 readers live there** — including `apply-band-pricing.ts`, which writes
live prices. A required TypeScript parameter would have broken nothing at compile time for exactly the
callers most likely to be missed.

### 16.3 The index file did not describe production, and deploying it would have deleted three indexes

`docs/pricing-parity-engine.md` §5.3 warned that `firebase deploy --only firestore:indexes` is not a
no-op. It was worse than recorded. Diffing the file against the live project:

| live but absent from the file | what it serves |
|---|---|
| `bookings (status, holdUntil)` | the hold-release cron |
| `housekeepingMessages (bookingId, changeType, createdAt)` | duplicate-message prevention |
| `reviews (propertyId, isPublished)` | the published-reviews query |

All three are now in the file. Re-diffed after the fix: **creates 1, deletes 0.**

### 16.4 Verified end to end, against the live store

Per the standing rule that a thing is not done until it has been run for real:

```
ok  unscoped read throws before touching Firestore   (3 malformed scopes, incl. a legacy string arg)
ok  222 self cells · 0 competitor · 222 all
ok  199 legacy rows (no `subject`) all visible under { kind: 'self' } — no history dropped
ok  self cellId round-trips against a stored id
ok  competitor id is distinct on the same window
ok  write door: 2 valid subject/cellId pairs accepted, 3 mismatches rejected  (dryRun, nothing written)
ok  9 modified read-only scripts run clean; the 3 write-path scripts typecheck
ok  npm run build passes · 50 parity tests green
```

The 17 failing suites elsewhere (auth, e2e, visual, ads, language-system) fail **identically on a clean
tree** — confirmed by stashing this work and re-running. None reference anything changed here.

### 16.5 Not deployed, deliberately

Two production changes are staged and **not applied**, because both are infrastructure and this repo
deploys them as separate, deliberate acts:

```bash
firebase deploy --only firestore:indexes   # creates 1, deletes 0 (verified §16.3)
firebase deploy --only firestore:rules     # adds the competitorListings block
```

Neither is needed until Phase 1 writes the first `competitorListings` document. The index matters
before Phase 3 starts writing observations at volume.

---

## 17. Phase 1, as built (2026-09-01)

### 17.1 What exists now

| piece | file | what it is |
|---|---|---|
| The set logic | `src/lib/competitive/set.ts` | **Pure.** `CompetitorListing`, the unit table, `hostsParty`, `fieldMembership`, verification aging, id and record validation. No I/O, no clock, no prices. |
| The store | `src/services/competitorSetService.ts` | Admin-SDK CRUD on `competitorListings/{propertyId}_{listingId}`. Curation and verification are **separate writes** (§17.3). Retire never deletes. |
| The seed | `scripts/seed-competitor-set.ts` | The 15 measured comparables + 1 retired, every field read from a live page. Dry-run by default. |
| The screen | `_components/competitor-set-card.tsx` + `competitor-actions.ts` | Name, city, picture, link — the owner's four — plus per-party membership and verification age. Two panels, one per channel. |
| Tests | `src/lib/competitive/__tests__/set.test.ts` | 33, written against the **real measured comparables** rather than invented shapes. |

### 17.2 `count` means inventory, not availability

The first draft of `CompetitorUnit.count` meant "stock at the time of capture". That is wrong, and
keeping it would have made curation and absorption fight over one field. Inventory changes when the
owner of a park builds another cabin; remaining availability changes hourly and **is** the absorption
signal, so it belongs to an observation with a date and a URL.

It is read as a **lower bound**: a probe shows the rows bookable on those dates, so a property with
four cabins and one sold reads as three. A lower bound never invents capacity, but it means `count`
may rise at a later verification and must never be treated as exact.

### 17.3 Curation and verification are different writes

`upsertCompetitorListing` records the owner's **judgement**; `recordVerification` records what the
**page said** and stamps `verifiedAt`. Keeping them apart is what lets `verifiedAt` mean "a human
confirmed this against the live listing recently" rather than "someone touched the row" — which is the
only reading that makes C1's aging worth anything.

### 17.4 The seeded set, verified against the live store

```
stored 16 (15 active, 1 retired)
party mix: 2a+1c · 4a · 4a+2c   (property.channelPricing.compareParties — the SAME mix parity uses)

airbnb        7 competing     2a+1c 7/7   4a 6/7   4a+2c 5/7
booking.com   8 competing     2a+1c 7/8   4a 7/8   4a+2c 4/8

sameAs resolves both ways: ava-chalet-ab <-> ava-chalet-bk, villa-the-frame-ab <-> villa-the-frame-bk
multi-unit detected: casutele-de-la (3 units, largest 2) · casutele-din (3, largest 4) · cliff-village (3, largest 10)
unverified: 16/16 — correct, nothing has been verified yet
retired: pensiunea-piri-land, reason retained
```

Every count reproduces §13.4 and §12.2 exactly, from the store rather than from the document.

### 17.5 What Phase 1 deliberately does NOT do

- **It reads no prices.** `competitor-actions.ts` does not touch `channelPriceObservations` at all.
  Position arrives in Phase 4, and keeping the surfaces apart is what stops "market context" quietly
  becoming a pricing input (C2).
- **The screen is read-only.** Curation is a deliberate judgement, not something to fat-finger from a
  pricing tab. Editing arrives with the verification pass, which has somewhere to show consequences.
- **Nothing is verified.** All 16 rows read `never verified` on the screen, and every
  `substitutionBasis` is badged **draft** — because C1 asks for the owner's reasoning and these are
  mine, written from page reads. The set is populated, not yet curated.

### 17.6 Still outstanding for Phase 1's gate

1. **The owner corrects the fifteen `substitutionBasis` lines** (drafts in §15). `curatedBy` then
   changes from `claude (draft)` and the screen drops the amber badge.
2. **A verification pass fills what curation could not**: `heroPhotoUrl` for all 16 (the screen shows
   a placeholder today), `distanceKm`, and Booking capacity read from a priced probe rather than the
   identity pass (§13.3). That is `comp-verify.ts`, and it belongs with Phase 3's capture work since
   it drives the same browser loop.

---

## 18. `comp-verify`, as built (2026-09-01)

Verification is what turns a populated set into a curated one. It confirms what a comparable IS —
capacity, units, rating, photo — and stamps `verifiedAt`.

| piece | what it is |
|---|---|
| `src/lib/competitive/verify.ts` | **Pure.** `parseIdentity` (Node), `IN_PAGE_VERIFIER` (the same parser as an in-page string), `reconcile`, `countBeds`. |
| `scripts/comp-verify-next.ts` | The work-list: which listings are owed verification, with **both** probe URLs and the runnable in-page script. |
| `scripts/comp-verify-record.ts` | The one write path. Reconciles each pair and refuses anything that does not survive. |
| `__tests__/verify.test.ts` | 28 tests, including the two-implementation agreement on 8 fixtures taken from live pages. |

### 18.1 Two reads per listing, and why one would be worthless

Every listing is read at **two different occupancies**, and only fields that did not move are kept.
That is the echo check from `extract.ts` run in reverse: there, a value that fails to move signals a
stale render; here, a value that **moves** signals a field that is not a fact.

Proven on a live page during the build, not just in fixtures:

| probe | `echo.sleeps` | capacity read |
|---|---|---|
| `group_adults=1` | **"1 adult"** | `Max persons: 11` |
| `group_adults=2` | **"2 adults"** | `Max persons: 11` |

The echo moved; the capacity did not. The first fact is what makes the check meaningful, the second is
what makes the capacity trustworthy — and `bedsTotal` independently counted **11** from the bed
configuration on both reads, so two unrelated sources agree.

`--occ` defaults to **1 and 2** deliberately: both must be within the smallest largest-unit in the set
(2, Casutele de la Poienita), or the page returns "no availability" and the check silently skips the
listings that most need it.

### 18.2 A pair that fails to reconcile is REFUSED, never stored with a caveat

The error being caught — capacity read from a field that echoes the search — produces a number that
looks perfectly reasonable and makes `hostsParty` report competition that does not exist. There is no
safe way to half-trust it. All four refusal paths were exercised against the live store:

```
the-cliff-village    only 1 read. Two occupancies are required, or the echo check cannot run
ava-chalet-bk        both reads used occupancy 2 — an unrun check must not pass silently
villa-the-frame-bk   capacity DIFFERED between the two reads — a search echo, not a fact
not-in-the-set       not in the curated set — curate it before verifying
```

Zero of four stored. A refusal is an outcome; the fix is to re-probe, never to lower the bar.

### 18.3 Verification does not overwrite curation

Confirmed on the live record after verifying Vila Luna: `units`, `rating`, `reviewCount`, `city`,
`heroPhotoUrl`, `photoProvenance`, `verifiedAt` and `qualityAsOf` were written, while
**`substitutionBasis` and `curatedBy` were untouched**. That separation is what lets `verifiedAt` mean
"a human confirmed this against the live listing" rather than "someone touched the row" — and it is
why the owner's reasoning cannot be silently replaced by a scraper.

### 18.4 Photo provenance is recorded, not claimed

`heroPhotoUrl` comes from `og:image` and never goes through `reconcile` — it is DOM-only, so the text
parser cannot produce it. Vila Luna's returned a bare bstatic path with no listing id, so it is stored
as **`capture-context`**: trusted only because it came from that page load. A newer Airbnb listing
whose path carries `Hosting-<id>` stores as `id-matched`. The recorder prefers an `id-matched` read
when the two probes disagree.

### 18.5 State after the first run

```
16 listings · 1 verified (vila-luna, age 0d) · 15 still unverified
comp-verify-next now reports 14 owed of 15 active
```

---

## 19. The first full verification run (2026-09-01)

36 page loads across both channels. **14 of 16 listings verified.** Three defects surfaced, all of
them only because the thing was run for real.

### 19.1 The bed fallback summed across units — the module's own founding error, inside itself

At occupancy 1-2 Booking renders no capacity column, so the bed fallback fired on **multi-unit** pages
and counted beds across the whole section:

| listing | what it really is | what the fallback said |
|---|---|---|
| Casutele de la Poienita | rooms taking 2, plus a villa | **one 9-person unit** |
| Casutele din Poienita | chalets taking 4 and 2 | **one 12-person unit** |

That is "a village of villas read as one villa" — §13.6's founding example — reproduced inside the
module written to prevent it. And it fails in the **flattering** direction: inflated capacity invents
competition for large parties that does not exist.

**Fix:** the bed fallback may fire only when the section describes exactly ONE unit block; more than
one and the read is refused. Refusing costs a re-probe; inventing a capacity costs a wrong decision
nobody can trace.

A second bug hid behind the first: `unitHeadings` de-duplicated by name, and Casutele de la Poienita's
three rooms are all called "Double Room", so three units collapsed to one and the fallback fired
anyway. **Three identical names are three units** — the count is of blocks, not of distinct strings.

### 19.2 `count` moves with the search, so reconcile must not require it to match

The Cliff Village rendered **6** One-Bedroom Villas at 4 adults and **5** at 2 adults, on the same day.
`count` is a lower bound read from however many rate rows the page chose to draw; `maxPersons` is the
fact. Requiring both to match rejected a perfectly good pair.

**Fix:** reconcile compares unit **labels and capacities** only, and takes the **larger** count of the
two reads — the better lower bound. `sqm` is merged the same way and for the same reason.

### 19.3 Verification corrected the curated set, which is the point of having it

**Casutele de la Poienita has a Villa taking 4** that the curation pass never saw — it only ever showed
its double rooms. `CAPACITY 2 -> 4`, and the listing moves from "out of set for a family of three" to
"competes". Casutele din Poienita's small chalets are max **2**, not 3, and there are **3** of them,
not 2.

Nothing else moved: the other twelve confirmed the seeded values exactly.

### 19.4 Two listings could not be verified, and that is an outcome

- **MoodySun Studio** returned `no availability` for 19-22 Oct **and** 16-19 Nov. Two windows a month
  apart, both refused. It stays `UNVERIFIED` with no photo, and the reason is recorded rather than
  guessed at.
- **The Cliff Village at occupancy 1** correctly refused (multi-unit, no marker) and was re-probed at
  2 and 4, which both rendered markers.

Occupancy 1-2 is a poor default for multi-unit properties: Booking only draws the capacity column when
several rows must be told apart. **`--occ 4,5` is the right probe for a park**, and the work-list
should learn to pick per listing from its recorded units rather than using one global pair.

### 19.5 The set, as verified

```
VERIFIED 14/16   (15 active, 1 retired)

airbnb        Ceas cu Cuc 10 · Villa The Frame 8 · Adorable 6 · AVA 6 · Peaceful Forest Haven 6
              Panoramic View Cabin 4 · MSC Forest Retreat 3
booking.com   Vila Luna 11 · The Cliff Village 10 (12 units) · Villa The Frame 8 · AVA 6
              Cozy A-Frame Ayda 5 · Casutele de la 4 (4u) · Casutele din 4 (4u) · MoodySun 3 (unverified)

2a+1c   15/15 compete
4a      13/15 compete
4a+2c    9/15 compete
```

Fifteen of fifteen carry a hero photo except MoodySun, which was never readable.

### 19.6 Deployed (2026-09-01)

Both Firestore changes are live.

**Indexes.** Re-diffed immediately before deploying — create 1, delete 0 — then verified after, because
the whole hazard was a deploy that silently removes what the file does not mention:

| index | state |
|---|---|
| `channelPriceObservations (propertyId, capturedAt)` | **created**, built, serving 790 rows |
| `bookings (status, holdUntil)` | still live — the hold-release cron |
| `housekeepingMessages (bookingId, changeType, createdAt)` | still live |
| `reviews (propertyId, isPublished)` | still live |

All four queries were then run for real, not merely listed. The new index reported "currently
building" on the first attempt, which is normal; it was polled until ready rather than assumed.

**Rules.** `competitorListings` is live and admin-only. Verified by effect rather than by reading the
deploy message back — an unauthenticated REST read of each protected collection is refused:

```
competitorListings         HTTP 403  PERMISSION_DENIED
channelPriceObservations   HTTP 403  PERMISSION_DENIED
channels                   HTTP 403  PERMISSION_DENIED
```

### 19.7 What Phase 1 still owes

1. **The owner's fifteen `substitutionBasis` corrections.** Every entry is still badged **draft** on
   the admin card, and `curatedBy` still reads `claude (draft)`. Verification confirmed what these
   listings ARE; it cannot confirm why they compete.
2. **MoodySun Studio.** Unverified, no photo, `no availability` in two windows a month apart. Worth a
   third window before concluding anything — a listing that never quotes is either closed for the
   season or gone, and those are different facts.
3. **`--occ` should be per listing, not global.** Booking draws its capacity column only where rows
   must be told apart, so occupancy 1-2 reads nothing on a park. The work-list already knows each
   listing's recorded units and could pick a pair that will render markers.
4. **`distanceKm`** is still null everywhere. Not derivable from a listing page; it needs geocoding or
   the owner's own judgement of what is "near".

---

## 20. The vertical slice: 24-28 Oct, 2a+1c (2026-09-01)

One window, both fields, cut through Phases 2, 3 and 4 rather than building each in full. 15 probes.

### 20.1 What was built

| piece | what it is |
|---|---|
| `parity-capture.ts --competitor <id>` | The write path, extended. A competitor row's `cellId` carries the listing, and the store re-checks that the id and the subject agree. |
| `scripts/comp-next.ts` | Probe list for one window. **Refuses a window we have not quoted ourselves (C5)**, and drops comparables that cannot host the party before a page loads (C4). |
| `src/lib/competitive/position.ts` | PURE. Band, rank, sample, confidence, flags. Per channel, never pooled. |
| `scripts/comp-report.ts` | Renders it from the store. |
| 16 new tests | Most of them pin a REFUSAL — see §20.3. |

### 20.2 A production bug in the parity extractor, found by pointing it at someone else

Four comparables came back `no price rows found` on pages that plainly showed prices. Booking prints
**`Price 4,180 lei`** when there is no promotion — and the extractor's only fallback was
`(RON|lei)\s*([\d.,]+)`, which expects the currency **first**. It never matched Booking's own format,
so **every undiscounted Booking page read as a parse failure.**

This is not a competitor-only bug. It has been in `extract.ts` and `inPage.ts` all along; it stayed
hidden because this property's own Booking listing nearly always carries a Genius discount, so the
price-PAIR path covers it. A window where Genius does not apply would have read as an error — and the
parity board currently shows **6 error cells**.

Fixed in both parsers, row-anchored (`price <n> lei`, which is a real rate row) and **capacity
filtered like the pair path**, because taking the cheapest unfiltered number on a multi-unit page is
precisely the bug the filter exists to prevent. Four regression tests.

### 20.3 What the reading refuses to say

- **No band and no rank below three quotes.** The individual readings are still reported; nothing is
  inferred from them.
- **The direct price is never ranked.** No guest browsing Airbnb sees it. It is a reference line.
- **A comparable that did not quote is never dropped** — it appears with its reason.
- **"Not sellable", never "sold"**, on a single reading.
- **Quality never enters the price.** One flag, on a specific pair, and only above a 20-review floor.
  Proven by test: adding ratings to the inputs changes neither the band nor the rank.

### 20.4 The reading

```
MARKET POSITION — 2026-10-24 → 2026-10-28  (4n, 2a+1c)

AIRBNB      sample 6 of 7 · oldest 0d · solid          BOOKING.COM  sample 6 of 8 · solid
  the set   2,438 - 5,705   median 4,057                 the set    2,803 - 5,320   median 4,466
  you       2,369  ->  1 of 7                            you        2,719  ->  1 of 7
  direct    2,283 (reference)                            direct     2,283 (reference)

  >> 2,369  US                                           >> 2,719  US
     2,438  MSC Forest Retreat        (sleeps 3)            2,803  Cozy A-Frame Ayda   promo (no reviews)
     2,702  Adorable 2 Bedroom Tiny Home  promo             3,600  Casutele din Poienita     9.6/157
     3,520  Panoramic View Cabin      promo                 4,180  Vila Luna                 10/57
     4,594  Peaceful Forest Haven     promo                 4,752  Villa The Frame     promo 9.7/21
     4,684  AVA Chalet with Jacuzzi                         5,040  AVA Chalet                9.5/11
     5,705  Villa The Frame           promo                 5,320  The Cliff Village         10/68
         —  Ceas cu Cuc  NOT SELLABLE                           —  Casutele de la  refused (units too small)
                                                               —  MoodySun Studio  NOT SELLABLE
```

**He is the cheapest listing in both fields, and it is not close.** The set medians are 4,057 and
4,466 against his 2,369 and 2,719 — he is at roughly **60% of the median on Airbnb and 61% on
Booking**. Among comparables of his own SIZE (6+ guests) the cheapest on Airbnb is Peaceful Forest
Haven at 4,594; he is at 2,369, a little over half.

The two listings priced beneath the rest of the field are not like-for-like: MSC Forest Retreat sleeps
**3** (a small A-frame, not a house), and Cozy A-Frame Ayda is **brand new with no reviews**, buying
its first bookings on price.

### 20.5 What it means, and the one thing it settles

This is the question the engine was built for, answered on a real window:

> **If 24-28 October is empty, price is not the reason.**

The parity board frames this window as a problem because it compares him against *his own* OTA
listings. Against the actual market he is the cheapest house available on both channels, by a wide
margin. No rate change addresses that, and cutting further would only widen a gap that is already the
largest in the field.

Two caveats, both real:

- **One reading.** Absorption needs a second, and the whole point of "not sellable" is that it means
  nothing until something that WAS priced stops being priced.
- **The incumbent is off the market for these dates.** Ceas cu Cuc — the 98-review establishment — is
  not sellable for 24-28 Oct, and so is MoodySun. Two withdrawals do not make a trend, but the
  strongest listing in the set being unavailable on his emptiest week is the first thing to re-check
  next run.

**And a question this raises rather than answers, which is the owner's alone (C2):** being at 60% of
the median while the set sells is a different situation from being at 60% while nobody sells. The
second reading tells them apart. Nothing here recommends a price, and no solver reads this data.

---

## 21. Reliability audit (2026-09-02)

The owner: *"I really want reliable data. If the data is wrong, I'll act on a wrong foundation."*

A second reading one day after the first says nothing useful about absorption — but it is exactly the
right instrument for reliability, because a price that does not reproduce overnight is a price that
was never read correctly. Every comparable was re-probed on the same window.

### 21.1 Reproducibility: 11 of 12

| field | reproduced exactly |
|---|---|
| Airbnb | **6 of 6** — 2,438 · 2,702 · 3,520 · 4,684 · 4,594 · 5,705, all unchanged |
| Booking | **5 of 6** — 5,040 · 2,803 · 3,600 · 4,180 · 5,320 unchanged |
| our own Booking price | 2,719, unchanged |

**The failure: Villa The Frame (Booking).** Recorded 5,887 → 4,752 on 2026-09-01; reads
8,767 → 7,025 today, a 48% difference. It is not a repricing:

> The 2026-09-01 capture recorded **the identical pair, 5,887 → 4,752, for the 19-22 Oct window AND
> for 24-28 Oct** — a 3-night and a 4-night stay at the same total. That is impossible. Today the two
> windows read differently from each other (5,395 and 7,025), which is what a real price does.

So the page served a price block belonging to a different stay while its header echoed the requested
dates. Corrected in the store; the append-only history keeps both, and the newest wins.

### 21.2 Why the echo check did not catch it

`verifyEcho` compared the nights and guests **the page header states** against the probe. The header
had updated; only the rate table was stale. The check passed on a page that was lying below the fold.

**Fixed:** `readBookingNights` now prefers **`Price for N nights`** — the rate table's OWN heading —
over any bare "N nights" elsewhere on the page. A stale table now carries a stale heading, and the
mismatch is caught. Both parsers changed together; three regression tests, one of which asserts
`verifyEcho` rejects a header/table disagreement.

*A near-miss worth recording: the first patch landed in `extract.ts` and silently failed to apply to
`inPage.ts`. The agreement test stayed green because no fixture exercised the new branch — two
parsers that both ignore a rule agree perfectly. The fixture was added at the same time as the fix.*

### 21.3 The larger problem: I fabricated a field

Recording the first batch, I set `session.programApplied: false` on **every** competitor row and
`loggedIn: false` on every Airbnb row. **I measured neither.** I filled in a structured field with a
plausible default, which is precisely the failure the session field exists to prevent — the
observation then *looks* like evidence about how the price was read.

What the measurement actually shows:

| listing | Booking Genius |
|---|---|
| **our own listing** | **12% Genius applied** ("applied to the price before taxes and charges", Genius L3) |
| Villa The Frame | Genius applied |
| Vila Luna · The Cliff Village | property offers **no** Genius rewards at all |
| AVA Chalet · Cozy A-Frame Ayda · Casutele din | Genius not applied (Ayda's 5% is a property promo) |

And Airbnb was **logged in as host**, not logged out.

So **our Booking price is a member rate and five of six comparables' are anonymous.** That is not a
like-for-like comparison, and it flatters us by an unknown amount. The engine does not guess what the
anonymous price would be — inventing that number is the same class of error — it says so:

```
! NOT LIKE-FOR-LIKE: our booking.com price carries a loyalty discount, and only 1 of 6
  comparables' prices do. Ours is a member rate; theirs are mostly anonymous, so our
  position here is flattered by an unknown amount.
```

Four tests, including one asserting the flag **does not adjust** the band or the rank.

### 21.4 The corrected reading

```
AIRBNB       6 of 7 · solid              BOOKING.COM   6 of 8 · solid
  the set    2,438 - 5,705  median 4,057   the set     2,803 - 7,025  median 4,610
  you        2,369  ->  1 of 7             you         2,719  ->  1 of 7   [NOT LIKE-FOR-LIKE]
```

**Airbnb is unchanged and trustworthy**: 6 of 6 reproduced, no loyalty programme in play, and the
owner's standing guest discount is 0. He is the cheapest listing in that field.

**Booking now reads differently in one respect and the same in another.** Correcting Villa The Frame
moved the top of the band from 5,320 to 7,025 and the median from 4,466 to 4,610 — the field is
*dearer* than first reported, not cheaper. But the Genius finding means his rank of 1 is **not
established**: his 2,719 is a member price against mostly anonymous ones, and his own pre-discount
figure on the page is 3,200, which would place him behind Cozy A-Frame Ayda at 2,803.

### 21.5 What still stands, and what does not

- **STANDS: the Airbnb position.** Cheapest of seven, reproduced exactly, no comparability caveat.
- **STANDS: "if 24-28 October is empty, price is not the reason."** It survives the correction on both
  channels — even at his pre-discount 3,200 he is second of seven on Booking, and correcting Villa The
  Frame made the field dearer.
- **DOES NOT STAND: "cheapest on Booking."** Not until his anonymous price is measured.
- **OPEN: his logged-out Booking price.** It cannot be captured from a signed-in browser, and 3,200 is
  the page's pre-discount figure rather than a measured anonymous quote. Until it is measured, the
  Booking rank carries the caveat.

---

## 22. The search-results page is a better instrument (owner, 2026-09-02)

Two corrections from the owner, one of which changes how capture should work.

### 22.1 A programme discount is part of the OFFER, not a measurement flaw

> *"the price should be compared apples to apples. Logged in same places. Genius 3 on Booking for my
> property, and also for all competitors. Logged with my account also on Airbnb."*

He is right and §21.3's flag was wrong-headed. Captured from **one signed-in session**, these are the
prices that guest actually sees: ours discounted because our property offers Genius, Vila Luna's not
because theirs does not. Whether a property participates is part of what it is selling. Calling that
"NOT LIKE-FOR-LIKE ... flattered by an unknown amount" understated a real advantage and implied the
data was faulty when the data was correct.

What survives is narrower and true: **the ORDER can differ for a guest who is not signed in.** So it
is now a NOTE saying who the ranking is for — never a flag, and it still adjusts nothing:

> *This ranking is as a signed-in member sees it. Our booking.com price includes a loyalty discount
> and 5 of 6 comparables' prices do not — their properties do not all offer one. That is a real
> difference in what is on sale. A guest who is NOT signed in may see a different order.*

**The rule the session field enforces is unchanged, and it is the one that matters: capture the whole
field from ONE session.** Mixing a signed-in reading of ours with signed-out readings of theirs is the
error; reading them all the same way is not.

### 22.2 The search-results page beats per-listing probes

The owner's suggestion, and it is better than the design's own instrument:

> *"you can double check the prices by looking on what you get from the search listing for a certain
> period and a certain party"*

One Booking search for Comarnic, 13-15 Oct, 2 adults + 2 children (ages 3 and 7) returned **25
properties in a single page load**, each card carrying:

```
Mountain Family Chalet on Prahova Valley - 1000 sqm private yard
Comarnic · 1.4 km from centre
Scored 9.4 · Superb · 27 reviews
Entire holiday home • 3 bedrooms • 1 living room • 2 bathrooms • 1 kitchen • 145 m²
5 beds (1 single, 1 double, 2 bunk beds, 1 large double)
Free cancellation
2 nights, 2 adults, 2 children          <-- the echo, INSIDE the price block
1,640 lei  1,491 lei
Original price 1,640 lei. Current price 1,491 lei.
Includes taxes and charges
```

Why this is a better primary instrument than N per-listing probes:

| | per-listing probe | search results |
|---|---|---|
| page loads for the field | **15** | **1** |
| session / party / dates identical across the field | by discipline | **by construction** |
| echo | page header (which lied — §21.2) | **inside each card, per property** |
| distance from centre | not available | **stated** (fills `distanceKm`) |
| bed configuration | needs the availability section | **stated** |
| shows properties OUTSIDE the curated set | never | **yes — see §22.4** |

Every one of the 25 cards echoed `2 nights, 2 adults, 2 children`. That per-card echo is exactly the
price-block anchor §21.2 had to add to the detail page, and here it comes for free.

### 22.3 Two mechanics that must be in the implementation

- **The list is VIRTUALISED.** Off-screen cards are removed from the DOM: an initial snapshot held 25
  names, and after scrolling to the bottom the same page held **6**. A single `innerText` grab is not
  the page. Capture at the top, or scroll-and-merge — never scroll-then-grab.
- **Prices come in both forms**, exactly as on the detail page: 11 of the 25 render
  `Original price X. Current price Y.` and the rest a bare `Price X lei`. The row-anchored fallback
  added in §20.2 covers both, and a parser that only reads the pair would have missed 14 of 25.
- **Split on the NAME anchor**, not on `See availability`: splitting on the trailing text put names and
  prices in different chunks and parsed 6 of 25.

### 22.4 The finding: the curated set may be too narrow

The 25 results include **19 properties not in the curated set**, and several are cheaper than his:

| | price (2n) | reviews | size |
|---|---|---|---|
| Casa Drumetului | 700 | 9.0 / 62 | — |
| Moon Valley Comarnic | 1,083 | 9.3 / **336** | 45 m² |
| Memory Lane Cottage – Posada | 1,178 | 5.0 / 2 | 97 m² |
| Moon Village Comarnic | 1,308 | 9.3 / **874** | 50 m² |
| SAMI's HOUSE | 1,326 | 10 / 4 | 160 m² |
| Pensiunea PIRI LAND *(retired)* | 1,400 | 9.7 / 35 | — |
| **Mountain Family Chalet** | **1,491** | 9.4 / 27 | 145 m² |

**He is 9th of 25 on this window**, not first. That is a different question from §20's — different
dates, a different party, and above all a different SET: the curated eight are houses like his, while
Booking's search is everything in Comarnic that can host 2+2.

But two of those unlisted properties carry **336 and 874 reviews** — far more than anything in the
curated set, whose maximum is 157. Whatever they are at 45-50 m², a lot of guests are choosing them.
**Whether they are substitutes is the owner's call (C1)** and no auto-discovery should decide it. What
the search page proves is that the curation was made without seeing them.

### 22.5 What this changes in the plan

- **Phase 3's capture becomes search-first.** One load per (channel × window × party) covers the whole
  town; per-listing probes remain for comparables outside the searched location — Villa The Frame
  (Ghioșești), MSC Forest Retreat (Poiana) and Ceas cu Cuc (Gura Beliei) will not appear in a Comarnic
  search.
- **The budget maths in §5 is obsolete and far too pessimistic.** A field of 25 for one page load makes
  the sentinel run cheap enough that breadth stops competing with depth; §5's "1 party × 4 windows =
  28 loads" becomes roughly 4 loads.
- **Curation gains a candidate feed**: the search page lists who a guest actually sees, so the set can
  be reviewed against the market rather than from memory. Owner-curated still (C1) — the page proposes,
  he disposes.

---

## 23. Search-page cross-validation, and the set widened (2026-09-02)

### 23.1 The search page independently confirms the per-listing captures

The same window and party as the §20 slice — 24-28 Oct, 2 adults + 1 child — run through the search
page instead of fifteen detail pages:

| listing | search page | §20 per-listing probe | |
|---|---|---|---|
| our own | **2,719** | 2,719 | same |
| Cozy A-Frame Ayda | **2,803** | 2,803 | same |
| Casutele din Poienita | **3,600** | 3,600 | same |
| Vila Luna | **4,180** | 4,180 | same |
| The Cliff Village | **5,320** | 5,320 | same |

**Five for five, to the leu, from two independent instruments.** Together with §21's 11-of-12
reproducibility that is the strongest evidence so far that the pipeline reports what the pages say.

### 23.2 Three differences, all of them informative

**Villa The Frame and AVA Chalet are ABSENT from the search.** Villa The Frame is in Ghioșești, not
Comarnic — exactly the case §22.5 predicted, and the reason per-listing probes stay in the design for
comparables outside the searched town. AVA Chalet *is* in Comarnic; it may be beyond the first page of
results. **The search returns a PAGE, not the market** — that is a limit to encode, not to forget.

**Casutele de la Poienita prices at 3,497 in the search, where the per-listing probe REFUSED it.**
Both are right, and the difference is the interesting part:

- The **search** offers the cheapest way Booking will house the party — here two rooms at
  1,647 + 1,850 = 3,497. It is what the channel sells.
- The **per-listing rule** requires ONE unit for a party with children (§13.2b, the owner's rule), and
  no single room takes three. It is what the family will accept.

So the search answers *"what does the channel offer?"* and `hostsParty` answers *"will this guest take
it?"*. Neither replaces the other, and a reading that quietly used the search price for a family would
be quoting them a stay in two separate cabins.

### 23.3 The set widened to 17 active

Owner, 2026-09-02, on the two properties the search surfaced:

> *"Moon Village and Moon Valley should be included. They are not the same like me, they are units
> park, with small tiny houses. But still they matter."*

Added with that reasoning recorded verbatim, capacity deliberately UNREAD (they show `?` against every
party until a probe fills them, which is the honest state and marks them as probeworthy):

| | reviews | why it is in |
|---|---|---|
| Moon Village Comarnic | **874** | more than five times any other entry; a great many guests searching Comarnic choose it over a house |
| Moon Valley Comarnic | **336** | sister property, same kind of thing, and it undercut us on 13-15 Oct (1,083 against 1,491) |

### 23.4 A bug the widening exposed: re-seeding would have un-verified everything

`upsertCompetitorListing` accepted an optional `verifiedAt`, and the seed passed `verifiedAt: null`.
`null` is not `undefined`, so it survived the undefined-strip and **would have written null over all
fourteen verified listings** the moment the seed was re-run to add a comparable.

The field is now refused by that function entirely. Curation and verification are separate writes
(§17.3); only `recordVerification` sets it, a new document simply lacks it, and `toListing` reads a
missing one as null. Confirmed after re-seeding: **18 listings, 14 still verified.**

### 23.5 Candidates the search surfaced, for the owner to accept or reject

Three searches (13-15 Oct 2a+2c · 24-28 Oct 2a+1c · 27-30 Dec 4a+2c) returned **50 distinct
properties**, of which 7 were curated and **43 were not**. The strongest by review volume — the only
proxy available for how many guests actually choose them:

| reviews | score | size | seen in | property |
|---|---|---|---|---|
| 182 | 8.9 | 19 m² | 1/3 | Pensiunea Atra Doftana |
| 78 | 9.8 | 250 m² | 2/3 | Utopia Lake View |
| 62 | 9.0 | — | 2/3 | Casa Drumetului |
| 56 | 10 | — | 1/3 | TETRA Plus 569 |
| 53 | 9.8 | 58 m² | 1/3 | Chalet Husky - Pet Friendly & Private |
| 53 | 9.6 | 130 m² | 1/3 | Doftana Lake House |
| 51 | 9.9 | 70 m² | 1/3 | Zaivan Retreat |
| 45 | 9.3 | 140 m² | 1/3 | Vila ZIA |
| 33 | 9.6 | 240 m² | 1/3 | Casa Darul Bunicii |
| 29 | 9.3 | 250 m² | 2/3 | Casa Polen Comarnic |

The three with 240-250 m² (Utopia Lake View, Casa Darul Bunicii, Casa Polen) are the closest in size to
his 145 m² house among these. **The list proposes; he disposes (C1).**

---

## 24. Two absences, wrongly explained — and the third capture trap (2026-09-02)

### 24.1 The reasoning error

§22.5 predicted that comparables outside the searched town would not appear in a Comarnic search, and
§23.2 assigned Villa The Frame's absence to exactly that. **Both were wrong**, and the owner corrected
them:

> *"Ghiosesti is in Comarnic. Even it wasn't [...] the search is returning a radius of around 10km. So
> Villa The Frame is maybe absent because it didn't have availability for that period. You should be
> thinking on that by yourself."*

He is right on all three counts. Measured: Booking reports **"Comarnic: 15 properties found"** while
rendering **25 cards** — the extra ten are the surrounding radius, and there is no pagination or "load
more", so that page IS the whole result set.

**The disconfirming evidence was already in hand and was explained away.** AVA Chalet is
unambiguously in Comarnic and was *also* absent; §23.2 recorded that and waved it off as "may be
beyond the first page" rather than treating it as a refutation. A hypothesis written into the design
was allowed to survive a case it could not account for. The rule is the one already in the parity
skill: **verify the premise; do not fit the observation to the expectation.**

### 24.2 What was actually happening, and it is worse

Searching for the property by name, for the same dates:

> **Villa The Frame — "This property is unavailable on our site for your dates."**

And on its own detail page, for those same dates, beside a full price:

> **"Ooops! This is an adult-only property, so your children will have nowhere to sleep!"**

AVA Chalet, same shape:

> **"Ooops! Only children 12 years and older can stay here"** — probed with a 10-year-old.

Neither is about location or pagination. **Both properties refuse the party**, the search correctly
omits them, and **the detail page prints a full price anyway**. So two stored observations — 7,025 and
5,040 — were prices for stays these properties will not sell to a family of three.

### 24.3 The third capture trap, now closed

`classifyPage` looked for `no availability`, `sold out`, `not available for`, `minimum stay`. The
banner matches none of them, so the page read as `priced` and a number nobody could ever book entered
the store.

New `PageState`: **`party-not-accepted`**, checked BEFORE `priced` because both signals are on the page
at once. Patterns cover the adults-only wording and the child-age bar. Both parsers changed together;
four tests, including one asserting an ordinary page mentioning children and cots is unaffected.

The two observations are corrected in the store to `refused`, with the banner quoted as the reason.

**And a rule that generalises beyond this bug:** on Booking, *the search page is the authority on
whether a property will take the party; the detail page is not.* The detail page answers "what does
this unit cost", which is a different question and is silently wrong when the party is barred.

### 24.4 The set is now 22 active

Five added at the owner's request from the search-surfaced candidates, all with capacity deliberately
UNREAD so they read `?` against every party until probed:

| | reviews | note |
|---|---|---|
| Utopia Lake View | 78 | 250 m², 6 beds — closest of the candidates to our own product |
| TETRA Plus 569 | 56 | perfect 10 |
| Chalet Husky - Pet Friendly & Private | 53 | 58 m², leads on pet-friendly and privacy |
| Zaivan Retreat | 51 | 70 m² |
| Maramureș Nook | — | 200 m², 5 beds, 1 km from centre; no score yet |

**Booking field: 15. Airbnb field: 7.** Nine of the fifteen Booking entries still have unread capacity,
which is the honest state and the next thing a probe should fill.

---

## 25. Capacities filled — and §14.2 had the source order backwards (2026-09-02)

Seven listings carried unread capacity. Filling them overturned the rule §14.2 stated.

### 25.1 `Max persons` is a LOWER BOUND that grows with the search

Measured on ONE page, Chalet Husky, same dates:

| searched | `Max persons` rows | bed configuration |
|---|---|---|
| 2 adults | 2 and 1 | unchanged |
| 4 adults | **4 and 3** | unchanged |

Booking renders rate rows around the party you asked for, so a small search only ever sees
small-occupancy rows. §14.2 called the marker authoritative and put the bed count second; that was
backwards. Vila Luna's `Max persons: 11` was right only because that probe happened to be large
enough to surface the whole-house row.

**All seven listings produced byte-identical per-unit bed counts at 2 adults and at 4.** The bed
configuration is the invariant, so capacity per unit is now:

```
capacity = max(beds in this unit block, any Max marker in this block)
```

The marker can only ever RAISE a bed count, never lower it — a `Max persons: 1` row on a three-bed
unit is a rate, not a capacity. That also stops `reconcile` rejecting good pairs over a field that
moves by design: on the first attempt it correctly refused Chalet Husky and Maramureș Nook because the
markers disagreed between reads.

### 25.2 Beds must be counted PER BLOCK

Summing the section is the §19.1 error wearing new clothes: it turned Moon Village's six tiny houses
into one 22-person unit, Utopia into one of 31 and Zaivan into one of 58. Per-block counting reads them
as what they are.

A bed count is an **upper bound** on real capacity — our own listing counts to 9 beds against a stated
max of 7, because bunks seat more than they sleep. That errs safely: it can over-include a comparable
but can never invent a moat, and an over-included one is corrected by the probe that returns `refused`.

### 25.3 What was actually there

| listing | units | largest | note |
|---|---|---|---|
| Zaivan Retreat | 6 | **21** | Holiday Home 21 (350 m²), Four-Bedroom House 18 (250 m²) — a group venue |
| Utopia Lake View | 4 | **15** | Superior Villa 15 (350 m²), Deluxe Villa 11 (250 m²) |
| Moon Valley | 4 | 6 | Ostuni 4, Three-Bedroom Villa 6, Siena 2, Chianti 2 |
| Moon Village | 6 | 5 | Calisto 5, Hyperion 5, Olympus 5, Loft 3, Jupiter 2, Juliet 2 |
| Maramureș Nook | 1 | 5 | one 200 m² chalet |
| Chalet Husky | 1 | 3 | one 58 m² chalet |
| TETRA Plus 569 | 1 | 3 | one 45 m² house |

The search cards had understated three of them badly — Utopia showed "6 beds", Zaivan "4 beds" — because
a card shows the unit Booking surfaced for THAT party, not the property's largest. Another reason the
search page is a candidate feed and the detail page is the capacity source.

Moon Village's unit names (Calisto, Hyperion, Olympus, Jupiter, Juliet, Loft) confirm the owner's
description exactly: a park of individually-named tiny houses, not a house.

### 25.4 The set is complete

```
23 listings · 22 active · 21 verified · capacity UNREAD 0

2a+1c   21/22 compete
4a      18/22 compete
4a+2c   12/22 compete
```

Only Pensiunea PIRI LAND (retired) remains unverified. Two things are still outstanding and both are
the owner's: the fifteen-plus `substitutionBasis` corrections, and `heroPhotoUrl`, which the capacity
pass did not collect.

### 25.5 Curation was still clobbering verification, and the fix had to generalise

Both group venues were kept at the owner's instruction:

> *"keep them both, they still compete for smaller parties"*

That is correct and the engine already honours it: `hostsParty` takes the **smallest unit that fits**,
so a 2+1 family reads Zaivan's 3-person One-Bedroom Family Apartment and Utopia's 3-person Apartment
with Lake View — never their 21- and 15-person headline products. Verified:

```
Zaivan Retreat    2a+1c -> One-Bedroom Family Apartment (3)
                  4a    -> Family Suite with Balcony (4)
                  4a+2c -> Two-Bedroom Suite (6)
```

**Recording that reasoning re-ran the seed, and the seed reset all seven verified capacities to
unread.** §23.4 had fixed exactly this for `verifiedAt` and fixed only that field — the general problem
was left standing, and it fired within the hour on `units`.

The rule now covers the whole class. Fields a verification pass owns —
`units · rating · reviewCount · qualityAsOf · heroPhotoUrl · photoProvenance · distanceKm ·
verifiedAt · verifiedBy` — are written by `upsertCompetitorListing` **only when the document does not
yet exist**. Seeding a new entry may carry initial values; re-seeding an existing one may not touch
them. Proven by re-running the seed afterwards: **capacity UNREAD 0, still 21 verified.**

Tests pin both directions: every field `recordVerification` writes is on the list, and no
curation-owned field is (or a re-seed could never correct a name or a URL).

**The lesson is about method, not about these fields.** Both bugs were found by reading the data back
after writing it, never by the write reporting a problem — `stored: 23` looked identical in the run
that destroyed seven capacities and the run that preserved them.

### 25.6 The first two owner-written bases

`substitutionBasis` now reads **2 owner-written, 21 still drafted**. Utopia Lake View and Zaivan
Retreat carry `curatedBy: 'owner (2026-09-02)'` and lose the amber `draft` badge on the admin card —
the first entries where the recorded reason is actually his.

---

## 26. Photos, and the clobbering was worse than reported (2026-09-02)

### 26.1 Every photo had been lost, not just the capacities

§25.5 reported that re-seeding reset seven capacities. **It had also wiped `heroPhotoUrl` on all
twenty-three listings**, including the thirteen collected during verification — and that went unnoticed
because the damage report checked capacity and stopped there. The ownership fix now covers the whole
verification-owned set, so nothing was lost again; but the earlier loss had to be re-collected.

The lesson is the same one and it is worth stating twice: **a write that reports success tells you
nothing.** `stored: 23` was identical in the run that destroyed the photos and the run that preserved
them. Only reading the data back distinguishes them — and reading back only the field you were
thinking about finds only the damage you expected.

### 26.2 Collected in 12 page loads rather than 23

One Booking search at 4 adults yielded **11 photos in a single load** — the cards carry a `square600`
thumbnail, which is the right shape for the admin row. The remaining five Booking listings sit outside
the Comarnic radius (Şotrile, Breaza, Teşila) and the seven Airbnb ones have no equivalent search, so
those twelve came from `og:image` on their own pages.

That reinforces §22.2: the search page is the cheap bulk instrument, the detail page is the fallback
for whatever it does not surface.

### 26.3 The base64 provenance case, closed

§13.7's `Hosting-<id>` check treated Villa The Frame's Airbnb photo as merely `capture-context`. Its
path actually reads `Hosting-U3RheVN1cHBseUxpc3Rpbmc6MTA0Ni…`, which decodes to
`StaySupplyListing:1046394696894549540` — the id is there, base64-encoded. The check now decodes that
form, so a self-verifying photo is no longer recorded as unverified.

**Six** of the twenty-three are provably of the listing they are filed under — the six Airbnb listings
whose paths carry the id, plainly or encoded. The other seventeen are `capture-context`: all sixteen
Booking thumbnails (bstatic paths carry a photo id, never a property id) and Ceas cu Cuc, whose older
Airbnb listing uses a bare uuid. That is the honest split, and it is a property of how each platform
names files rather than anything about the photos.

### 26.4 The set is complete

```
23 listings · 22 active · 1 retired
verified   23/23
photos     23/23   (6 id-matched, 17 capture-context)
capacity    0 unread
substitutionBasis  0 still drafted
```

The owner accepted the drafted reasons on 2026-09-02 ("the substitutionBasis is good"), so they are his
— recorded as `owner (approved 2026-09-02; drafted by claude)`, which keeps the provenance honest about
how they got there. Utopia Lake View and Zaivan Retreat keep their own `curatedBy`, because he wrote
those two himself.

**Phase 1's gate is met.** The comparable set is curated, verified, photographed and complete, and the
admin card has every field it was specified with: name, city, picture, link.

---

## 27. The three missing pieces, built (2026-09-02)

An audit before this section found the data and the logic solid, and the parts needed to USE it
without an agent re-deriving the method absent: no skill, no codified search capture, no absorption.

### 27.1 `searchResults.ts` + `comp-search.ts` — the instrument, codified

The best capture we found existed only as JavaScript typed into a browser, and it took three wrong
attempts to get right. It is now a module with 14 tests, carrying every mechanic that cost one of those
attempts:

- **Both price forms.** 11 of 25 live cards carry `Original price X. Current price Y.`; the other 14 a
  bare `Price X lei`. A pair-only parser misses more than half.
- **The virtualised list.** Off-screen cards leave the DOM — 25 at the top, **6** after scrolling. The
  collector's own comment says collect-before-scrolling, because that is where it will be read.
- **Split on the name anchor**, not the trailing `See availability`, which parsed 6 of 25.
- **Whole-batch echo.** Every card states `2 nights, 2 adults, 2 children` beside its own price. If ONE
  card disagrees the page is mid-update and the entire batch is refused — nothing partially banked.
- **Matching by SLUG, never by name**: `Casa Drumetului` lives at `vila-drumetului-comarnic`.
- **Absences reported.** A curated listing the search omits is a finding (§24.2), never a blank.

`comp-search.ts` prints the URL and the collector, then turns the collected cards into rows for the one
write path — including `unavailable` rows for the absences, with the reason.

### 27.2 `docs/ota-capture-protocol.md` — one description of the loop

The browser loop lived inside `ota-parity/SKILL.md` and would have been copied into the new skill, so
the two would have drifted — and a drifted capture loop fails silently with plausible numbers. It is
now one document both skills point at, carrying the five traps that each produced a stored wrong
number, the never-slice rule, the pacing, and the read-back rule.

`ota-parity` §4 now defers to it and keeps only what is specific to our own listings.

### 27.3 `absorption.ts` — the half that changes a decision

Two readings become an answer. Almost every one of its 17 tests pins a REFUSAL to over-claim:

- Only a **transition** — priced, then not — is evidence something sold, always with both dates and
  the last price.
- A single `not-sellable` reading is **a state, never an event**.
- A **refusal or an error says nothing about demand** — it is about the probe.
- A **park** sells out only when every unit goes: a stronger, rarer signal, reported apart and never
  tallied beside single houses.
- **No percentage sold, ever.**

Wired into `comp-report`, which now reads the full append-only history rather than the newest row per
cell — the first output in this system that the append-only store actually exists for.

### 27.4 The skill

`.claude/skills/competitive-position/` — the run in order, the rules the reading may not break, and
one instruction it repeats because it is the one an agent will otherwise skip: **never add to or
retire from the set on your own.** The search page produces candidates; the owner disposes.

### 27.5 What this does and does not buy

A run is now: *"where do I stand on 24-28 October?"* → the skill loads, drives the browser for a few
minutes, records through the one write path, and prints the board.

**It is still not unattended, and cannot be.** The capture needs the owner's signed-in browser driven
by an agent — there is no API, and the Genius session is his. The honest ceiling is a triggered run,
not a cron job. What the skill changes is that the run is repeatable and self-correcting instead of
being re-derived, with the same traps rediscovered, every time.

### 27.6 Still not built, and deliberately

- **The position never reaches the admin screen.** The tab shows the comparable set; `comp-report` is
  CLI. That is Phase 5.
- **No situation-pack `market` section**, so the analyst still cannot route "that is demand, not
  price".
- **No run shapes or budget allocation.** §5's arithmetic is obsolete anyway now that one load covers a
  field; it should be rewritten against the search instrument rather than patched.

---

## 28. The market tab, and the coverage lie it exposed (2026-09-02)

Phase 5. `comp-report`'s reading now has a screen, and building the screen surfaced a defect in the
reading that the CLI had been printing, unnoticed, all along.

### 28.1 A fifth tab, not a sixth card

`/admin/pricing` now carries **The market** beside The year, Prices & channels, Rules and Testing —
and the comparable-set card **moved** into it, out of Prices & channels where §17 had parked it.

The move is the point, not tidying. Everything on Prices & channels is a number the owner
**controls**; nothing on The market is (C2 — competitor prices never move a rate). Mixing them puts a
rival's price an inch from the slider that sets his, which invites exactly the reflex the whole design
refuses. Two tabs, two kinds of fact.

Inside the tab, per window:

1. **Absorption first**, above the prices. A rank means opposite things in a market that is selling
   and one that is not, so "is this window selling" cannot sit in a footnote under the ladder.
2. **Two panels side by side, one per channel** (C8), never merged.
3. The ladder cheapest first, our row marked, rating and review count beside each price.
4. Everything that did not quote, with its reason.

Wiring: `fetchMarketPositions()` in `competitor-actions.ts` — read-only, joins `latestByCell(self)`,
`latestByCell(competitor)`, the **full** competitor history (absorption is a comparison BETWEEN
readings, so `latestByCell` alone cannot produce it), the set and the party mix. Windows are derived
from the competitor observations themselves and filtered to `checkOut >= today`: a stay already past
cannot be sold, so it is history, not a decision. Rendered by `_components/market-panel.tsx`.

### 28.2 The defect: "4 of 7 quoted" for a field of fifteen

The tab rendered, and the Booking panel read:

```
4 of 7 quoted · oldest 0d · solid
```

Confident, and materially misleading. The Booking field is **fifteen**. Seven listings had readings
for 24-28 Oct; one cannot host 2a+1c; **seven had never been read at all** — and both readers dropped
them silently, on this reasoning, which was written into `comp-report.ts` as a comment:

> *A cell we never captured is neither a quote nor a refusal — it is simply absent, and the sample line
> says so by counting what was asked.*

It does not say so. "4 of 7" reads as near-complete coverage of a market; it was coverage of a third
of one, with `confidence: solid` on top. This is the same error as treating unread capacity as a moat
(§25) — wrong in the **flattering** direction, which is the direction that gets acted on.

Fixed in the pure module, so both readers inherit it: `PositionInput.unread` carries the comparables
that **could** host the party and simply have not been read. They are counted apart (`sample.unread`,
`sample.field`), named on screen, and noted:

> *7 of the 15 comparables on booking.com have never been read for this window (…). The band and the
> rank are over the 4 that quoted, not over the field — a comparable nobody asked is unknown, not
> absent.*

Confidence is deliberately **not** downgraded automatically. "Solid" still describes the four quotes;
what changed is that the screen now says what those four are solid *about*. Whether a third of the
field is enough is the owner's judgement, and it needs the number in front of him, not a label
computed over it.

Two tests pin it, including the negative: a fully-read field says nothing about unread comparables.

### 28.3 Still not built

- **No situation-pack `market` section** (§27.6 stands) — the analyst still cannot route "that is
  demand, not price".
- **No run shapes or budget allocation.** §5's arithmetic is obsolete now that one load covers a field.
- **The seven unread Booking comparables are a real gap in the 24-28 Oct reading**, not a display bug.
  One search page closes it.

---

## 29. The Booking field filled — and two fabrications it exposed (2026-09-02)

§28.3 left seven Booking comparables unread for 24-28 Oct. One search load closed that. The gap was
worth closing on its own; what it changed, and what it exposed on the way, matters more.

### 29.1 The reading it replaced was wrong in the flattering direction

| | before (7 of 15 read) | after (15 of 15) |
|---|---|---|
| Booking sample | 4 of 7 quoted | 8 of 14 quoted, 0 unread |
| The set | 2,803 – 5,320, median 3,890 | **1,706 – 5,320, median 3,202** |
| Our rank | **1 of 5 — cheapest** | **4 of 9 — mid-pack** |

Three comparables sit below us and none of them had ever been read: TETRA Plus 569 at 1,706,
Moon Valley at 2,279, Chalet Husky at 2,524 — all three carrying a discount. The partial sample did
not merely understate the field, it inverted the conclusion: "you are the cheapest house on Booking"
became "three cheaper ones are on the same page." Exactly the decision this system exists to protect.

The Airbnb field was complete already and is unchanged: 6 of 7, cheapest at 2,369.

**Cross-validation, free:** our own listing appears in the search results at **2,719**, identical to
the detail-page capture stored for the same window. Two instruments, one number.

### 29.2 `programApplied: false` was fabricated, again

`comp-search.ts` stamped `session: { program: 'genius', programApplied: false }` on every row as a
literal. It is not measured and cannot be: **a search card shows a struck-through price for a Genius
discount and for an ordinary promotion alike, and never says which.** This is the second time a
plausible default has been written into the one field that exists to record what was actually seen
(the first is in §20).

Fixed at the type: `CaptureSession.programApplied` is now **optional, and absent means NOT MEASURED**.
`comp-search` omits it; `promoActive` still records that *something* was discounted, which is what the
card genuinely shows. `position.ts` now separates "demonstrably has no loyalty discount" from "read
off an instrument that cannot tell", and says which in the note.

### 29.3 A refusal discredits the prices read before it

With the new rows in, absorption reported:

> *2 of the set went off sale between readings; 15 still on sale. **This window IS selling** — so an
> empty week here is not a demand problem.*
> *AVA Chalet — last priced 5040 on 2026-09-01, gone by 2026-09-02*
> *Villa The Frame — last priced 7025 on 2026-09-01, gone by 2026-09-02*

Both are false, and the headline they produced is the opposite of the truth. Their series are:

```
ava-chalet-bk    priced 5040 → priced 5040 → refused (children under 12) → not-sellable
villa-the-frame  priced 4752 → priced 7025 → refused (adults-only)       → not-sellable
```

Those prices are the ones banked before the party-not-accepted trap was found (§24.3). The properties
do not take a family with a ten-year-old **at all**, so nothing was ever on sale to that party and
nothing could have sold. `readAbsorption` dropped refusals as "uninformative", which left the bad
prices standing and turned their disappearance into a sale.

**The rule is now: a refusal invalidates every reading before it.** An adults-only bar or a child-age
bar is a standing policy, not a state that changes between probes — so only readings *after* the last
refusal can say anything, and often that leaves nothing, which is the honest answer. Two rows were
enough to flip a window's verdict; the corrected reading is *"nothing went off sale; 15 still on
sale"*, which is what the market actually did.

Note this also changes `priced → refused` from `on-sale` to `no-signal`. The old test asserted the
former on the reasoning that the last *informative* state stands. It does not stand: the price it
refers to was never bookable by this party.

### 29.4 Bulk egress is blocked, so verify the transcription with a hash

The collector's output is 15KB and every escape route is closed — a `fetch` to `127.0.0.1` is blocked
by CSP like everything else, and `javascript_tool` truncates its return near 1KB. The payload has to
come back in ~900-char slices and be reassembled by hand, which is exactly the kind of step that
introduces a silent one-character error.

So don't trust it — **check it**. Compute FNV-1a over the string in the page, compute it over the
reassembled file, and compare before parsing anything:

```js
let h=2166136261>>>0; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0;}
```

It caught a real error immediately: the file was the right *length* and the hash differed, because
Booking writes **72 non-breaking spaces** inside prices and the transcription rendered them as plain
spaces. A per-slice hash localised it; a character-class inventory identified it; the 72 indices
patched it, and the file then matched the page byte for byte.

### 29.5 Open, for the owner

**Casutele de la Poienita is quoted at 3,497 for 2a+1c and the set says it cannot host that party.**
Booking is offering it as two Double Rooms. `hostsParty` refuses that because of his own rule — *"if
I'm with kids, is less likely to put small children in another unit"* — so the price is recorded and
correctly excluded from the ladder. That is a substitutability judgement, not an availability fact,
and it stays his to make. Nothing changes unless he says so.

---

## 30. The splitting rule is about AGE, not about children (owner, 2026-09-02)

§29.5 put the Casutele de la Poienita tension to the owner. His answer:

> *"a kid around 7 or older is acceptable in a second room for properties that sell these type of
> accommodation"*

So the original rule — *a party with children needs one unit* — was a reasonable reading of
*"less likely to put small children in another unit"* and too blunt. **Small** was the operative word,
and it means an age, not the presence of a child.

### 30.1 What is implemented

`SEPARATE_ROOM_MIN_AGE = 7` in `lib/competitive/set.ts`. Every child below it must share a unit with an
adult; children at or above it, and adults, may be placed anywhere. The ages are the party's own
(`childAges()` in `lib/parity/party.ts`, from the configured `CHILD_AGES = [10, 4]`), never assumed —
so changing the configured ages moves this judgement with them, the way it already moves the Booking
capture URL.

Feasibility across units is now **two** conditions, not one:

1. everybody fits across the bookable units, and
2. some bookable unit holds **one adult plus every under-seven child**.

Checking only the total would house a four-year-old alone in a double room. The anchor is measured
against the pool of *bookable* units, not `largestUnit`, so a sold-out big unit cannot satisfy it.

With `CHILD_AGES = [10, 4]`: **2a+1c** (a ten-year-old) may split freely; **4a+2c** carries a
four-year-old and needs a unit that seats at least two.

### 30.2 What it changed in the field

Three listings joined fields they had been excluded from — a contained, checkable change, not a
loosening that swept everything in:

| party | in-set before | in-set now | joined |
|---|---|---|---|
| 2a+1c | 21 of 22 | **22 of 22** | Casutele de la Poienita |
| 4a | 18 of 22 | 18 of 22 | — |
| 4a+2c | 13 of 22 | **15 of 22** | Casutele din Poienita, Moon Village |

On 24-28 Oct, Casutele de la Poienita's already-captured **3,497** moved from excluded into the ladder,
just above us. Booking now reads **9 of 15 quoted, you 4 of 10** — our position unchanged, the field
one deeper and, more to the point, no longer claiming a moat that Booking was actively selling through.

### 30.3 The general lesson

The old rule was not a bug in the code; the code did exactly what §12 said. It was a **rule stated
once, in passing, and then encoded as though it were exact.** What caught it was not a test but the
market disagreeing with it in public: Booking selling the property to a party the set said it could
not host. When an instrument and the market disagree, the instrument is the thing to re-examine —
and the fix belongs with the owner, because substitutability is his judgement, not a measurement.

---

## 31. Airbnb has a search page. It never did not. (owner, 2026-09-02)

Asked what was next, the reply was a recommendation built on a false premise: *Booking costs 1 load
per window, Airbnb costs 7, so ration Airbnb.* The owner answered with a URL — an Airbnb search for
Comarnic, 24-28 Oct, 2 adults and 2 children.

The protocol had said **"Airbnb (no equivalent)"** since it was written. Nobody had tested it.

### 31.1 What the card actually carries

Everything Booking's does, and the echo in a better place:

- **A stay TOTAL**, struck-through and discounted: `L 2,595 RON   L 2,369 RON total`.
- **The room id**, in the card's own `/rooms/<id>` link — the join key, never the name.
- **The echo in that same href**: `check_in`, `check_out`, `adults`, `children`. Booking states its
  echo in card text; Airbnb states it in the link, which survives a card still rendering its text.
- Rating, review count, bedrooms, beds, and a **candidate feed** — 30 of the 36 cards over two pages
  were not in the curated set.

**It agrees with the detail probes.** Our own card read **2,369** against a stored self observation of
2,369. AVA Chalet 4,684 = 4,684. Peaceful Forest Haven 4,594 = 4,594. Panoramic View Cabin 3,520 =
3,520. Two moved slightly (MSC 2,426 vs 2,438; Villa The Frame 5,644 vs 5,705) — same party, a day
apart, so those are price movements rather than instrument error.

### 31.2 The difference that matters: an absence

A Booking search returns the town in one page, so a missing curated property has been **excluded**,
and `comp-search.ts` records that as `unavailable` with a reason. Airbnb paginates **18 at a time over
~15 pages** of a much wider radius, so "missing" and "ranked below where we stopped" are the same
shape from the page.

The owner pushed back on the first draft of this, and was right to:

> *"the absence from the first 2-3 pages on a Comarnic search could be the total absence which means
> they are booked or they don't have availability for the requested party"*

The evidence supports him. All three absentees on the first run had a real cause:

| absent | why |
|---|---|
| MSC Forest Retreat | sleeps 3, the party was 4 — Airbnb's guest filter excluded it. At 2a+1c it reappeared. |
| Ceas cu Cuc | probed: *"Those dates are not available"* |
| Adorable 2 Bedroom Tiny Home | probed at both parties: *"Those dates are not available"*, and it sleeps 6, so the party was not the reason |

Three for three. But "usually" is not "always", and this system has twice recorded a plausible value
nobody measured (§20, §29.2). So `matchAirbnbToSet` returns absentees as a **probe list**, and one
detail load each turns a strong hint into a read. On 24-28 Oct that was **1 search + 2 probes instead
of 7 probes**, and every stored row came from a page that was actually read.

### 31.3 The parse happens IN the page, using the compiled parser

A page of Airbnb cards is ~16KB of raw text; two pages carried **608 non-breaking spaces**. Getting
that out through a tool that truncates near 1KB and blocks bulk egress means dozens of hand-copied
slices and a hand-patched whitespace repair (§29.4). Not sustainable across 69 windows.

So `parserSnippet()` ships the **compiled source of `parseAirbnbCard`** into the page. This is the
opposite of the two-implementation trap the protocol warns about: there is exactly one implementation,
the tested one, executing in both places. The payload dropped from **32,442 chars with 608 NBSPs to
9,561 chars with none**, and the reassembly matched the page's hash on the first attempt.

Two shims stand in for what a bundle would provide. The namespace one is toolchain-specific —
`import_searchResults.norm` under tsx, `_searchResults.norm` under jest — so the reference is
**rewritten away** rather than shimmed under whichever name today's compiler picked. A test evaluates
the snippet and asserts it agrees with the module on four fixtures, which cannot catch drift (there is
none) but does catch the shims going stale.

### 31.4 What the window says now, and the first real absorption signal

Airbnb is fully read: **5 of 7 quoted, 2 probed unavailable, you cheapest at 2,369** against a set of
2,426-5,644. Both channels are now complete for 24-28 Oct.

And the first genuine absorption event in the system's history:

> *Adorable 2 Bedroom Tiny Home — last priced 2,702 on 2026-09-01, gone by 2026-09-02.*

No refusal contaminates that series (§29.3), and the disappearance was confirmed on the listing's own
page rather than inferred from a search absence. Something sold.

**Which prompted one more correction.** `summariseField` answered that single transition with *"This
window IS selling — so an empty week here is not a demand problem"* — a sentence that reads as an
instruction to cut a price, drawn from n=1. One sale is a booking, not a trend. The headline is now
scaled to the evidence: at one, *"enough to say the window is not dead, not enough to say our price is
why it is empty for us. A third reading would tell you which."* The strong sentence needs two.

### 31.5 The cost model, corrected

The recommendation in §30's wake was wrong by a factor of seven on the Airbnb side:

| | per window × party | 69 windows |
|---|---|---|
| Booking | 1 load | a few sessions |
| Airbnb | 2-3 loads + one probe per absentee | comparable, not prohibitive |

Airbnb no longer has to be rationed. The lesson is older than the fix: **a line in a doc is not a
measurement.** "No equivalent" survived because it was never worth an experiment to anyone — until
the person who uses the tool went and looked.

---

## 32. The board: a rank that points the right way (2026-09-02)

The market tab shipped and the owner used it:

> *"Not very happy with what I see there because can't understand easy and fast my property position
> against competition, the market situation."*

He proposed filling every window and party first. The order was flipped, and the reason matters: the
screen already failed at one window, so 200 more panels of the same thing would only make the wall
taller. But designing a ranked board against a single window is designing blind, so: **a small
targeted capture, then the redesign, then the bulk fill.**

### 32.1 The capture that settled the design

Four New Year windows on Booking, one load each, 2a+1c. Our own listing appeared in all four searches
at 4,539 / 6,010 / 5,330 / 7,243 — matching the stored self prices **to the leu, four for four**.

And the reading that broke the old screen:

> **30 Dec – 2 Jan: you 7,243, dearest of 4.**

True, and pointing the wrong way. **Ten of the thirteen party-eligible comparables had nothing left.**
The three still quoting were the remainder nobody had booked. Being top of that ladder is not evidence
of overpricing; it is closer to evidence of the reverse. A ladder cannot express that, because a ladder
has one axis.

### 32.2 Two axes, four states

| | most of the field GONE | field still OPEN |
|---|---|---|
| **you dear** | *Cleared above you* — the field is the remainder, not the market | **Exposed** — real choice, and you are the dear one |
| **you cheap** | **Left money** — a picked-over window you priced as though it were quiet | *Cheap, market quiet* — demand, not price |

The bottom-left is the money leak the old screen would have shown as *"good news, you are the
cheapest"*. The top-left is the false alarm it showed on New Year. Same numbers, opposite actions.

**Scarcity is readable from ONE capture.** How much of the field is on sale *right now* is a state,
not an event — unlike absorption, which asks whether that share CHANGED and needs two readings. So the
board works on a first capture and absorption sharpens it later instead of gating it.

`lib/competitive/board.ts` is pure and holds the thresholds: `LEVEL_BAND_PCT = 10`,
`SCARCITY = { tight: 0.4, open: 0.75 }`, `MIN_QUOTES = 3`. Twenty tests, most of them pinning the
December and October readings directly.

### 32.3 What the screen does with it

- **Only two colours mean anything** — red for money left, amber for real exposure. A screen where
  five things are urgent has nothing urgent on it, which is what the owner was describing.
- **"On sale" is never off-screen.** It decides what a rank MEANS, so it sits beside the rank with a
  ten-block bar, not in a footnote.
- **The gap is a percentage.** Totals do not compare across 3-, 4- and 5-night windows; a percentage
  is the only figure that scans down a column.
- **Ordered by attention, then by money at stake**, pro-rated by the nights still unsold — the same
  rule the year board uses. A window already booked is dimmed, labelled `Sold`, and asks for nothing.
- **The evidence is one `<details>` click away**, so the ladder, the silent comparables, the unread
  ones and absorption are all still there without a client component.

Availability comes from `availability/{id}_{YYYY-MM}`, verified against real docs: keys are unpadded
day numbers, and the only taken nights in range (9-10 Oct) fall outside every captured window, so
every "riding on it" figure is genuinely open money.

### 32.4 A defect the screen caught on itself

First render showed the October Airbnb row as **`-48%` … "In line"**. Every mixed-scarcity row was
falling through to the same label, so a 48% gap was described as level. That is worse than saying
nothing: a row that argues with its own number makes the reader stop believing the rest of the screen.

Fixed, with `Above the field` / `Below the field` for the middle ground, and pinned by a test that
sweeps prices and scarcities and asserts **no label ever disagrees in direction with the gap beside
it.**

### 32.5 What the board says today

| window | you | gap | on sale | verdict |
|---|---|---|---|---|
| 23–27 Dec, Booking | 4,539 | −12% | 5 of 15 | **Left money** |
| 30 Dec–2 Jan, Booking | 7,243 | +117% | 3 of 15 | Cleared above you |
| 24–29 Dec, Booking | 6,010 | −6% | 4 of 15 | Cleared, you're level |
| 28–31 Dec, Booking | 5,330 | +93% | 4 of 15 | Cleared above you |
| 24–28 Oct, Airbnb | 2,369 | −48% | 5 of 7 | Below the field |
| 24–28 Oct, Booking | 2,719 | −22% | 9 of 15 | Below the field |

One row asks for something. The two that the old screen would have screamed about are correctly quiet.

### 32.6 Next

The bulk fill, now that the shape is known and worth capturing into — and Airbnb for the December
windows, which is where the board is currently half-blind.
