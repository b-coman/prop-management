# OTA Price Parity — keeping the direct channel the best place to book

**Status:** design agreed 2026-08-07; slice 1 (skill + pack + economics) built. Slices 2–3 to build.
**Owner rule:** the direct site should be **5–10% under the best OTA offer** — but the real constraint
is net, not headline (§2).

**Related:** `docs/promotion-system-architecture.md` (the brain this feeds), memory `ota-price-parity`
(measured state, 2026-08-06).

---

## 0. Why this exists

On 2026-08-06 a live Meta campaign was driving paid traffic to the direct site. A hand check of ten
windows found:

- **two windows where direct cost the guest MORE than Airbnb** — Christmas (+22%) and Aug 28–30
  (+24%), the latter *inside the window the campaign was promoting*;
- only two of ten met the 10% rule;
- the cause was **promotions running on both OTAs** (11–28% off), invisible from inside the app.

Nothing in the system could have caught this. The ads arm happily promoted a window where Airbnb was
cheaper. That is the gap this closes.

## 1. The constraint that decides the architecture

Capturing OTA prices needs a **real browser**. On Airbnb and Booking.com the extension's `computer`,
`get_page_text` and `find` tools all time out — those pages never reach `document_idle`; only
`javascript_tool` gets through. Cloud Run has no browser, and a headless rebuild means Playwright plus
proxies plus fighting bot detection: brittle, and on the wrong side of both sites' terms.

Therefore:

> **Capture is episodic and happens where a human browser is (a Claude Code session).
> Evaluation is continuous and happens in the app.**

Every decision below follows from that split.

## 2. The economics — why "10% under" is the wrong single number

Commission never happens on a direct booking. Against ~2.9% card costs:

| Channel | Commission | Room to undercut before net is equal |
|---|---|---|
| Airbnb | 18.5% | **~16.1%** |
| Booking.com | 23% | **~20.7%** |

So a flat 10% is arbitrary in both directions — timid where commission is high, and potentially
loss-making against a deep promotion. `src/lib/growth/parityMath.ts` computes what actually matters:

- **`indifferencePrice`** — where owner net is identical either way. **The floor.**
- **`netAdvantage`** — what the owner gains at the current direct price.
- **`headroomPct`** — the structural advantage, independent of price.
- **Verdicts**: `losing` · `thin` · `healthy` · `overshoot` (the last = cheaper than necessary).

Worked example (real numbers, Aug 28–30): Airbnb guest total 1,476. Indifference is **1,239**. Price
direct at 1,402 (5% under) and the guest saves 74 lei while the owner keeps **~158 more** than the
Airbnb booking would have paid. Both sides win — which is the whole argument for the direct channel.

**Promotions are not obligations.** A promo is a deliberate, temporary act on that channel; chasing it
mechanically can wreck the direct rate year-round. So parity is reported against **both** the promo
price and the list price, and the recommendation distinguishes "fix the promo on that channel" from
"the direct price is wrong". When a target-sized discount would fall below indifference, the system
says so and recommends **not** matching.

## 3. Two rules, not one

- **R1 — margin.** `direct ≤ min(channels) × (1 − target)`. Against the **minimum**, never the
  average: Airbnb was cheapest in 3 of 4 cross-checked windows, and averaging would have hidden the
  Christmas failure.
- **R2 — channel spread.** `max/min − 1` across channels for the same nights. One measured case:
  Airbnb 1,476 vs Booking 1,907 — a **29% spread**. That is a channel-management problem: it drags
  down the floor direct must beat, and looks incoherent to a guest who checks twice. It is also
  entirely within the owner's control, which often makes it the more actionable of the two.

## 4. The probing strategy

### 4.1 Fetched facts, and two calendars

The windows that decide the year **move**: Orthodox Easter swings five weeks, the school calendar is
re-set by ministerial order annually (and the February break varies by county), and a holiday landing
on a Tuesday creates a bridge that doesn't exist the next year.

They are therefore **fetched, never computed** — the doctrine already established by
`scripts/seed-holidays.ts`, which records a source URL and an `official` flag per row: *"deriving
either in code is how you poison every downstream occasion decision."* This was proven during the
build: a computed version got **every school break wrong** (autumn Oct 30–Nov 8 vs the official
Oct 24–Nov 1; winter Dec 20–Jan 8 vs Dec 23–Jan 10) and invented a fixed February ski week where the
official row says one week is chosen per county from a three-week window.

The probe list is the **union of two calendars**, which are not the same set:

| Source | Answers | |
|---|---|---|
| `holidays` (seeded, official) | *Why* people travel | `major` / `school-break` / `bridge-day` used; `minor` deliberately skipped. Same source the situation pack reads, so parity and the brain agree on what a period is. |
| `dateOverrides` (own pricing) | What the owner charges a premium for | Clustered by `reason` + adjacency so Christmas ≠ New Year. |

**Both are needed.** New Year's Eve (30–31 Dec) is the property's highest rate of the year — 2,351/night,
min-stay 3 — and is *not* a public holiday. It exists only in `dateOverrides`. Probing the legal
calendar alone would skip the single most valuable window of the year.

When the seeded data runs out the pack reports `holidayData.stale` plus the coverage end date, so an
un-probed period never reads as "nothing found".

### 4.2 Horizon and cadence

**6–8 months ahead** (default 8): far enough that peak pricing is still changeable and OTA promos are
visible before they do damage; near enough that the calendar is real. **Re-run every 4–6 weeks** —
peaks stay stable so runs are comparable, while ordinary-weekend samples **rotate deterministically**
so coverage broadens instead of re-measuring one weekend forever. Periods beyond the horizon simply
arrive in a later run.

### 4.3 The coverage matrix

Three dimensions, sampled rather than exhausted:

| Period type | Why | Shape |
|---|---|---|
| Peaks (Christmas, New Year, Easter, Rusalii) | Highest rate; Christmas was found +22% *dearer* than Airbnb | Natural length, **both occupancies** |
| Bridged holidays (`punte`) | Exist only in some years; high demand | Natural bridge |
| School breaks | Families travel — **midweek becomes sellable** | Midweek + full week |
| Ordinary weekends | Baseline volume; one per uncovered month | 2 nights, rotated |
| Advertised windows (`adCampaigns`) | Losing here costs twice: click and commission | Campaign dates |

**Length class** — `short` / `mid` / `long`, at least one of each guaranteed, and deliberately probed
on both sides of the LoS tier. That is how "7 nights costs 669 lei *less* than 6" surfaced.

**Occupancy** — `baseOccupancy` always, `maxGuests` on every peak and flat-rate window. Not optional:
`flatRate: true` makes extra guests free while OTAs charge per guest, so the same NYE week reads
**−8.7%** at 3 guests and **−20%** at 6.

Practical guards: the run is capped (`--max`, default 24) and drops lower-priority rows first while
reporting how many; partly-booked periods slide to the first sellable window inside them; a window
reached from two directions keeps the higher-signal label (ADVERTISED beats "summer break").

**Sentinels (slice 2):** probe a handful often, the long tail rarely. When a sentinel moves, a promo
changed — trigger a wider sweep. Coverage without volume.

## 5. Observations calibrate a model; the model does the watching

Fresh OTA prices are not needed to know there is a problem. Each observation teaches the *relationship*
between a channel's guest total and ours for that window shape. Fit a small per-channel model from
those, and the app can then watch **continuously and for free**: change a season, add an override, or
tip a LoS tier, and it recomputes predicted parity across the whole calendar and says *"Christmas is
now 22% above predicted Airbnb — go re-measure."*

Scraping stops being the monitoring mechanism and becomes the **calibration** mechanism: rare, cheap,
honest.

## 6. Honesty rules (where systems like this rot)

- Every observation stores `capturedAt`, channel, login state, promo-banner presence, **both** the
  struck-through original and the current price, and the exact URL.
- A stale or failed probe is **`unknown`**, never `pass`. A dashboard that reads green because a
  capture broke is worse than no dashboard.
- Confidence decays with age — a 40-day-old Christmas observation is a hypothesis.
- Record promo state explicitly: the entire root cause was promotions nobody was tracking, and a
  system that stores only the final number cannot explain *why*.
- Read-only, always. Never sign in, never complete a reservation. On a CAPTCHA, stop and report.

## 7. Where it plugs in

1. **Situation pack** → the analyst can raise *"you are advertising Aug 23–Sep 7, and Aug 28–30 is 24%
   cheaper on Airbnb"* as a flag with money attached — the exact mistake the system could not see.
2. **Ads guard** → `validateAdPlan` already enforces spend cap and geo. Add a parity check so the
   system refuses to promote, or loudly warns about, a window an OTA undercuts. Paying for traffic to
   your dearer channel is a bug worth encoding as one.

## 8. The closed loop — why a run cannot be silently partial

The first run of this system produced a table with holes in it, hand-assembled from numbers that were
read off pages and retyped. Nothing was lying, but the gaps were invisible: an uncaptured cell simply
had no row, so the reader saw a tidy grid and reasonably took it for the whole picture. Two rows even
mixed capture dates a day apart, because nothing carried a timestamp.

The fix is that **the unit of work is a cell**, not a window: one `(window × occupancy × channel)`,
with a stable id (`propertyId|checkIn|checkOut|guests|channel`). Every cell is owed an outcome.

| Piece | Role |
|---|---|
| `src/lib/growth/parityWorklist.ts` | Cell ids, `buildWorklist`, `computeCoverage`, `outstandingCells`. Pure, 13 tests. |
| `src/services/growth/parityObservations.ts` | Append-only writes to `channelPriceObservations`; newest-per-cell reads. |
| `scripts/parity-pack.ts` | Builds probes, quotes direct, **records the direct cells itself**, prints coverage + outstanding. |
| `scripts/parity-capture.ts` | The single write path for a browser capture. |
| `scripts/parity-report.ts` | Renders the table **from the store**. |

Enforced properties:

- A cell with no observation prints **`?`**, counts as `missing`, and appears in the outstanding list.
- A channel refusing to quote (Airbnb's 4-night minimum on 26–29 Oct) is a **recorded outcome with a
  reason** — `parity-capture.ts` rejects a non-`captured` status that has no reason.
- An **errored** capture blocks `complete`; it is unfinished work, not an answer.
- Observations older than the freshness budget are **stale** and re-queued, so a 4–6 week cadence
  never quietly reports last quarter's prices.
- `complete` requires *nothing missing, nothing errored, nothing stale*. Anything else prints
  `STATUS: INCOMPLETE — do NOT treat this table as the whole picture.`
- Append-only storage means re-running a cell **adds** a data point. Cell ids are stable across runs,
  so the cadence produces drift history rather than disconnected snapshots.
- Direct prices are recorded with `source: 'api'` — provenance matters, because the engine's number is
  not automatically what a browser renders (this site once showed `US$401` where the engine said
  `1,838 lei`).

## 9. Build order

- **Slice 1 — on-demand skill. ✅ BUILT.** `parityMath.ts` (14 tests), `parityWorklist.ts` (13 tests),
  `parityObservations.ts`, the three CLIs, `channelPriceObservations` + rules, and the skill.
- **Slice 2 — the evaluator in-app.** `channelPricing` persisted per property (rates are currently
  documented defaults); the fitted per-channel model; R1/R2 recomputed continuously against the live
  calendar; a `/admin` surface showing coverage and staleness. Sentinels here.
- **Slice 3 — the two integrations** in §7.

The model cannot be fitted before there are observations to fit it to — which is exactly what slice 1
now produces, durably.

## 9. Open judgement calls

- **Per-channel targets rather than one global number.** Beating Booking by 10% is cheap (it is rarely
  the floor); beating Airbnb by 10% during a 28% promo may be impossible without destroying margin.
- **Persist `property.channelPricing`.** Commission rates are currently documented defaults
  (18.5% / 23% / 2.9%) and the pack says so. Until persisted, every report carries that caveat.
- **The flat-rate group cliff is an unexploited asset.** For six guests at NYE, direct is 20–26%
  cheaper than the OTAs, and nothing on the site says so. That is a marketing decision, not a pricing
  bug — but it is worth deciding deliberately, because the same flag means a 7-person holiday booking
  earns no more than a 3-person one.
