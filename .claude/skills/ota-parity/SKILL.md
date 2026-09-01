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
| **Peaks** (Christmas, New Year, Easter, Rusalii) | Highest rate, longest min-stay, most likely to drift. Christmas was found +22% *dearer* than Airbnb. | Natural length, **the full party mix** |
| **Bridged holidays** (`punte`) | Exist only in some years; high demand, short window | Natural bridge length |
| **School breaks** | Families travel, and **midweek becomes sellable** — the only time it is | One **midweek** + one **full week** |
| **Ordinary weekends** | The baseline volume; one per otherwise-uncovered month | 2 nights, rotated |
| **Advertised windows** | Losing here costs twice — the click and the commission | Campaign's own dates |

**Length class** — `short` (≤2n) · `mid` (3–4n) · `long` (≥ first LoS tier). The pack guarantees at
least one of each, because **the length-of-stay discount flips the comparison**: one August period was
**+24% dearer** at 2 nights and at parity across 7. It also probes deliberately on both sides of the
tier, which is how the "7 nights costs 669 lei *less* than 6" cliff became visible.

**Party shape — not a headcount.** A probe is a *party*, `{ adults, children }`, because the three
channels price children differently: our engine counts heads, Airbnb takes `children` separately, and
Booking prices by each child's **age**. "3 guests" is not one product.

The owner set the mix on 2026-08-30, and it is the standard for every run:

| party | sent as | headcount |
|---|---|---|
| **2 adults + 1 child** | `adults=2 children=1 age=10` | 3 |
| **4 adults** | `adults=4 children=0` | 4 |
| **4 adults + 2 children** | `adults=4 children=2 age=10 age=4` | 6 |

Defined once in `src/lib/parity/party.ts` (`DEFAULT_PARTIES`, `CHILD_AGES = [10, 4]`, taken from a real
booking on this property). Configured per-property at **`property.channelPricing.compareParties`**;
`partiesFor()` reports which source it used and warns if it finds the retired `compareOccupancies`.
**Never hand-build a capture URL** — `buildCaptureUrl()` is the only place a party becomes a web
address, and it is what puts the child ages on Booking.

Probe the full mix on every peak and every flat-rate window. Not optional: holiday overrides carry
`flatRate: true`, so extra guests are free on those nights while the OTAs charge per guest. The same
NYE week measured **−19.3%** at 4 adults and **−24.6%** at 4+2. **A check that probes one party will
confidently report the wrong answer.**

🔴 **Capacity is 5 adults + 2 children (7 people). Never probe 6 adults.** `adults=6` is a party the
owner cannot host, and sending it did two kinds of damage: Booking refused correctly, and the refusals
were filed as "Booking has no offer for 6 adults" — which reads as a gap in his listing and is nothing
of the sort; while Airbnb happily answered, so a price for a product he does not sell entered the store
as if it were his. **38 forward observations were priced that way; they inflated Fall from +14.6% to
+35.9%.** Superseded 2026-08-29.

`--guests 3,4,6` still works but passes headcounts only, so the adult/child split is *guessed* — the
pack says so when you do it. Prefer the configured mix.

*(A guest searching for 7 never sees the Airbnb listing, which advertises 6, while our own site would
quote them. Worth reporting, but it is a listing issue, not a parity one.)*

**Midweek** — probe it explicitly, not only inside school breaks. Midweek is the hardest inventory to
sell and the place an OTA promotion does the most damage, because there is no weekend demand to fall
back on. The pack samples an ordinary Mon–Thu every other month.

### 3.4 The run loop — work the list until it is empty

**This is the part that makes a run complete rather than partial.** The unit of work is a **cell**:
one (window × occupancy × channel), with a stable id. Every cell is owed an outcome. You do not decide
when the run is finished — coverage does.

```bash
# 1. Build the probe list; direct prices are quoted and RECORDED automatically.
npx tsx scripts/parity-pack.ts <slug> --max 24        # party mix comes from compareParties
#    Scope BOTH ends when the owner names a stretch. `--months` only moves the far edge, so asking
#    for the autumn also probed the following spring — page loads spent against a bot-detection
#    budget on windows no decision was waiting on.
npx tsx scripts/parity-pack.ts <slug> --from 2026-09-03 --to 2027-01-10

# 2. Get the outstanding cells WITH their URLs already built (never hand-build one — §4.1).
npx tsx scripts/parity-next.ts <slug> --json --limit 15

# 3. Drive the browser per cell (§4.2-4.3), collecting rows. Then write the batch through the one
#    write path — validate first, and a bad row never abandons the good ones:
npx tsx scripts/parity-capture.ts --rows rows.json --dry-run
npx tsx scripts/parity-capture.ts --rows rows.json

#    A single cell can still be recorded by hand when that is all you need:
npx tsx scripts/parity-capture.ts --property <slug> --channel airbnb \
  --in 2026-12-24 --out 2026-12-29 --guests 3 \
  --total 4298 --list 5603 --promo \
  --url "<the exact url>" --session "logged in, Genius, RON"

#    A channel that will not quote is an OUTCOME, not a gap:
npx tsx scripts/parity-capture.ts ... --status refused --reason "Airbnb min stay 4 nights"

# 4. Re-render the table FROM THE STORE. Never hand-assemble it.
npx tsx scripts/parity-report.ts <slug>

# 5. Repeat 2–4 until STATUS: COMPLETE, or until the remaining cells genuinely cannot be captured —
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
- **Coverage is not validity.** `outstandingCells` counts a cell as covered if it was captured inside
  the freshness window, which says nothing about whether the SETTINGS behind it still hold. After any
  change to a discount, a rate plan or a minimum stay, run `scripts/parity-audit.ts` — it reports which
  stored observations a recorded change has superseded, and those need re-capturing even though
  coverage calls them fine.
- Observations are append-only, so re-running a cell adds a data point rather than erasing one — that
  is how the 4–6 week cadence turns into drift over time.

Scoping is fine (`--only crăciun`, `--max 12`) — the pack reports what it dropped. Saying "I checked
the peaks, here is the coverage, these cells remain" is honest. Presenting a subset as the picture is
not.

## 4. Capturing the OTA side (Chrome) — the driven loop

This used to be "open each page, read the number, retype it into a CLI", about a hundred times. That
is why a full run costs an afternoon and has happened three times. The loop below is the same work
with the hand-typing removed; the reading is still yours, because only `javascript_tool` reaches these
pages and only the owner's own browser is logged in.

**Preconditions, checked once before you start:**

- Load the browser tools in ONE `ToolSearch` call:
  `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__tabs_create_mcp`
- Call `tabs_context_mcp` once to learn the tab id. Never reuse an id from an earlier session.
- Confirm with the owner that Chrome is **logged in to Booking.com** (Genius) and Airbnb. A logged-out
  capture is a number almost no real guest pays.
- Work in ONE tab, reused across cells.

### 4.1 Get the work-list, with URLs already built

```bash
npx tsx scripts/parity-next.ts <slug> --json --limit 15
```

Emits outstanding cells each with a **fully-qualified URL**. Do not hand-build a URL: a mistyped
parameter does not fail, it returns a real price for the wrong window, and nothing downstream can
detect it afterwards. VRBO is excluded by default (see §7); pass `--include-vrbo` to include it.

### 4.2 Per cell: navigate, wait for a PREDICATE, extract

`computer` screenshots, `get_page_text` and `find` all TIME OUT on Airbnb and Booking — those pages
never reach `document_idle`. **`javascript_tool` is the only thing that works.**

1. `navigate` to the cell's URL.
2. `computer wait 7`, then poll a **readiness predicate, not a timer**: run a small script returning
   `{ hasPrice, len }` and re-poll while `hasPrice === false`, up to ~4 times.
3. Extract. **Return a compact status, never the raw page text.** `javascript_tool` truncates its
   return at ~1KB and these pages run 15-16KB, so the text has to be parsed **inside the page**.

🔴 **The extractor already exists. Do not write page-reading regex by hand.**
`src/lib/parity/inPage.ts` exports `IN_PAGE_EXTRACTOR` (the parser as an in-page string) and
`inPageRunner(channel, from, to)` (parses everything stashed in `sessionStorage` and returns one
compact line per page). `__tests__/inPage.test.ts` asserts it agrees with the Node `extract()` on
every fixture, so the pair cannot drift.

On 2026-09-01 an agent grepped `extract.ts`, concluded no in-page extractor existed, and hand-rolled
one inline in each batch call. It hit two bugs in ten minutes that `inPage.ts` had already solved:
a poll that returned the text captured BEFORE the price rendered, and a total that failed to match
because Airbnb prefixes it with `L `. It also nearly became a third implementation to keep in step.
**Read `inPage.ts` first.**

**All bulk egress is blocked**, and each path fails differently: Blob downloads are site-blocked, the
clipboard needs a user gesture, base64 comes back as `[BLOCKED: Base64 encoded data]`, and returning
`location.href` trips `[BLOCKED: Cookie/query string data]`. Do not design around shipping text to Node.

**Never slice the page.** A 700-char `head` looks sufficient and is not: Booking's rate rows sit far
below the fold, so a slice captures the summary price and silently misses every capacity marker. Store
the whole `innerText`.

```js
// per cell — stash the FULL text, return only a status line
await new Promise(r => setTimeout(r, 6000));
const t = document.body.innerText;
sessionStorage.setItem('p<N>', t);              // sessionStorage SURVIVES same-origin navigation
JSON.stringify({ i: <N>, len: t.length, echo: (t.match(/\d+ adults . \d+ child(?:ren)?/) || [''])[0] });
```

`sessionStorage` is the accumulator because **`window` is wiped by every navigation** — a global set on
page 1 is gone by page 2, and so is any extractor you installed. So: capture all pages first, then
install the extractor **once, after the last navigation**, and parse the whole batch from storage:

```js
// after the final navigate — paste IN_PAGE_EXTRACTOR, then:
Object.keys(sessionStorage).filter(k => /^p\d+$/.test(k))
  .sort((a, b) => +a.slice(1) - +b.slice(1))
  .map(k => { const r = window.__X(sessionStorage.getItem(k));
    return [k.slice(1), r.state, r.total || '', r.list || '', r.guests || '', r.plan || ''].join('~'); })
  .join('\n');
```

Keep `browser_batch` to **2-3 pages per call** (one navigate + one stash each), and keep the PARSING
out of those calls — stash only, then run `inPageRunner` once afterwards. Six pages at a 6-7s settle
overruns the tool timeout, and the batch dies after the navigations have already fired. Polling *and*
parsing inside the same batch times out at three pages; measured on 2026-09-01, two of four such calls
died. A dead batch is not free: its navigations already happened.

**A poll must RE-READ after it waits.** `for(...){t=innerText; if(ok) break; await sleep}` leaves `t`
holding the LAST failed read when the loop exhausts, so a page that renders a second later is filed
as having no price. Read the text again after the final wait, before parsing.

Feed `head` to the pure extractor rather than reading it yourself:

```ts
import { extract, verifyEcho } from '@/lib/parity/extract';
```

### 4.3 The echo check is a HARD ABORT, not a warning

Airbnb is a client-side router. Across ~100 sequential parameter changes a stale re-render is close to
certain, and a stale render shows a real price for the **previous** cell. `verifyEcho` compares the
nights, guests and dates the PAGE states against what the probe asked for.

**On mismatch: discard the reading, re-navigate once, and if it mismatches again record the cell as
`error` with the reason.** Never bank a number whose echo did not match. This is the single
highest-value check in the loop.

### 4.4 Record the batch

Collect rows and write once per batch of 10-15:

```bash
npx tsx scripts/parity-capture.ts --rows rows.json --dry-run   # validate first, writes nothing
npx tsx scripts/parity-capture.ts --rows rows.json
```

Each row carries `guestTotal`, `listTotal`, `promoActive`, `ratePlan`, structured `session`,
`rawExcerpt`, the `url`, and **`referenceTotal`** (the same window's direct quote, from the pack).
`referenceTotal` triggers a magnitude guard: anything outside 0.5x-2x of direct is refused as a
probable units error. That error has already happened here — four VRBO cells recorded USD figures
labelled RON, and 3,300 was stored as 728 and read as the cheapest offer on the market.

A refused row leaves its cell outstanding, so it is re-queued rather than lost. A bad row never
abandons the batch.

### 4.5 A min-stay refusal is NOT a finished cell — escalate it, on every channel

If a channel refuses a window because its minimum stay is longer than ours, recording the refusal and
moving on **silently loses the window**. The remaining channels then get compared at a length one of
them will not sell, which is not a comparison at all.

This is not hypothetical. On 2026-08-29 Airbnb refused 3 nights on the **autumn school break** — the
owner's emptiest month — so it was measured on Booking alone and read as *"direct 22% cheaper, but
below the floor"*. Re-probed at 4 nights across all three channels, the truth was the reverse:

| window (4n, 3g) | direct | Airbnb | Airbnb −15% | Booking | verdict |
|---|---|---|---|---|---|
| 24-28 Oct | 2,281 | 2,369 | **2,014** | 2,965 | **LOSING, direct +13.3%** |
| 25-29 Oct | 2,134 | 2,321 | **1,973** | 2,785 | **LOSING, direct +8.2%** |
| 28 Oct-1 Nov | 2,428 | 3,167 | 2,692 | 3,131 | thin, −9.8% |

A three-night measurement said one thing; the four-night measurement said the opposite, on the month
that matters most.

**The rule:** when a channel names a minimum longer than the probe, re-probe the window at that length
**on every channel including direct**, as a new cell. Length must move on all channels at once or the
totals are not comparable. `parity-next.ts` detects these and prints the escalation with the URLs
already built — work them before declaring a run finished.


**Probe SHORT first, then escalate.** The owner's rule is 2 nights, raised by hand on a few special
windows — the autumn school break, sometimes Christmas, always NYE — and he sets each raise
**separately on Airbnb, on Booking and on the direct site**. The short probe is the only thing that
reveals where those minimums actually sit: go straight to 5 nights on NYE and every channel answers,
teaching you nothing. So probe at the DIRECT minimum for the window (usually 2), let the channel
refuse, and escalate to the number it names.

`MIN_STAY_RE` in `src/lib/parity/minStay.ts` holds every phrasing, shared by the escalation here and
by the alignment report below so the two cannot drift. Airbnb says *"Minimum stay is 4 nights"*;
Booking says *"You need to stay 3+ nights to book your selected dates"*. Neither matched the original
regex, which is why the escalation went its whole life without once firing.

### 4.5b Report where the minimums DISAGREE — the owner asked for this by name

A mismatched minimum is invisible in every price comparison. It does not make anything look expensive;
it just refuses the booking. It is also not a pricing fault, so it never belongs in a rate
recommendation.

```bash
npx tsx scripts/min-stay-alignment.ts <slug>
```

It reports what each channel **did** — a refusal naming N is a stated requirement, a stay it sold is an
upper bound — never what it claims, and flags two kinds of clash:

- **channel stricter than direct** — the platform turns away a stay we would happily sell
- **the two platforms disagreeing with each other** — the one the owner most wants to know about

Live on 2026-08-31, both found by this report:

| window | direct | Airbnb | Booking |
|---|---|---|---|
| Vacanta Toamna (24 Oct - 1 Nov) | 2 | **refuses under 4** | sold 3 |
| Post-New Year (1 - 3 Jan) | 2 | **refuses under 3** | **refuses under 3** |

The first is a three-way split on his emptiest school-break week. The second means the direct site
sells a two-night New Year stay that neither platform will sell at all.

**The fix is on the channel, never on the direct price.** A minimum is a rule he set, so a mismatch is
a setting to correct. Report it and let him decide.

### 4.6 Record refusals eagerly

`refused` (a minimum stay we do not enforce), `unavailable` (the channel has no inventory) and `error`
are **outcomes**. Write them with a reason. A cell you skip silently is a cell you re-walk forever.

### 4.7 Pacing and stopping

- Batches of **10-15 cells with a check-in**, and a randomised 3-8s dwell between cells on top of the
  settle. Nothing bounds request volume on these sites; ~100 sequential parameterised loads from one
  residential session is exactly the pattern that attracts attention. Sentinels are the real answer —
  probe a handful often rather than everything rarely.
- **On the first CAPTCHA or bot check: STOP and tell the owner.** Do not work around it. Leave the
  remaining cells `missing`, not mass-`error`.
- After 2-3 consecutive tool failures, stop and report rather than hammering.
- Never trigger an `alert`/`confirm`/`prompt`. A modal blocks the extension for the rest of the
  session. Never a dialog — and never a Blob download either, they are site-blocked (§4.2).

### 4.8 What the two sites show

**Airbnb** — `https://www.airbnb.com/rooms/<id>?check_in=…&check_out=…&adults=N`
Read the `"… RON total"` line, any struck-through original, `"N nights in …"`, the date range and the
guest count, and whether `"This host is offering a discount"` is present.

> **The captured Airbnb number is NOT what a real guest pays.** This listing gives a standing **15%
> top-rated guests discount** that the owner considers almost universally qualifying, and it is
> invisible to any capture. `evaluateParity` applies it. **The extractor must not**, or it is deducted
> twice. Treat a capture as the anonymous list price and let the maths correct it.

**Booking.com** — `…?checkin=…&checkout=…&group_adults=N&group_children=M&age=10&age=4&no_rooms=1&selected_currency=RON`
Read `"Original price X Current price Y"`, record which rate plan it is (peak windows sell
non-refundable, a different product from a flexible direct booking), and flag `"Sign in to unlock the
members-only price"` — that capture is incomplete, not cheap.

> **NEVER take the lowest price on the page.** Booking renders **one rate row per occupancy** for the
> same stay, and the cheapest is for a SMALLER party. The 2026-09-04 page carried seven pairs: the
> requested 4 adults + 2 children at **2,216**, and below it rows for 5+1, 5, 4, **3 adults at 1,840**,
> and 3+2. "Cheapest on the page" banked the three-adult rate as the price for a family of six, made
> direct look 26% dearer than it was, and manufactured a September crisis that did not exist
> (2026-08-30). Each pair must be attributed to its **nearest preceding capacity marker** and rows too
> small for the party discarded — `extract.ts` does this; do not hand-read around it.
>
> The capacity marker is worded **two ways**, and matching only the first is what broke it:
> `Max persons: 4` on an adults-only search, `Max adults: 4 <br> Max children: 2` once the search
> includes a child. **If a page shows priced rows but no capacity marker at all, refuse the cell** —
> a filter that silently matches nothing is worse than no filter.
>
> **Min-stay refusals are prose, and the page still shows prices.** Booking says `"You need to stay 3+
> nights to book your selected dates"` and then lists priced **alternative dates** underneath. Those
> belong to other windows. Record the cell as `refused` and escalate per §4.5; never bank a number off
> that page.

**A price that FALLS when you add guests is a bug, not a finding.** Direct and Airbnb both charge more
for two extra children; if a channel charges less, the capture grabbed the wrong row. Check it before
reporting it — this is the cheapest available sanity test on the whole dataset.


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
5. **Minimum-stay alignment** — run `min-stay-alignment.ts` and report every clash, both
   channel-vs-direct and channel-vs-channel. Keep it SEPARATE from the price findings: a mismatched
   minimum is a setting to correct on the channel, not an argument for changing a rate.
6. **What could not be measured and why** — refusals with their reason, errors, channels with no
   listing URL. Never let an absence pass as a finding.
7. **Recommendations** — separating "change the promotion on channel X" from "change the direct price
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
- **Correct every captured Airbnb price before judging it.** The listing gives a standing **15%
  top-rated guests discount** (15% of the base room fee) that the owner treats as near-universal, like
  Booking's Genius, and no capture can see it. An uncorrected Airbnb figure is 12-16% too high, which
  is enough to turn a "losing" window into a "healthy" one. Applied across the 17 measured windows it
  moves direct from cheapest on 9 to losing-or-level on 12-13.
- **VRBO is out of scope** (owner, 2026-08-29). It was the cheapest channel in 1 of 20 measured
  windows, and that once only because Airbnb refused the dates on a minimum stay; its typical premium
  is +17% to +56%. Do not let its absence force every verdict to `partial`. **Reversal condition:** if
  VRBO is cheapest in more than one window of a run, it binds again — say so.
- **Genius off at Christmas and New Year is deliberate**, as is the whole-house flat rate on those
  dates and their non-refundable plans. Report them as facts; never as defects.
