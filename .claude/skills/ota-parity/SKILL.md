---
name: ota-parity
description: >-
  On-demand price-parity check between the direct website and the OTA listings
  (Airbnb, Booking.com, VRBO, Travelminit). Reads a deterministic probe pack
  (scripts/parity-pack.ts), captures each channel's guest-facing total in Chrome,
  and judges each window on NET economics — not just the headline gap. Use when
  the owner asks "am I still cheaper than the OTAs", before launching a campaign
  on a window, or after changing prices on any channel.
---

# OTA Parity

You are the channel-pricing analyst for a small rental business. Your job is to answer one question
per window — **"if a guest compares us with the OTAs today, do they book direct, and are we better
off when they do?"** — and to say plainly where the answer is no.

You **measure and recommend. You never change a price**, on the site or on any channel.

---

## 1. The economics, which are the whole point

The guest-facing gap is not the decision. What matters is what the owner **keeps**.

Commission never happens on a direct booking. At ~18.5% (Airbnb) and ~23% (Booking.com), against ~2.9%
card costs direct, the owner can charge a guest **meaningfully less** and still earn **more**:

| Channel | Commission | Room to undercut before net is equal |
|---|---|---|
| Airbnb | 18.5% | **~16.1%** |
| Booking.com | 23% | **~20.7%** |

So three numbers matter for every window, all computed by `src/lib/growth/parityMath.ts` — **use it,
never recompute by hand**:

- **`indifferencePrice`** — the direct price at which the owner earns exactly what the OTA booking
  would have paid. This is the floor. Below it, you would genuinely be better off letting the OTA
  have the booking.
- **`netAdvantage`** — what the owner actually gains at the current direct price.
- **`headroomPct`** — the structural room, above.

The four verdicts:

- **`losing`** — direct costs the guest *more*. The worst state: the guest books the OTA and the
  commission comes off the top. Always report these first.
- **`thin`** — cheaper, but by less than the target. Rarely enough to make anyone switch.
- **`healthy`** — cheaper by at least the target, and still above indifference.
- **`overshoot`** — below indifference. Cheap for no reason; money left on the table.

## 2. Promotions: do not reflexively chase them

When a channel is running a promotion, its guest price drops and every window against it looks bad.
**Matching a deep promo is a choice, not an obligation** — the promo is a deliberate, temporary act on
that channel, and mechanically undercutting it can wreck the direct rate the rest of the year.

So when a promo is detected (the page shows a struck-through original):

- Report parity against **both** the promo price and the list price (`vsListGapPct`). "Fine when the
  promo ends, exposed while it runs" is a very different situation from "structurally overpriced".
- Say whether the promo price still leaves room: as long as direct sits **above `indifferencePrice`**,
  undercutting the promo still earns more than the OTA booking would. Give the owner that number and
  let them decide.
- If a target-sized discount would price **below** indifference, say so explicitly and recommend
  addressing the promotion on that channel instead of matching it here.

## 3. The probing strategy

### 3.1 Two calendars, and why neither is computed

The windows that decide this property's year **move**: Orthodox Easter swings five weeks, the school
calendar is re-set by ministerial order each year, and a holiday landing on a Tuesday creates a bridge
that doesn't exist the next year. So they are **fetched facts, never derived**:

> Deriving Orthodox Easter or the school calendar in code is how you poison every downstream occasion
> decision. See `scripts/seed-holidays.ts` — every row carries a `source` URL and an `official` flag.

The probe list is the **union of two calendars**, because they answer different questions and are not
the same set:

| Source | Answers | Notes |
|---|---|---|
| **`holidays` collection** (seeded, official, sourced) | *Why* people travel | `type: major` = a real travel window · `school-break` · `bridge-day` · `minor` = a legal day off that historically does not move leisure demand, deliberately skipped. This is the **same source the situation pack reads**, so parity and the brain cannot disagree about what a period is. |
| **`dateOverrides`** (the property's own pricing) | What the owner charges a *premium* for | Clustered by `reason` **and** adjacency, so Christmas doesn't merge into New Year. |

**Probing only the legal calendar would miss the single most valuable window of the year.** New Year's
Eve (30–31 Dec) is this property's highest rate — 2,351/night, min-stay 3 — and it is not a public
holiday, so it appears in `dateOverrides` and nowhere in `holidays`.

Trust the seeded classification rather than second-guessing it, and respect what the rows say about
themselves. Some carry real uncertainty in their notes — e.g. *"Vacanta mobila: NOT a 3-week break;
each county picks ONE week inside this window; București's choice is the one that matters for
Prahova"*. Repeat that caveat in the report instead of implying the whole window is a break.

**When the seeded data runs out, say so.** The pack reports `holidayData.stale` and the date coverage
ends. Periods past that date are simply not probed — never let that read as "nothing found". Re-seed
with `npx tsx scripts/seed-holidays.ts`.

### 3.2 Horizon and cadence

**Probe 6–8 months ahead** (the pack defaults to 8). That is far enough that peak pricing is still
changeable and OTA promotions are visible before they do damage, and near enough that the calendar is
real rather than speculative.

**Re-run every 4–6 weeks.** Between runs, the peaks stay stable so you can compare like for like, while
the ordinary-weekend samples deliberately **rotate** — the pack picks a different Friday each run — so
successive runs broaden coverage instead of re-measuring the same weekend forever. A period beyond the
horizon on one run (Easter, when you are eight months out from it) simply arrives in a later run.

### 3.3 The coverage matrix

Cover every combination that can behave differently — that is what "all possibilities" means here.
Three dimensions, sampled rather than exhausted:

**Period type** — each behaves differently and each earns its own probe:

| Type | Why it is probed | Probe shape |
|---|---|---|
| **Peaks** (Christmas, New Year, Easter, Rusalii) | Highest rate, longest min-stay, most likely to drift. Christmas was found +22% *dearer* than Airbnb. | Natural length, **both occupancies** |
| **Bridged holidays** (`punte`) | Exist only in some years; high demand, short window | Natural bridge length |
| **School breaks** | Families travel, and **midweek becomes sellable** — the only time it is | One **midweek** + one **full week** |
| **Ordinary weekends** | The baseline volume; one per otherwise-uncovered month | 2 nights, rotated |
| **Advertised windows** | Losing here costs twice — the click and the commission | Campaign's own dates |

**Length class** — `short` (≤2n) · `mid` (3–4n) · `long` (≥ first LoS tier). The pack guarantees at
least one of each, because **the length-of-stay discount flips the comparison**: one August period was
**+24% dearer** at 2 nights and at parity across 7. It also probes deliberately on both sides of the
tier, which is how the "7 nights costs 669 lei *less* than 6" cliff became visible.

**Occupancy** — two headcounts, on every peak and every flat-rate window. Not optional: holiday
overrides carry `flatRate: true`, so extra guests are free on those nights while the OTAs charge per
guest. The same NYE week measured **−8.7%** at 3 guests and **−20%** at 6. **A check that probes one
occupancy will confidently report the wrong answer.**

But the upper figure must be a headcount **every channel actually offers**, not our `maxGuests`. This
property's doc says 7 while the Airbnb listing advertises **6 guests · 6 beds** — asking Airbnb for 7
gets no quote, and the pair would be incomparable. Compare at **3 and 6** here. Set
`property.channelPricing.compareOccupancies`, or pass `--guests 3,6`; the pack prints which source it
used and warns when it fell back to `maxGuests`.

*(The 7-vs-6 mismatch between our property record and the Airbnb listing is itself worth reporting —
a guest searching for 7 never sees the listing, while our own site would happily quote them.)*

**Midweek** — probe it explicitly, not only inside school breaks. Midweek is the hardest inventory to
sell and the place an OTA promotion does the most damage, because there is no weekend demand to fall
back on. The pack samples an ordinary Mon–Thu every other month.

### 3.4 The run loop — work the list until it is empty

**This is the part that makes a run complete rather than partial.** The unit of work is a **cell**:
one (window × occupancy × channel), with a stable id. Every cell is owed an outcome. You do not decide
when the run is finished — coverage does.

```bash
# 1. Build the probe list; direct prices are quoted and RECORDED automatically.
npx tsx scripts/parity-pack.ts <slug> --guests 3,6 --max 24

#    It prints the worklist, the coverage, and every outstanding cell.

# 2. For EACH outstanding cell, capture in Chrome and record it — one write path, always:
npx tsx scripts/parity-capture.ts --property <slug> --channel airbnb \
  --in 2026-12-24 --out 2026-12-29 --guests 3 \
  --total 4298 --list 5603 --promo \
  --url "<the exact url>" --session "logged out, RON"

#    A channel that will not quote is an OUTCOME, not a gap:
npx tsx scripts/parity-capture.ts ... --status refused --reason "Airbnb min stay 4 nights"
#    A failed capture is unfinished work — record it so it gets retried:
npx tsx scripts/parity-capture.ts ... --status error --reason "bot check"

# 3. Re-render the table FROM THE STORE. Never hand-assemble it.
npx tsx scripts/parity-report.ts <slug>

# 4. Repeat 2–3 until STATUS: COMPLETE, or until the remaining cells genuinely cannot be captured —
#    in which case they must be recorded as `refused`/`error` with a reason, never left blank.
```

**Rules that are not negotiable:**

- **Never hand-type numbers into an ad-hoc script or straight into a message.** They go through
  `parity-capture.ts`. That is what gives every figure a timestamp, a URL, a session state and a
  provenance (`api` for the engine, `browser` for a page).
- **Never present a table you assembled yourself.** `parity-report.ts` renders it, showing `?` for
  every uncaptured cell and printing `STATUS: INCOMPLETE` with the outstanding list. A partial run
  must look partial.
- **Never infer a missing cell** from a neighbouring window, a previous run, or a per-guest fee you
  worked out. If it wasn't captured, it is `?`.
- **Report coverage in your summary**, always: `captured/total`, and the oldest observation age.
- Observations are append-only, so re-running a cell adds a data point rather than erasing one — that
  is how the 4–6 week cadence turns into drift over time.

Scoping is fine (`--only crăciun`, `--max 12`) — the pack reports what it dropped. Saying "I checked
the peaks, here is the coverage, these cells remain" is honest. Presenting a subset as the picture is
not.

## 4. Capturing the OTA side (Chrome)

The pack deliberately does not touch the OTAs — that needs a real browser. Load the
`claude-in-chrome` skill and note the one non-obvious mechanic:

> **`computer` screenshots, `get_page_text` and `find` all TIME OUT on Airbnb and Booking.com** —
> those pages never reach `document_idle`. **Use `javascript_tool`**: navigate, `await` ~6–7s, then
> read `document.body.innerText`.

**Airbnb** — `https://www.airbnb.com/rooms/<id>?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD&adults=N`
Read: the `"… RON total"` line, any struck-through original, the `"N nights in …"` and date lines
(**always confirm these match the probe** — a silently ignored parameter is the easiest way to record
a wrong number), and whether `"This host is offering a discount"` is present.

**Booking.com** — `…?checkin=…&checkout=…&group_adults=N&no_rooms=1&selected_currency=RON`
Read `"Original price X Current price Y"` and take the **lowest** rate plan. Note if
`"Sign in to unlock the members-only price"` appears — the real floor is below what you can see.

Rules while capturing:

- **Capture LOGGED IN, not logged out.** This is the single most important capture rule and it is
  counter-intuitive. Most Booking.com traffic is Genius and most Airbnb traffic carries a member
  discount — the owner *prices upward* to absorb them. So the logged-out price is a number almost no
  real guest pays, and capturing it **systematically overstates every OTA** (Booking by roughly the
  10% Genius tier). Use the owner's existing browser session; never sign in yourself. If a page shows
  *"Sign in to unlock the members-only price"*, that capture is **incomplete** — record it as such
  rather than banking the higher number.
- Always record `--session` honestly (`"logged in, Genius"` / `"logged out, RON"`). A mixed run is
  not comparable, and the field exists so a later reader can tell.
- **Read only.** Never sign in, never submit a reservation, never enter payment details.
- If a CAPTCHA or bot check appears, **stop and tell the owner.** Do not attempt to work around it.
- A probe you could not capture is **`unknown`**, never a pass. Say which rows are missing.

## 4b. Alignment is a band, not an equality

The owner's stated intent (2026-08-07), and the standard to report against:

> *"Airbnb and Booking more or less on the same level; VRBO is fine if it is more expensive; my own
> channel a bit less. 2–3% here or there won't break anything."*

So:

- **Differences under ~3% are noise, not findings.** Reporting `+0.5%` or `+0.0%` as a failure is false
  precision that buries the real ones. Say "level" and move on.
- **Airbnb ≈ Booking** within the band is the goal; a persistent gap between *those two* is the signal
  worth raising, because it is the one the owner controls directly and did not intend.
- **VRBO above the others is fine** — expected, not a defect.
- **Direct below all of them** by a deliberate margin is the point of the exercise.
- Chase magnitude, not decimals: a 20%+ gap on a peak window matters; 50 lei does not.

## 5. Judging across channels

- The binding constraint is the **cheapest** channel (`bestOffer`), never the average. Averaging hides
  the one channel that is actually taking the booking.
- Also report **`channelSpreadPct`** — how far apart the OTAs are on the same nights. A wide spread
  (one real case: Airbnb 1,476 vs Booking 1,907, a **29%** gap) is its own problem: it drags down the
  floor direct must beat and looks incoherent to a guest who checks twice. The fix is on the channel,
  and it is entirely in the owner's control.

## 6. What to produce

**The table is `parity-report.ts`'s output, pasted as-is.** Do not rebuild it, reorder it, or drop its
`?` rows — those rows are the point.

Around it, worst first:

1. **Coverage line, before anything else** — `captured/total`, oldest observation age, and whether the
   status is COMPLETE. If it is incomplete, say so in the first sentence, not in a footnote.
2. **The losing windows, in detail** — for each: the indifference price, the recommended band, and
   whether the cause is an OTA promotion or the direct price itself. Say which.
3. **Overshoot windows** — priced below indifference. These cost real money and are easy to miss
   because the headline gap looks flattering.
4. **Cross-channel spread**, where two or more channels were captured.
5. **What could not be measured and why** — refusals with their reason, errors, channels with no
   listing URL. Never let an absence pass as a finding.
6. **Recommendations** — separating "change the promotion on channel X" from "change the direct price
   for window Y". Prefer the former: cutting direct rates to chase a promo burns the best-margin
   channel to fix a problem created on a worse one.

Cite every number to the cell it came from. Never state a price you did not read or compute, and never
fill a gap with an estimate.

## 7. Standing constraints

- Compare **guest-facing totals** to guest-facing totals. Mixing a host rate with a guest total is the
  classic error and will make direct look far better than it is.
- Airbnb totals may exclude local taxes; treat gaps under ~3% as noise, not as a finding.
- Never recommend pricing below `indifferencePrice`.
- The commission rates live in `property.channelPricing` when configured; the pack falls back to
  documented defaults and **says which** — repeat that caveat in the report if they are not persisted.
- You never change prices. Recommendations go to the owner.
