---
name: competitive-position
description: >-
  Where this property sits against its curated comparable set, on one window, per channel. Captures a
  Booking search page (one load for the whole field) or per-listing probes, records through the single
  write path, and reports a band, a rank and — once two readings exist — who went off sale. Use when
  the owner asks "where do I stand", before pricing a window, or when a window is empty and the
  question is whether that is price or demand.
---

# Competitive Position

You answer one question per window: **"where does he sit among the properties a guest actually sees,
and is this window selling at all?"**

You **measure and report. You never change a price**, and no solver reads this data — that is C2 in
`docs/competitive-position-engine.md`, enforced by an import-boundary test. Competitor prices are
context for a decision the owner makes.

The browser loop is **not described here**. It lives in **`docs/ota-capture-protocol.md`** and
`ota-parity` uses the same one. Read it before touching a page; every rule in it was learned by
storing a wrong number.

---

## 0. The run, in order

**For a batch — the normal case — use `comp-run`. Two commands and one browser pass.**

| # | | |
|---|---|---|
| 1 | `comp-run.ts --plan --windows a:b,c:d --parties 2a1c,4a2c` | Every URL, plus ONE snippet that is the same on every page. Writes nothing. |
| 2 | *Chrome: load → paste → next* | The only manual step. Batch 2-3 navigations per `browser_batch`; more times out. |
| 3 | *read `sessionStorage.getItem('__run')` ONCE, hash-check it* | Protocol §10. The snippet accumulates, so a navigation never loses what came before. |
| 4 | `comp-run.ts --blob blob.json` | Verifies every echo, matches the set, writes through the one path, and **reads every row back**. |
| 5 | `comp-report.ts --in --out --guests` | The reading, or open **The market** tab. Render it; do not rebuild it. |

Step 4 is not optional and is not hand-written any more: a write that reports success proves nothing,
and both data-loss bugs in this system were found only by reading fields back. It lives in the command
so a hurried run cannot skip it.

**Single window, or Airbnb:**

| | |
|---|---|
| `comp-search.ts --in --out --party` | Booking, one window. Same in-page parse, `--cards` to finish. |
| `comp-search-airbnb.ts --in --out --party` | Airbnb, 18 per page. Absentees come back as a **probe list**, never as `unavailable` — its search is 15 pages deep, so "missing" and "ranked low" look identical. |
| `comp-next.ts --in --out --guests` | Per-listing probes: Airbnb absentees, listings outside the radius, capacity checks. |

**Everything parses IN THE PAGE**, using the compiled source of the tested parser (`parserSnippet()`),
not a copy of it. One implementation, and it cuts the payload by two thirds while removing every
non-breaking space — which is what makes reading it back out survivable at all.

**A four-window run was about forty steps before this existed. It should now be a handful.** If you
find yourself hand-writing a read-back check, or reassembling row files, stop: that work belongs in
the script, and leaving it in the transcript is how it gets skipped next time.

---

## 1. What the set is, and what you may not do to it

`competitorListings` is **owner-curated**. A comparable is not "a house near Comarnic"; it is a listing
a guest treats as an alternative, which is a judgement only he holds.

- **Never add, retire or re-scope an entry on your own.** The search page produces CANDIDATES; you
  present them ranked by review volume and he decides.
- Each entry carries `substitutionBasis` — why it competes, in his words. An entry nobody can explain
  is the rot that field exists to prevent.
- **The set ages.** `verifiedAt` past its budget reads as unverified, not as fact.
- Retiring never deletes: the reasoning for an exclusion is part of the set.

---

## 2. Two channels, two contests

Airbnb and Booking are **separate fields, scored separately, never pooled**. A guest browsing Airbnb
sees his Airbnb price beside other Airbnb listings, at a price he sets separately. A rank across both
is a rank nobody experiences.

The same house on both channels is two entries, linked by `sameAs` for display only.

**His direct price is never ranked** — no guest browsing a channel sees it. It is a reference line.

---

## 3. The field changes size with the party

`hostsParty` decides membership, and it takes the **smallest unit that fits**, so a group venue
competes for a family through its small apartment rather than its 21-person house.

- **Child AGE decides splitting, not the presence of children.** The owner, 2026-09-02: *"a kid around
  7 or older is acceptable in a second room for properties that sell these type of accommodation."*
  Every child under `SEPARATE_ROOM_MIN_AGE` (7) needs a unit with an adult in it; older children and
  adults go anywhere. Ages come from `childAges()`, never assumed.
- **Combining takes two conditions**: everyone fits across the bookable units, AND one bookable unit
  holds an adult plus every under-seven child. Totals alone would put a four-year-old in a room alone.
- The earlier "a party with children needs ONE unit" was this rule read too bluntly, and it cost a
  real comparable: Booking was selling Casutele de la Poienita to a 2+1 as two double rooms while the
  set recorded it as unable to host them.
- **A comparable that cannot host the party is a FINDING, not a gap** — competition he does not face
  on that window, measured without a page load. Never counted against coverage.
- **Unread capacity is `unknown`, never a moat.** Claiming "no competition here" on missing data is
  wrong in the flattering direction.
- **A search proves capacity, but not in how many PIECES.** A property the search returns for party
  *P* can house *P* — so a search is a free capacity floor for the whole field, and may only ever
  RAISE a recorded number (an absence can mean sold out). But check the card for a `2×` room marker
  first: reading a two-unit offer as one large unit turned TETRA Plus 569, two houses of three, into
  one house of six. Beds and m² give it away too — the composed card reports the beds of the whole
  offer and no single m².
- **`no_rooms=1` does not hide multi-room offers.** Tested at `no_rooms=3`: identical results.
  Booking composes combinations either way, so a park's absence is as real as a house's.

---

## 4. What the reading may and may not claim

`position.ts` enforces most of this; do not narrate around it.

- **Below 3 quotes: no band, no rank.** Report the individual readings; infer nothing.
- **Rank out of the number sampled. Never a percentile** — six to ten comparables cannot support one.
- **Sample size and age on every figure.** "6 of 8, oldest 9d" is part of the number.
- **A comparable that did not quote is never dropped** — it appears with its reason.
- **A comparable nobody has READ is not an absent one.** It is counted and named apart (`sample.unread`),
  because "4 of 7 quoted" over a field of fifteen reads as coverage of a market and was coverage of a
  third of it. Filling that gap once moved this property from 1st of 5 to 4th of 9.
- **Quality sits beside price, never inside it.** One flag, on a specific pair, above a 20-review
  floor. Most of this market scores 9.5+; review count does the work.
- **`not-sellable`, never `sold`**, on a single reading.
- A programme discount (Genius) is **part of the offer**, not a flaw. Say who the ranking is for; do
  not adjust it.

---

## 5. Absorption is the point, and it needs two readings

Price position tells him he is cheap or dear. **Absorption tells him whether the window is selling** —
and that is what separates "I am priced wrong" from "nobody is travelling", which are opposite
instructions.

`absorption.ts` reads the append-only history:

- Only a **transition** — priced, then not — is evidence something sold, always reported with both
  dates and the last price seen.
- **A refusal invalidates every reading before it.** An adults-only or child-age bar is a standing
  policy, not a passing state: if the property will not take this party now, the price banked for this
  party last week was never on sale to it. Two such rows once flipped a window from "not selling" to
  "IS selling" — opposite instructions, off prices that never existed.
- A **park** does not go off sale when it sells one unit. Its sell-out is a stronger and rarer signal,
  reported apart, never tallied beside single houses.
- **No percentage sold, ever.**

So the second reading matters more than a wider first one. **When the owner asks for more, a repeat of
a window already read beats a new window.**

---

## 6. What to produce

The screen is **The market** tab, and it is built on two axes, not one (`lib/competitive/board.ts`).
Report in that shape, because a rank alone points the wrong way:

|            | most of the field GONE | field still OPEN |
|------------|------------------------|------------------|
| you dear   | *cleared above you* — the leftovers, not the market | **exposed** — real choice, and you are dear |
| you cheap  | **left money** — a picked-over window priced as if quiet | *cheap and quiet* — demand, not price |

1. **The verdict first**, and only the two states that need action get emphasis. A report where
   everything is urgent has nothing urgent in it.
2. **Coverage beside every rank** — quoted, of how many asked, plus what was never read. "Dearest of
   4" with ten sold out is not the same fact as "dearest of 4" in an open market.
3. **Who did not quote and why** — nothing left, refused the party, out of set, never read. Four
   different things; never one blank.
4. **Absorption**, when a second reading exists. When it does not, say the clock has not started —
   and remember one transition is a booking, not a trend.
5. **Candidates**, if a search surfaced properties outside the set — ranked by review volume, for him.
6. **What it means**, in one paragraph, distinguishing a price problem from a demand one.

Cite every number to the cell it came from. Never state a price you did not read, and never fill a gap
with an estimate. **Never suggest a price** — name the state, the decision is his (C2).

## 7. Standing constraints

- **Read only.** Never sign in as anyone, never start a booking. Public prices only.
- **You never change a price**, and nothing here feeds a rate.
- **Never add to the set on your own** (§1).
- **On the first CAPTCHA: stop and tell the owner.**
- **Read the data back after every write.** A write that reports success tells you nothing — both
  data-loss bugs in this system were found this way, and the second only because the first report
  checked one field and stopped.
- The full history is `docs/competitive-position-engine.md`. When something here looks arbitrary, the
  reason is there, and it is usually a stored wrong number.
