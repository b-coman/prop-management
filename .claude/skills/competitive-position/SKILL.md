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

| # | | |
|---|---|---|
| 1 | `comp-next.ts --in --out --guests` | Who competes for this party, with URLs. Refuses a window we have not quoted ourselves. |
| 2 | `comp-search.ts --in --out --party` | The search URL + collector. **Prefer this** — one load, whole field. |
| 3 | *Chrome: load → collect → save cards.json* | The only step that is not a command. Protocol doc. |
| 4 | `comp-search.ts ... --cards cards.json` | Verifies every card's echo, matches by slug, writes rows. |
| 5 | `parity-capture.ts --rows … --dry-run` then for real | The one write path. |
| 6 | `comp-report.ts --in --out --guests` | The reading. Render it; do not rebuild it. |

Per-listing probes (`comp-next`) are the fallback for Airbnb, for listings outside the searched
radius, and for capacity verification (`comp-verify-next` / `comp-verify-record`).

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

- **A party with children needs ONE unit.** The owner's rule: *"if I'm with kids, is less likely to put
  small children in another unit."*
- **An adults-only party may combine units**, cheapest first, respecting stock.
- **A comparable that cannot host the party is a FINDING, not a gap** — competition he does not face
  on that window, measured without a page load. Never counted against coverage.
- **Unread capacity is `unknown`, never a moat.** Claiming "no competition here" on missing data is
  wrong in the flattering direction.

---

## 4. What the reading may and may not claim

`position.ts` enforces most of this; do not narrate around it.

- **Below 3 quotes: no band, no rank.** Report the individual readings; infer nothing.
- **Rank out of the number sampled. Never a percentile** — six to ten comparables cannot support one.
- **Sample size and age on every figure.** "6 of 8, oldest 9d" is part of the number.
- **A comparable that did not quote is never dropped** — it appears with its reason.
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
- A **park** does not go off sale when it sells one unit. Its sell-out is a stronger and rarer signal,
  reported apart, never tallied beside single houses.
- **No percentage sold, ever.**

So the second reading matters more than a wider first one. **When the owner asks for more, a repeat of
a window already read beats a new window.**

---

## 6. What to produce

1. **Coverage first** — how many quoted, of how many, and the oldest age. If the sample is thin, say
   so in the first sentence.
2. **The ladder**, cheapest first, his own row marked, with rating and review count beside each price.
3. **Who did not quote and why** — refusals, absences, out-of-set.
4. **Absorption**, when a second reading exists. When it does not, say the clock has not started.
5. **Candidates**, if a search surfaced properties outside the set — ranked by review volume, for him.
6. **What it means**, in one paragraph, distinguishing a price problem from a demand one.

Cite every number to the cell it came from. Never state a price you did not read, and never fill a gap
with an estimate.

---

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
