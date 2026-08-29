# The Pricing & Parity Engine

**Status:** design, 2026-08-29. Supersedes nothing; it completes `docs/ota-parity-system.md`
(slices 2-3) and `docs/pricing-organ-architecture.md` (steps 4-5), which are both correct and
both stop exactly where the hard part starts.

**Audience:** the owner, and any agent executing a phase of the plan in §8.

---

## 0. The owner's decisions, which bind this design

These are settled. Do not re-open them; a phase that violates one is wrong by construction.

| # | Decision | Consequence for the design |
|---|---|---|
| D1 | **Airbnb's base prices are not going up.** | The engine measures and reports the Airbnb line. It never recommends raising it. `rate-sheet --decompose` output stays a reference line, not a defect. |
| D2 | **Any correction happens on the direct price**, downward. | The **floor** (`indifferencePrice`) is the engine's most important single output. Everything must make it impossible to cut past it by accident. |
| D3 | **Nothing changes until the engine exists and has accumulated data.** | Phases A-C measure only. No phase before D proposes a price, and D1b must resolve first. |
| D4 | **Competitor tracking is wanted, later.** | Build the *extension point* now (one field, §6), the feature later. |
| D5 | The holiday and school calendars are **fetched facts**, never derived. | Already true: `holidays` has 27 sourced rows covering 2026 **and 2027**. |
| **D6** | **Booking benchmark: capture logged in as a Genius member. Largely RESOLVED - see §3.4.** | The owner's account is Genius L3, but **his property only participates at Level 1**, so an L3 account sees the L1 discount and nothing deeper. Confirmed in the data: Genius contributes ~9% of total (his note: "11% pre-tax = 9% of total"), which is L1. So capturing as L3 does **not** skew the benchmark. The residual uncertainty is that Booking applies the discount at its own discretion - it is not a constant, so it must be **measured, never assumed**. |
| **D7** | **Genius is switched OFF on Christmas and NYE, deliberately.** Those dates also sell non-refundable, at one whole-house price regardless of party size. | A settled revenue choice on the highest-demand dates, in the same category as the holiday flat rate. **Never report it as a defect, a misconfiguration, or a parity failure.** The system's job is to know it and account for it. |
| **D8** | **VRBO is out of scope for now** (1-2 bookings ever, both US). | No parser, no blocking. Data supports it: cheapest in 1 of 20 windows, and only because Airbnb refused those dates. Reversal condition written into §5.4. |

A note on D1 that is a finding, not a re-argument: what makes Airbnb read cheapest is only partly its
base price. A large part appears to be the **length-of-stay discount ladder** on the Airbnb side,
which is a separate dial from the base rate D1 fixes. §3.2 is explicit that the evidence for that
ladder is thin, so this is a hypothesis worth measuring, not a conclusion. This document does not
recommend changing anything. It makes the dial visible, because a decision taken without seeing it is
not really a decision.

---

## 1. The problem, stated once

You have a **measurement ritual**, not an engine. Everything that exists requires you to be present
and driving it. That is why it has run three times, ever.

Evidence, from the live store:

- **199 observations, captured on exactly three days**: 7, 8 and 17 August 2026. Nothing since.
- **108 distinct cells across 26 windows.** A full run is ~160 cells.
- Current coverage: **97 captured, 9 refused, 52 MISSING, 68% resolved, oldest 21 days.**
  `parity-report.ts` prints `STATUS: INCOMPLETE` and has done since the day it was built.
- **29 distinct free-text `sessionState` values**, including `logged out, RON` (18) and
  `logged out, USD` alongside `LOGGED IN, Genius L3 APPLIED`. The report itself opens with
  `!! MIXED OR UNLABELLED CAPTURES - these numbers are not comparable to each other`.

A full run costs roughly 100 browser page-loads at 25-45s each, every number read by eye and
retyped into a CLI. That is 45-80 minutes of undivided attention, and it must be repeated every
4-6 weeks forever. No one sustains that. The decay is structural, not a discipline failure.

---

## 2. What already exists (verified, 2026-08-29)

More than expected. The gap is narrower and differently shaped than it looks.

### 2.1 Built and working

| Piece | Where | State |
|---|---|---|
| Parity economics (indifference, net advantage, headroom, 4 verdicts) | `src/lib/growth/parityMath.ts` | 14 tests |
| Cells, coverage, staleness, outstanding | `src/lib/growth/parityWorklist.ts` | 13 tests |
| Append-only observation store | `src/services/growth/parityObservations.ts` + `channelPriceObservations` | 199 docs |
| Probe derivation (holidays, overrides, LoS tiers, occupancy, availability, min-stay, **advertised windows**) | `scripts/parity-pack.ts` | 530 lines; auto-quotes and records direct |
| Single write path | `scripts/parity-capture.ts` | one cell per invocation |
| Report from store | `scripts/parity-report.ts` | refuses to hide `?` cells |
| Channel vocabulary + economics | `src/lib/channels.ts`, `channels` collection | Airbnb 18.755%, Booking 23%, cards 2.9%, target 10% |
| Periods + compiler + identity proof | `pricingPeriods`, `scripts/periods.ts`, `verify-period-identity.ts` | 18 periods |
| Rate sheet + push state machine | `src/services/rateSheetService.ts`, `src/lib/pricing/rateSheet.ts` | code complete |
| **Anchor pricing model** | `src/lib/pricing/anchorPricing.ts` | **your spreadsheet, in code** |
| **Channels admin tab** | `/admin/pricing` → `channels-card.tsx` + `rate-sheet-editor.tsx` | **renders today** |
| Official holiday + school calendar | `holidays` collection | 2026 (13) + 2027 (14), sourced |

`anchorPricing.ts` deserves emphasis. It encodes your actual model, in your actual direction:

```
airbnb  = airbnb_base × tier × 1.10
booking = airbnb_base × tier × 1.33
vrbo    = airbnb ÷ 4.5      (USD)
website = a bit under the cheapest of them
```

with a `directDiscountPct` field that is your 10% rule. The editor recalculates live in the browser
as you type, deliberately, because "a tool that needs a command line to answer *what if the base were
500* is worse than the spreadsheet it replaces."

### 2.2 Built but never switched on

- **`pricingAnchors`: 0 documents.** The rate sheet has never been saved. It renders defaults
  labelled unsaved. **The annual price-setting tool you asked for is ~80% built and unconfigured.**
- **`rateSheets`: 0 documents. `channelPushes`: 0 documents.** The push state machine
  (`pending → applied → verified → drifted`) has never held a row.

### 2.3 Not built

- The fitted model that predicts OTA prices without scraping (`ota-parity-system.md` §5, slice 2).
- Sentinels.
- Any automation of capture. **There is zero page-parsing code in the repository.** Every OTA
  number to date was read by a human eye.
- The `pricing` section of the situation pack; the ads parity guard (`pricing-organ` §4).
- Anything about competitors. Entirely greenfield.

---

## 3. The six findings that shape the architecture

### 3.1 The keystone: list prices and guest prices are two different worlds, and nothing joins them

- The **rate sheet** reasons about **list prices** - the number you type into a dashboard.
- The **parity observations** measure **guest prices** - the number a guest actually pays.

`periodsWhereDirectIsNotCheapest` (`anchorPricing.ts:175`) compares *list* prices only. It will
report that direct is cheapest while Airbnb is in fact cheaper to the guest. The two halves of your
system disagree, silently, and each is internally consistent.

**Worked example, from one real booking** (Booking.com 6603646057, 11-13 Sept 2026, Fri-Sun,
2 nights, 5 adults + 2 children). Both September weekends price identically direct - 914.25/night at
7 guests - so this is an exact comparison, not an approximation:

| | Booking.com | Direct |
|---|---|---|
| **nightly rate (7 guests)** | 832.00 | **914.25** ← direct is **+9.9% MORE** per night |
| fees on top | **400** (environment 100 + linens 50 + cleaning 250) | **200** (cleaning only) |
| **guest pays** | **2,064.00** | **2,028.00** ← direct is **-1.74% CHEAPER** |
| **owner receives** | 1,588.87 | **1,969.19** ← direct earns **+380.32 (+23.9%)** |

**The two views disagree by nearly twelve percentage points on the same stay**, and neither is wrong:
the rate sheet compares nightlies and correctly says direct is dearer; the guest compares totals and
correctly sees direct as cheaper. The whole difference is the fee stack, which the rate sheet does not
model at all. A system that watches only one of these numbers is blind to the other.

It also shows why the direct channel is worth defending. On this booking the guest would have saved
1.7% and **the owner would have earned 380 lei more**. And the floor is a long way down:

```
indifference price (direct)   1,636.32   <- below this, letting Booking have it earns more
current direct                2,028.00   19.3% of headroom unused
10%-under-Booking target      1,857.60   -> still nets 1,803.73, i.e. +214.86 vs the Booking booking
```

So a full 10% guest-facing discount on this window is not only affordable, it clears the floor by a
wide margin. That is the number the owner has never been able to see, and producing it reliably is
what this engine is for.

**One caution the example itself teaches:** the balance moves with length of stay. Booking's
environment fee is per-night while its linen and cleaning fees are per-stay, and direct's length-of-stay
discounts do not start until 3 nights and reach 25% at 7. The ranking on a 2-night stay tells you
nothing about a 7-night one. This must be computed per window, never reasoned about from a rule of
thumb - which is precisely the failure mode the current spreadsheet has.

**The bridge between them is the discount depth.** That is the whole design:

```
guestTotal(channel, window) = listTotal(channel, window) × (1 − depth(channel, shape))
listTotal(channel, window)  = anchorRateSheet(channel, period, dow) × nights + cleaningFee
```

You already know `listTotal` - you set it. Observations measure `guestTotal`. Their ratio *is*
`depth`. Calibrate `depth` from observations, and `guestTotal` becomes predictable for every window
in the calendar without opening a browser.

That single equation converts scraping from the monitoring mechanism into the **calibration**
mechanism, which is what `ota-parity-system.md` §5 called for and never got.

### 3.2 The discount depth looks structured, but the evidence is far thinner than it appears

Fitted from the 199 observations (holiday = 2026-11-27 to 2027-01-05):

**Airbnb - what looks like a length-of-stay ladder:**

| nights | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|
| mean depth | 11.1% | 15.0-16.0% | 17.2-20.1% | 22.1% | 25.5% | 29.6% |
| **n** | **1** | 10 | 3 | 7 | **1** | **1** |

**Booking.com - bimodal on holiday, length-independent:** holiday 7.4% (n=18), normal 19.5% (n=9).
**But see §3.4: that split is really Genius-applied vs not, and the aggregate hides it.**

**Every Airbnb observation carries an active discount.** That much is solid: it is the standing
state, not a promotion. Everything else on this table needs heavy qualification, and the first
version of this document did not give it:

- **Half the Airbnb ladder is a single observation.** The 2, 6 and 7-night cells are n=1 each. The
  "ladder" is 23 usable points spread over 6 night-counts x 2 holiday states x 2 session states.
- **Session is confounded with holiday.** 12 of 16 Airbnb holiday captures are logged OUT; the normal
  ones are mostly logged IN. So "the holiday flag does almost nothing" is concluded from a comparison
  where the session flips along with the flag. Within the 3-night normal bucket: logged-in mean 11.7%,
  the single logged-out point 24.6%.
- **Nights is confounded with holiday** - holiday windows skew long - so the ladder and the holiday
  effect are not separable at these counts.
- **Within-bucket spread exceeds the system's own tolerances.** 5n-holiday ranges 16.8-23.3%; Booking
  normal ranges 9.1-24.8%. On a 5,000 RON window, 3 points of depth error is 150 RON - the same order
  as the entire 10% positioning decision, and 5x the 3% push-verification tolerance.
- **There is zero temporal replication.** All 199 observations come from 3 days inside an 11-day span.
  The property the whole design depends on - *that depth is stable over time* - has never been
  observed even twice at an interval.
- **The signature is wrong.** `depth(channel, nights, isHoliday)` omits session and guests, yet
  `parity-report.ts:128` declares mixed sessions incomparable and `parity-pack.ts:202` records that
  occupancy moves the gap by 12+ points. The probe generator contradicts the model.

**Conclusion, revised:** the structure is a promising hypothesis, not a fitted model. It is enough to
justify *collecting* toward a model. It is nowhere near enough to *replace* measurement, which is why
the plan in §8 no longer asks it to. Fitting is gated on §8 Phase E.

### 3.3 The leg that ties the sheet to reality is broken three ways

`verifyPushesFromObservations` is the only mechanism that could ever notice "the owner retyped a price
and did not record it". It cannot work today:

1. **It skips everything.** It requires `channels.{id}.cleaningFee`, and **no channel document has
   one** (verified: all 5 docs). Every push is skipped. Populating those fees appeared in no phase.
2. **It can never verify Airbnb.** It reduces a guest total to `(guestTotal − cleaningFee)/nights`
   and compares to the typed list nightly at a **3% tolerance**. Per §3.2, every Airbnb guest total
   embeds an 11-30% standing discount. A perfectly typed Airbnb price reads `drifted`, always. A 3%
   tolerance cannot absorb an error ten times its size.
3. **It ignores guests and weekday/weekend composition.** It takes the nearest observation in the
   period regardless of occupancy or weekend mix, and the weekday/weekend bases differ by ~32%.

The consequence for drift detection is the important part: an observation whose implied depth moved
**cannot be attributed**. "The OTA changed its discounting" and "the owner retyped a price" produce an
identical signal. The predictable human response to cry-wolf alerts is to widen the tolerance until it
means nothing. Verification must compare against a **predicted guest total**, not a raw list nightly -
which means honest push verification depends on the model, and until then Airbnb verification must be
declared unreliable rather than shown as `drifted`.

---

### 3.4 Booking's guest price is three things, two of which the owner sets deliberately

On windows captured **both** logged in and logged out:

| window | logged out | logged in (L3) | Genius delta |
|---|---|---|---|
| 2026-11-27 5n 3g | 3836 (6.2%) | **3475 (15.0%)** | **-9.4%** |
| 2026-12-24 5n 3g | 6010 (6.5%) | 6010 (6.5%) | none |
| 2026-12-30 3n 3g | 7243 (6.7%) | 7243 (6.7%) | none |
| 2027-01-01 4n 3g | 3769 (6.2%) | 3769 (6.2%) | none |

The owner's account is Genius L3, but **his property participates only at Level 1**, so an L3 account
sees the L1 discount and nothing deeper. Genius contributes ~9% of total (his note: "11% pre-tax = 9%
of total"), which is L1. Capturing as L3 therefore does **not** skew the benchmark.

**And Genius is off on Christmas and New Year because the owner switched it off** (2026-08-29):
*"for Christmas and NYE I disabled the Genius myself. This is high demand and I don't want the
discount."* That is a deliberate revenue choice on the highest-demand dates of the year. It is **not**
a Booking quirk to be modelled as an unknown, and it must never be flagged as a defect - it belongs
with the holiday flat rate in the same category of settled decisions.

**The residual ~6.2-6.7% on those windows is not a discount at all - it is a different product.**
Those dates are sold **non-refundable** on Booking, and the captures recorded two plans side by side
(`"2 plans: 5330 / 6756"`, `"non-refundable 6010 (7% off) vs fully-refundable 7606"`). So `listTotal`
is the *flexible* plan and `guestTotal` is the *non-refundable* one. Treating that ratio as "discount
depth" would be modelling a cancellation policy as a promotion.

**Consequences, and they are structural:**

1. **The model needs a `ratePlan` dimension**, captured per observation. A non-refundable Booking
   price and a fully-flexible direct price are not the same offer, and a guest comparing them knows
   it. Any parity verdict that ignores the plan is comparing two different products.
2. **`programApplied` is partly configuration, not observation.** Whether Genius applies to a window
   is something the owner controls and the system can record as a known fact, not merely infer.
3. **Occupancy is irrelevant on those windows by design.** Booking sells the whole house at one price
   regardless of party size, matching the owner's own flat-rate holiday override. A parity check that
   probes 3g and 6g there is measuring the same product twice, correctly, and should say so rather
   than reporting a "6-guest advantage".
4. The benchmark question (D6) is settled for Booking: **capture as a Genius member**, and record
   which plan was read.

---

### 3.4b The anchor is not stable, which is the biggest single constraint on the model

Owner, 2026-08-29: *"time to time I make adjustments on Airbnb based on their pricing tips. They
propose adjusting the prices and I do that... So the Airbnb prices are not fixed, sometimes I adjust
them."*

This is the finding that most limits what §4.2 can promise. The prediction chain is
`guestTotal = listTotal x (1 - depth)`, and it assumed `listTotal` could be read off the rate sheet -
i.e. from what the owner intended to type. If he accepts Airbnb's suggestions between runs, then:

- **The sheet cannot predict the list price.** It records an intention that reality has moved past.
- **`drifted` becomes the normal state, not an alarm.** A push-verification design that treats drift
  as exceptional will cry wolf until someone widens the tolerance to meaninglessness.
- **Therefore the model can interpolate `depth` but NOT `listTotal`.** Depth is a discount ladder and
  behaves like one. The list price is an editorial decision taken periodically by a human acting on
  Airbnb's prompts, and nothing in this system can forecast it.

**So the honest reach of Phase F is much smaller than the first draft claimed:** predictions are
sound only for windows where a **recent captured `listTotal`** exists. That is close to saying
"windows we already measured", which is precisely why §8 puts measurement first and treats the model
as a coverage extender rather than a replacement for looking.

**This is not hypothetical - the corpus caught it happening.** Four Airbnb cells were captured on
both 7 and 8 August, and the **list** price moved overnight:

| window | 7 Aug | 8 Aug | move |
|---|---|---|---|
| 2026-12-24 5n 3g | 5603 | 5900 | **+5.3%** |
| 2026-11-27 5n 3g | 3783 | 3980 | **+5.2%** |
| 2026-12-24 5n 6g | 6920 | 7235 | **+4.6%** |
| 2026-12-30 3n 6g | 8168 | 8480 | **+3.8%** |

That is the week the owner repriced under Airbnb's new fee model, so the corpus **straddles a pricing
change**. Fitting depth across 7 August and 17 August captures mixes two regimes. (Caveat: the two
captures also differ in session state, so the move is not cleanly attributable from this data alone -
but a list price should not move with login, which is itself why it is worth flagging.)

The upside: every capture already records `listTotal` (the struck-through original). **The capture is
the anchor.** Phase D's anchor config should therefore be seeded from *observed live list prices*,
not transcribed from a spreadsheet - see §8 Phase D1.

---

### 3.4c Both take rates are now measured, and two things nobody had modelled turned up

**Airbnb, confirmed exactly** (reservation `lrw6gDv5cGDghi77gD1z`, Daniel Ion, 24-29 Aug 2026,
5 nights, 5 guests; owner-supplied host earnings screens, 2026-08-29):

| You earn | RON | | Guest paid | RON |
|---|---|---|---|---|
| 5 nights room fee | 4,394.00 | | 656.46 x 5 nights | 3,282.32 |
| ...incl. extra guest fee | 890.00 | | Cleaning fee | 296.00 |
| ...incl. community fee | 30.00 | | **Guest service fee** | **0.00** |
| Cleaning fee | 296.00 | | **Total** | **3,578.32** |
| Nightly rate adjustment (custom promotion) | -590.58 | | | |
| **Top-rated guests discount** | **-521.10** | | | |
| **Host service fee (15.5% + VAT)** | **-671.11** | | | |
| **Total** | **2,907.21** | | | |

```
gross before the host fee      3,578.32   ==  guest paid, exactly: the fee is charged on the guest total
3,578.32 x 15.5% x 1.21 VAT  =   671.11   ==  the screenshot, to the leu
effective take  1 - 2907.21/3578.32       =  18.755%   ==  configured commissionPct, to 3 decimals
```

So **Airbnb 18.755% and Booking 23.02% are both measured facts now**, not arithmetic. And the guest
service fee line reading **0.00** is the direct confirmation that this listing is on the host-only
model, so `guestFeePct = 0` is right. Both floors are on solid ground.

**Surprise 1: there are THREE different fee stacks, and no two match.**

| | Direct | Booking.com | Airbnb |
|---|---|---|---|
| cleaning | **200** | **250** | **296** |
| per-night extra | - | environment 50/night | - |
| per-stay extra | - | bed linens 50 | community fee 30 |
| extra-guest | 75/guest above 3 | none seen at 7 guests | **yes** (890 on this booking) |

A guest comparing the same stay across three channels is comparing three different products, and the
cleaning fee alone spans 200-296. Any comparison must be on **guest-facing totals**; a nightly-rate
comparison is meaningless across these. (This is §3.1's worked example restated from the other side.)

**Surprise 2: a ~15% standing discount that no capture can see, and it changes most verdicts.**

The **Top-rated guests discount of -521.10** is not a per-window setting. The owner's account
(2026-08-29): *"This 15% discount is a discount that Airbnb told would be good to give to the guests
that qualify, and they are active members. It's something similar to Genius from Booking in my
opinion. So I pay it, so I have to treat it like that. I think that almost all guests will qualify,
like almost all from Booking qualify."*

**That reframing is decisive**, and the structure turns out to be exactly deterministic. Both Airbnb
discounts are flat percentages of the **base nightly room fee** (661+661+660+660+832 = 3,474),
additive on the same base:

```
custom promotion       3,474 x 17%  =  590.58   (screenshot: 590.58)
top-rated guests       3,474 x 15%  =  521.10   (screenshot: 521.10)
```

and the whole guest total reconstructs to the leu:

```
base room fee 3,474 + extra guest 890 (2 guests x 89/night) + community 30 + cleaning 296 = 4,690
              - 590.58 (promo 17%) - 521.10 (top-rated 15%)              =  3,578.32  ✓
```

**An anonymous capture sees 4,099.42. A qualifying guest pays 3,578.32** - the captured price is high
by **12.7% to 16.2%** depending on how much of the total is fees (fees dilute a discount taken on the
room fee alone; a 3-guest booking with no extra-guest fee sits at the high end).

**Applied to the 17 windows where both direct and Airbnb were captured, this flips most of them:**

| Airbnb correction | losing / level | thin | healthy |
|---|---|---|---|
| **none (as captured)** | **3** | 5 | **9** |
| -12.7% (conservative end) | **12** | 1 | 4 |
| -15.0% (midpoint) | **13** | 1 | 3 |
| -16.2% (aggressive end) | **13** | 2 | 2 |

**The conclusion is robust across the entire plausible range**: direct goes from cheapest on 9 of 17
windows to losing or level on 12-13 of 17. Individual flips include 14-18 Sept (-1.5% -> **+15.9%**),
22-29 Sept (-7.6% -> **+8.7%**) and 27 Nov-2 Dec (-7.5% -> **+8.9%**).

Three consequences, and none of them is comfortable:

1. **Every parity figure produced before 2026-08-29 was systematically optimistic**, including the
   2026-08-17 repricing's headline result of "losing 16/21 -> 2/17". That result was measured against
   uncorrected Airbnb prices and does not survive this correction.
2. **It compounds the advertising finding.** Paid traffic was being sent to the direct site on windows
   where Airbnb was in fact the cheaper place to book, more often than the captured data suggested.
3. **But it is good news for the model.** This is not an unobservable guest-identity effect - it is a
   **known standing setting the owner controls**, deterministic at 15% of the base room fee, exactly
   like Booking's Visibility Booster sits inside the 23.02% take. It can be applied in the maths
   rather than measured.

**Design requirement:** `channels.airbnb` needs a `standingGuestDiscountPct` (15%, applied to the base
room fee, not the total), and `evaluateParity` must apply it to every captured Airbnb price before
judging. A capture is the *list* price for an anonymous browser; the *benchmark* is what a qualifying
guest pays. Record it as configuration, re-derive it when the owner changes the promotion, and treat
the Dec 24-25 three-guest rows as expected-by-design (D7) rather than as failures.

---

### 3.4d A min-stay refusal loses the window unless it is escalated on every channel

Found 2026-08-29, on the window that matters most. Airbnb refused 3 nights on the autumn school break
(its minimum there is 4). That refusal was recorded and the run moved on — so the owner's emptiest
month was measured **on Booking alone**, and read as *"direct 22% cheaper, but below the floor"*.

Re-probed at 4 nights across all three channels, the answer reversed:

| window (4n, 3g) | direct | Airbnb | Airbnb −15% | Booking | verdict |
|---|---|---|---|---|---|
| 24-28 Oct | 2,281 | 2,369 | **2,014** | 2,965 | **LOSING, direct +13.3%** |
| 25-29 Oct | 2,134 | 2,321 | **1,973** | 2,785 | **LOSING, direct +8.2%** |
| 28 Oct-1 Nov | 2,428 | 3,167 | 2,692 | 3,131 | thin, −9.8% |

**The rule, now enforced in `parity-next.ts` and written into the skill:** when a channel names a
minimum longer than the probe, re-probe the window at that length **on every channel including
direct**, as a new cell. Length must move on all channels together or the totals are not comparable.
A partial measurement here did not merely lose precision — it pointed the opposite way.

---

### 3.5 Capture cannot be a script, and the repo already decided this

Three independent reasons, all verified:

1. **Technical.** `computer` screenshots, `get_page_text` and `find` all **time out** on Airbnb and
   Booking - those pages never reach `document_idle`. Only `javascript_tool` gets through, and a
   `tsx` script cannot call an MCP browser tool.
2. **Doctrinal.** Already rejected in `ota-parity-system.md:29`: *"a headless rebuild means Playwright
   plus proxies plus fighting bot detection: brittle, and on the wrong side of both sites' terms."*
3. **Economic.** Prices must be captured **logged in**. Most Booking traffic is Genius and most
   Airbnb traffic carries a member discount; a logged-out capture systematically overstates every
   OTA. That forces your real Chrome profile.

The standing architecture decision (`ota-parity-system.md:34`) is right and this design keeps it:

> **Capture is episodic and happens where a human browser is. Evaluation is continuous and happens in the app.**

---

### 3.6 There are two live pricing models, pointing in opposite directions, and they disagree

This is the most consequential thing found in the audit, and it must be resolved before any
modelling work (§8 Phase D2), because a model fitted against one basis and typed into the other is worthless.

| | **Direct-anchored** | **Airbnb-anchored** |
|---|---|---|
| Code | `rateSheet.ts`, `rateSheetService.ts`, `scripts/rate-sheet.ts` | `anchorPricing.ts`, `anchorConfigService.ts`, `rate-sheet-editor.tsx` |
| Direction | direct is the anchor; channels derived by `grossUpFactor` | **Airbnb is the anchor**; direct = cheapest × (1 − `directDiscountPct`) |
| Base | `property.pricePerNight` = **525** | `weekdayPrice` = **475** / `weekendPrice` = 625 |
| Collection | `channels` | `pricingAnchors` (**empty**) |
| Free parameter | `extraAdjustmentPct` | `factor` (1.10 / 1.33) |
| FX convention | `fxRateToChannelCurrency`, **divides** | `fxDivisor`, divides |
| Produces `channelPushes`? | **yes** | no |
| Reachable from the admin UI? | no | **yes** |

So: the half that can track what you typed has no UI, and the half with a UI cannot track anything.
`generateRateSheet` has exactly one caller in the entire repo - `scripts/rate-sheet.ts:124`.

`anchorPricing.ts`'s own header says the direct-anchored version "got the direction wrong" and that
your spreadsheet has worked Airbnb-outward for five years. That is the tie-breaker, and it also fits
D1: if Airbnb's base is fixed, it is the anchor by definition.

**Decision required (§8 Phase D2): adopt the Airbnb-anchored model as the single basis, and make the
push/verify machinery serve it** rather than maintaining two. Note this is a *representation*
decision, not a pricing one - it changes which number the system treats as given, not any live price.

---

## 4. Architecture

Three jobs are currently fused into one ritual. Separating them is the whole fix.

```
  L1  MEASURE          episodic · agent-driven · owner's Chrome · ~45-80 min, every 4-6 weeks
      parity-next  →  browser loop  →  parity-capture --rows  →  channelPriceObservations
                                                              →  channelPriceImports (raw text)
                              │
                              ▼  calibrates
  L2  MODEL            nightly · in-app · free
      observations + anchor rate sheet  →  discountModel  →  parityPredictions (whole calendar)
                              │
                              ▼  surfaces
  L3  DECIDE           continuous
      /admin/pricing Channels tab · situation pack `pricing` · ads guard · sentinel work-list
```

**L1 and L3 are the system. L2 is an upgrade to it.** Phases A-D build a working parity system whose
watchdog is the L3 sentinel loop over *measured* cells. L2 is deferred to Phase F and gated on Phase E,
because §3.2 shows the corpus cannot support a fit today. Read the diagram in that order: a design
that needs L2 to be honest would be a design that lies whenever the model is wrong.

### 4.1 L1 - Measure

An **agent-driven skill loop with deterministic script endpoints**, in the exact three-layer shape
proven by `whatsapp-backfill`: a CLI emits the work-list, the agent drives the browser per cell, a
CLI writes the outcome. **The store is the loop counter** - there is no cursor file.

Non-obvious mechanics that must be honoured (all learned the hard way elsewhere in this repo):

- **`javascript_tool` truncates its return at ~1KB.** Never return raw `innerText`. Return a compact
  JSON verdict; accumulate raw text into a page global and Blob-download once per batch.
- **A long async returns `{}` through the tool but its side effects still run** - read the global afterwards.
- **Never trigger a modal.** An `alert`/`confirm` blocks the extension for the rest of the session.
  Blob download is the egress, exactly as `whatsapp-thread.ts` does it.
- **Readiness is a DOM predicate, not a timer.** Poll for the presence of the `"… RON total"` /
  `"Original price … Current price …"` token, the way the WhatsApp loop polls for a button's absence.
- **Echo verification is a hard abort.** Airbnb is a client-side router; across ~100 sequential
  parameter changes a stale re-render is near-certain. The page's own `"N nights in …"`, date lines
  and guest count must equal the probe or the cell is discarded, not banked. This is the single
  highest-value transfer from the WhatsApp precedent.
- **Write negative outcomes eagerly.** `refused` (min-stay) and `unavailable` are outcomes. A cell
  skipped silently is a cell you re-walk forever.
- **Stop on the first CAPTCHA** and tell the owner. Leave the rest `missing`, never mass-`error`.
- **Pace it.** Batches of 10-15 with a check-in; randomised 3-8s dwell on top of the settle. Nothing
  in the repo bounds request volume today, and ~100 sequential parameterised loads from one
  residential session is the risky pattern. Sentinels (§4.3) are the real mitigation.

### 4.2 L2 - Model

Pure fitting, nightly recompute, no network.

`discountModel.fit(observations)` → per channel, a depth estimate over `(nights, isHoliday)` with
`n` and a confidence that **decays with observation age**. `predict()` returns `unknown` rather than
guessing when confidence is below threshold.

`parityPrediction` then joins:
- predicted OTA guest total, per channel, per window, from the anchor rate sheet × `(1 − depth)`
- the direct total, read from `priceCalendars` **in-app** (the public `check-pricing` API is rate
  limited at 60/min and must not be used for a calendar sweep)
- `evaluateParity()` for the verdict, `indifferencePrice()` for the floor

Written to `parityPredictions`, recomputed by `/api/cron/parity-recompute` nightly.

**Where `listTotal` comes from, and why `channelPushes` is load-bearing for the model.**
Fitting is clean: `depth = 1 − guestTotal / listTotal` where both come from the *same* observation
(`listTotal` is the struck-through original the page already shows, and it is captured today). There
is no circularity in the fit.

Prediction is where the risk sits. To predict an *unobserved* window you need its `listTotal`, and
that can only come from the rate sheet - i.e. from **what you intended to type into the dashboard**,
not from what is actually listed there. If the two have diverged, every prediction downstream is
wrong and nothing would notice.

That is precisely what the `channelPushes` state machine is for, and it means the state machine is
not workflow decoration - it is a **model input**:

- `verified` → `listTotal` is trustworthy → full model confidence
- `applied` but not yet verified → reduced confidence
- `pending` or `drifted` → **`listTotal` is unknown → the prediction must be `unknown`, not a guess**

So the push tracking in Phase D is a hard **prerequisite** of any prediction in Phase F - which is one
of the reasons the plan puts measurement first. Phase F must emit `unknown` for any period whose push
is not at least `applied`, and say so on the surface.

**Two contracts the model needs and the codebase does not have:**

1. **A decomposition contract.** Observations are guest-facing *totals for a window*; the whole rate
   sheet surface (`channelNightly`, `ChannelPush.target.nightly`) is a *weekday nightly*. The only
   bridge that exists is `rateSheetService.ts:198`'s `(guestTotal − cleaningFee) / nights`, a flat
   allocation that ignores the weekend multiplier, the LoS discount, extra-guest fees, taxes and
   season boundaries inside the window. The 3% verification tolerance exists purely to absorb that.
   Before fitting anything, write `total → Σ nightly(date) + fees − discounts` explicitly and test it.
2. **A retention/windowing contract.** `parity-report.ts` loads *every observation ever* and rebuilds
   a probe per distinct `(checkIn, checkOut, guests)` **with no filter on past dates**. The coverage
   denominator therefore grows monotonically forever, and with `freshnessDays: 42` every window older
   than six weeks is permanently stale - so `coverage.complete` can essentially never be `true` again
   after the first six weeks. The honesty mechanism has already degraded into always-INCOMPLETE,
   which is why the report has never shown COMPLETE. Fix: exclude windows whose `checkOut` is in the
   past, and scope the denominator to the current probe set.

**Drift detection falls out for free**: when a fresh observation's implied depth departs materially
from the model's prediction, something changed on that channel. That is the trigger for a wider
sweep, and it is the answer to "nothing drifts".

### 4.3 L3 - Decide

The surfaces, in priority order:

1. **Channels tab** (extend, do not rebuild): predicted parity across every period, with **direct
   price, best predicted OTA guest price, gap, the floor, and a confidence/freshness chip**. A cell
   with no usable model reads `unknown`, never `pass`.
2. **Sentinels - the actual monitoring mechanism.** ~10 measured cells a week, chosen by
   value-at-risk x staleness and biased toward windows currently being advertised. This replaces the
   160-cell quarterly ritual with a 10-cell weekly one, and it is what detects drift. The model
   (§4.2) extends coverage to windows sentinels do not touch; it is not the watchdog.
3. **Situation pack `pricing` section** so the analyst can raise "you are advertising a window an
   OTA undercuts" with money attached.
4. **Ads guard** in `validateAdPlan`: `losing` is an error, `thin`/stale/uncaptured is a warning.

### 4.4 The output that matters most, given D2

For every window the engine must state four numbers together, and never one without the others:

```
best predicted OTA guest total      ← what the guest is comparing against
target direct (10% under)           ← where you want to be
indifferencePrice                   ← THE FLOOR. below this, let the OTA have the booking
current direct                      ← where you are
```

Because the plan is to move direct *downward*, the floor is the safety rail. It must appear on every
surface that shows a gap, and `marginGuard` (§8 Phase D6) must make it structurally impossible for
any automated proposal to cross it.

---

## 5. Data model

### 5.1 Changes to `channelPriceObservations`

Two additive fields, both worth doing **before** Phase C writes 100 new rows (this is Phase B):

```ts
/** Whose price this is. Defaults to self; competitors reuse this collection unchanged. */
subject: { kind: 'self' } | { kind: 'competitor'; listingId: string };

/** Structured replacement for the free-text sessionState. The prose is kept as sessionNote. */
session: {
  loggedIn: boolean;
  program: 'genius' | 'host' | null;   // level is NOT recorded: this property caps at L1 (§3.4)
  /**
   * Whether the programme discount actually applied to THESE dates. On Christmas and NYE the owner
   * has switched Genius off deliberately, so `false` here is a business fact, not a capture failure.
   */
  programApplied: boolean;
  currency: string;
};

/**
 * Which offer was read. Booking sells the peak windows non-refundable, and its "discount" on those
 * dates is really the gap between the flexible and non-refundable plans (§3.4). Comparing a
 * non-refundable OTA price with a flexible direct price is comparing two products, and the verdict
 * has to know which one it is looking at.
 */
ratePlan: 'flexible' | 'non-refundable' | 'unknown';
```

`sessionState` today is 29 distinct prose strings and is unfilterable. Every downstream fit must be
able to exclude logged-out captures mechanically.

### 5.2 New collections

| Collection | Purpose | Writer |
|---|---|---|
| `channelPriceImports` | Immutable raw captured text per `cellId + capturedAt`. The archive, so a regex bug is re-runnable without re-walking 100 pages. | capture loop |
| `parityModels/{propertyId}` | The fitted per-channel depth model + confidence + fit metadata. | `parity-recompute` |
| `parityPredictions` | Predicted parity per calendar cell. `unknown` is a real value. | `parity-recompute` |
| `competitorListings` | (Phase H) the comparable set. | admin |

All follow the house rule: `allow read: if isSuperAdmin() || isPropertyOwner(); allow write: if false;`
with a trailing comment naming the writer, placed adjacent to `channelPriceObservations`.

### 5.3 Missing index (will throw at runtime)

`parityObservations.ts` queries `.where('propertyId','==',x).where('capturedAt','>=',since)`, which
needs a composite index that **exists neither in `firestore.indexes.json` nor in the live project**.
That path has evidently never run. The nightly recompute reads by property with a freshness window,
so it must be added first:

```json
{ "collectionGroup": "channelPriceObservations", "queryScope": "COLLECTION",
  "fields": [ { "fieldPath": "propertyId", "order": "ASCENDING" },
              { "fieldPath": "capturedAt", "order": "ASCENDING" } ] }
```

Caution: `bookings (status + holdUntil)` and `housekeepingMessages (bookingId + changeType + createdAt)`
are deployed but absent from the file. `firebase deploy --only firestore:indexes` is **not** a no-op;
check it will not delete them.

---

### 5.4 VRBO is deprioritised, and the data says that is safe

Owner, 2026-08-29: *"VRBO is not very important to me now, I don't get too many reservations from
there. I got just one or two, from US. So I'll leave it as it is for the moment."*

Checked against the store before accepting: across **20 multi-channel windows, VRBO was the cheapest
channel exactly once** - and that once (2026-10-26) only because Airbnb refused the dates on a
4-night minimum, so VRBO won by default. Its typical premium over the cheapest channel is **+17% to
+56%**. VRBO does not bind `bestOffer`, so excluding it costs nothing today.

**Decision:** do not build a VRBO parser (Phase C), keep it in the worklist so opportunistic captures
still land, and **do not let its absence force every verdict to `partial`** - that would make the
honesty signal fire constantly for a channel that never sets the price.

**The condition that reverses this, written down so it is checkable:** if VRBO is ever the cheapest
channel in more than one window of a run, it binds, and it goes back in scope. Encode that as a check
in the report rather than trusting anyone to notice.

A caveat that survives: VRBO quotes in **USD with a manually-entered FX rate**, so its RON figures
carry an extra error term the other channels do not. That is a second reason not to let it drive a
decision, and it is also how the duplicate-capture artifact below got in.

### 5.5 Validation cannot catch a mislabelled currency, and it already happened

Four VRBO cells carry two observations a minute apart (2026-08-17 09:18 and 09:19). The 09:18 rows
record a **USD figure declared as `rawCurrency: 'RON'`**, so no conversion was applied: 728 instead of
3300, 601 instead of 2724. Every validation rule passed, because a number and a currency label are
individually plausible.

The store handled it correctly - append-only, newest wins, and `latestByCell` returns the corrected
09:19 rows. **But an analysis that reads raw history and picks the wrong duplicate gets a VRBO price
4.5x too low**, which is exactly the mistake that makes a channel look like it is undercutting you.
(This is not hypothetical: it happened while writing this document.)

**Fix for Phase C:** a magnitude sanity check at capture time. A guest total more than ~2x away from
the same window's direct quote is almost certainly a units error, and should be `error` with a reason
rather than a silently plausible number. Cheap, and it catches the one class of mistake provenance
rules cannot.

## 6. Competitors - the extension point, built now; the feature, later (D4)

The only thing to build now is `subject` (§5.1). It costs one field and avoids a migration over a
collection that will by then hold thousands of rows.

When the feature is built, everything else is reuse: the same capture loop, the same provenance
rules, the same freshness and coverage machinery, the same append-only history.

**Apples to apples** is the whole difficulty, and it is a modelling problem, not a scraping one.
A comparable is not "a house in Comarnic"; it is a listing that competes for the same booking:

```ts
interface CompetitorListing {
  listingId; channel; url;
  capacity: { guests; bedrooms; beds; bathrooms };
  propertyType: 'whole-house' | 'apartment' | 'cabin';
  distanceKm;                       // from the chalet, or from a demand anchor (Sinaia, Bușteni)
  rating; reviewCount;              // quality proxy; a 4.5/300 is not a 5.0/8
  amenities: string[];              // the price-moving ones: ciubăr, sauna, pool, fireplace
  curatedBy; verifiedAt;            // the owner confirms the set; it is not auto-discovered
}
```

Comparison is then on a **normalised** basis within a capacity band - price per guest-night or per
bedroom-night - never on a raw total. And the honest output is a **band with a position**, not a
verdict: "for 6-guest whole houses within 15km rated 4.7+, the 3-night October weekend range is
1,450-2,300 and you are at 1,928, upper-middle."

Two rules to write down now so the feature cannot rot: the comparable set is **owner-curated and
periodically re-verified** (auto-discovery produces garbage comparables), and a competitor
observation is **never** allowed to move a price automatically. It is context for a human decision.

---

## 7. Honesty rules (non-negotiable)

These already exist in `ota-parity-system.md` §6 and must survive every phase:

- A stale or failed probe is **`unknown`, never `pass`.** A dashboard that reads green because a
  capture broke is worse than no dashboard.
- Confidence **decays with age**. A 40-day-old Christmas observation is a hypothesis.
- **Never infer a missing cell** from a neighbour, a previous run, or a fee you worked out.
- Record promo state explicitly. The entire root cause was promotions nobody was tracking.
- **Read only.** Never sign in, never complete a reservation. On a CAPTCHA, stop and report.
- **A deliberate setting is not a defect.** Genius off at Christmas and NYE, the whole-house flat rate
  on peak dates, non-refundable peak plans, and VRBO priced above the rest are all choices the owner
  has made on purpose. The system reports them as facts and accounts for them in the maths. It never
  labels them problems, and it never "helpfully" proposes reversing them.
- **Compare like with like or say you cannot.** A non-refundable OTA price against a flexible direct
  price is two different products. Record the plan; if it is unknown, the verdict is qualified.
- The system **cannot push to any OTA.** `applied` is only ever set by a human; `verified` only by a
  capture. Any UI implying otherwise is a bug.
- **A model prediction is not an observation.** They must be visually distinct on every surface and
  stored in different collections.
- **The take rate is measured end-to-end, never assembled from components.** The owner's definition
  (2026-08-29) is the governing one:

  ```
  commissionPct = 1 − (what the owner receives / what the guest pays)
  ```

  Both sides are the WHOLE booking: nightly rate x nights, plus every fee the owner has set, plus
  extra-guest fees. Base commission, visibility boosters, VAT and non-commissionable sub-totals are
  all *inside* that ratio and must never be modelled separately - Booking's headline is ~15% while
  the measured rate here is **23.02%**, and an engine that rebuilt it from parts would put the floor
  eight points wrong. This is now enforced by documentation on `ChannelEconomics.commissionPct`
  itself, because the failure mode is a future reader "correcting" the number to the headline one.
- **Both sides of a comparison are guest-facing totals including all fees.** The direct side already
  is (`check-pricing` returns a total inclusive of the cleaning fee); the OTA side must match, or the
  gap is measuring fee policy rather than price.

---

## 8. The plan

**Reordered after adversarial review.** The first draft put the predictive model early. That was
wrong on the design's own terms: D3 says nothing changes until data has accumulated, and §3.2 shows
the corpus cannot support a fit today. **Measurement comes first and stands alone.** The model is an
upgrade to a working system, not its foundation.

Each phase ships something usable. `npm run build` must pass before any push (no staging exists).
Acceptance criteria are pre-committed, not chosen after the fact.

### Phase A - Make the existing instruments honest  ·  **DONE 2026-08-29 (A8 partial)**

Everything here is a correctness fix to tools that already exist and are quietly lying.
Build passes; full suite shows no regression against a clean-tree baseline (same 17 pre-existing
auth/e2e/visual failures both ways, +14 new tests, one fewer failure).

| # | Task | File |
|---|---|---|
| A1 ✅ | **Report retention fix.** `parity-report.ts` loads every observation ever with no past-date filter, so the denominator grows forever and after six weeks `STATUS: COMPLETE` is unreachable by construction. Exclude past windows; scope the denominator to the current probe set | `parity-report.ts` |
| A2 ✅ | `recordObservation` must call `normalizeChannel` and reject unknown channels. A typo writes cleanly and orphans a cell forever | `parityObservations.ts` |
| A3 ✅ | Stop `Math.round`-ing at write time - irrecoverable precision loss, worst on FX-converted VRBO | `parityObservations.ts` |
| A4 ✅ | Fix `outstandingCells`' last-in-wins map (`parityWorklist.ts:172`). Dormant only because callers pre-dedupe; any history consumer hits it | `parityWorklist.ts` |
| A5 ✅ | `parity-pack.ts`: `SpecialPeriodOptions` is an undefined type; `economics.configured` is read but never set, so the banner **always** claims "DEFAULTS (not yet persisted)" - the exact opposite of the truth | `scripts/parity-pack.ts` |
| A6 ✅ | Decide on `tsconfig.json:27`, which excludes `scripts/` from type-checking and is why A5 survived. Include it, or state plainly that scripts are unchecked | `tsconfig.json` |
| A7 ✅ | `parity` logger namespace (`parityObservations.ts:15` currently borrows `loggers.campaign`); refresh the stale list in `CLAUDE.md` | `src/lib/logger.ts` |
| A8 ◐ | Tests for `parityObservations` and `rateSheetService` - **neither has any**, including the five validation rules and the FX conversion | `__tests__/` |

**Acceptance:** a **fixture-based** completeness test (a synthetic fully-captured probe set) drives
`parity-report.ts` to `STATUS: COMPLETE`. No manual capture run is required to demonstrate Phase A.

**What actually shipped.** A1-A7 done. A6 resolved as a narrow `tsconfig.scripts.json` +
`npm run typecheck:scripts` covering the six load-bearing pricing/parity scripts, rather than
type-checking all of `scripts/` (which surfaces ~85 errors, almost all in old one-off diagnostics -
a cleanup project, not a Phase A item). A5 also *wired up* `schoolBreakOverrides`, which was
computed and then never read: published break dates now narrow the probe window, which matters for
"Vacanta mobila" where each county picks one week inside a three-week window.

**A8 is partial and it is the honest gap:** `parityObservations` now has 12 tests covering all five
validation rules, the new channel check and FX precision. **`rateSheetService` still has none.** Its
pure core (`buildRateSheet`, `diffAgainstApplied`, `verifyPush`) *is* covered by
`rateSheet.test.ts`; what is untested is the service wrapper - channel skipping, the
`(guestTotal − cleaningFee)/nights` reduction, and the observation→push matching window. Given §3.3
shows that function is broken in three ways and is rewritten in Phase D, testing it now would mostly
pin down behaviour that is about to change. Revisit at D2/D3.

**Verified side effect of A1:** the report's denominator dropped from 160 to 152 cells and now names
the 5 excluded past-stay observations. `STATUS: COMPLETE` is reachable again; it still reads
INCOMPLETE, correctly, because 49 cells were genuinely never captured.

### Phase B - Schema, before 100 new rows are written

| # | Task |
|---|---|
| B1 | Allowlist `mcp__claude-in-chrome__*`, else a 100-cell run is ~300 permission prompts |
| B2 | `subject` on `ObservationRecord`, defaulting to `{kind:'self'}` (§5.1, the competitor extension point) |
| B3 | Structured `session` **and `ratePlan`** (§5.1); keep prose as `sessionNote`. Backfill the 199 rows where prose is unambiguous, mark the rest unknown, and **stamp the migration** - the store is append-only and this is the one sanctioned exception |
| B4 | The missing composite index (§5.3). `loadObservations(propertyId, sinceIso)` throws today; nothing passes `sinceIso` yet, and the first thing that does will be a trainer. Re-verify with `gcloud` before deploying - the file is missing two live indexes |
| B5 | `channelPriceImports` collection + rules (the re-parseable raw archive) |

**Acceptance:** existing tests green; a hand capture still writes; a round-trip test proves `session`
and `subject` persist and read back.

### Phase C - The capture engine  ·  **DONE 2026-08-29**

Build exits 0; 947 tests pass (+25 from the extractors); scripts typecheck clean. The 17 failing
suites and 6 build-time auth log lines are identical on a clean tree - pre-existing, all requiring a
live server or browser.

| # | Task | Notes |
|---|---|---|
| C1 ✅ | `scripts/parity-next.ts` - outstanding cells **with fully-qualified per-channel URLs** | Removes ~100 chances to hand-mistype a parameter |
| C2 ✅ | `src/lib/parity/extract.ts` - **pure** parsers → `{total, list, promo, datesEcho, guestsEcho, needsSignIn, lowestPlan}` | Tested against saved fixture text. No page-parsing code exists in this repo today |
| C3 ✅ | `scripts/parity-capture.ts --rows <file>` batch mode **+ `--dry-run`** | Mirror `whatsapp-thread.ts save --rows`; guarded `rm` only after a confirmed save |
| C4 ✅ | Rewrite `.claude/skills/ota-parity` §4 into a deterministic loop playbook | Readiness predicate, echo-verification hard abort, batch Blob egress, CAPTCHA stop, batches of 10-15 |
| C5 ✅ | **VRBO: DECIDED, out of scope** (owner, 2026-08-29; cheapest in 1 of 20 windows and only because Airbnb refused those dates). No parser. Keep it in the worklist for opportunistic captures, and add the reversal check: **if VRBO is cheapest in more than one window of a run, it binds again** | §5.4 |
| C6 ✅ | **Magnitude sanity check at capture.** A guest total more than ~2x from the same window's direct quote is a units error, not a price. This exact bug is already in the store: four VRBO cells recorded USD figures labelled RON | §5.5 |
| C7 ✅ | **Capture `ratePlan` and `programApplied`.** Booking's peak windows are non-refundable and Genius is deliberately off there; a verdict that does not know this is comparing two different products | §3.4 |

**Acceptance, per channel not in aggregate:** Airbnb and Booking cells reach `captured` or a reasoned
`refused`/`error` with **zero hand-typed numbers**; a full run completes inside 80 minutes; every
captured row carries structured `session` and a raw import doc.

**What shipped, and what is still owed.** The machinery is built and both guards are proven against
the real store: a batch containing a channel typo and a 0.25x units error had exactly those two rows
refused while the good rows were written. Schema work from Phase B came forward with it (`session`,
`ratePlan`, `subject`, `rawExcerpt`), since C7 needed it.

Two bugs in the extractor were caught by its own tests and are worth recording, because both would
have produced *plausible* numbers rather than failures: `parseMoney` read `"2,064"` as **2.064**
(guessing the decimal separator by symbol rather than by digit count), and `classifyPage` measured
normalised text, so a whitespace-heavy page read as "never loaded".

**FIRST LIVE RUN: 2026-08-29.** The loop was driven end-to-end against real Airbnb and Booking pages
in the owner's logged-in Chrome. It worked, it wrote 5 rows through the one write path, and it found
**five defects in the parser that fixtures had not** - every one of which would have produced a
confident wrong number rather than a failure:

1. `"CHECKOUT 9/28/2026 GUESTS 4 guests"` - the unbounded `\d+` read the **year** as the guest count.
   Bounding to 1-2 digits then read **26**. Fixed with a guarded `readCount` that refuses to start
   part-way through a longer number.
2. `"Fully refundable (by Booking.com)"` - only `"free cancellation"` was recognised, so a flexible
   plan recorded as `unknown`.
3. Airbnb renders RON as **`"L 2,290 RON total"`**, with the symbol *before* the digits.
4. A **`not-priced`** page state: dates applied, panel reads `"Add dates for prices"`, and **the page
   still carries six RON figures belonging to Airbnb's *similar listings*.** A parser that fell back
   to "any RON figure" would have filed a **competitor's** price as this property's. The extractor
   refused, which is the behaviour that matters.
5. Returning `location.href` from `javascript_tool` is **blocked** by the extension's anti-exfil
   guard. Never return URLs or query strings from the page.

Live evidence collected in passing: Booking's Genius discount read **12%** on one window and **11%**
on another, against the owner's stated ~10% - his "not a hard number we can rely on" is now measured,
not asserted. And the 25-28 Sept Airbnb price had moved from 2,316 to **2,290** since 17 August, which
is exactly the drift the cadence exists to catch.

**Still owed:** `channelPriceImports` (B5) is also not built, so raw text is
currently kept only as the 2,000-character `rawExcerpt` on each observation.

### Phase D - The measured grid and the annual sheet  ·  **D4 SHIPPED 2026-08-29**

**D4 done.** `/admin/pricing` → Channels now opens with a parity panel over `src/lib/parity/parityView.ts`
(pure, 12 tests). Every row draws the four numbers that only mean something together — floor, target,
direct, cheapest OTA — on one scale, coloured by verdict, worst first. The Airbnb correction is applied
and *declared* per row; partial coverage and staleness read `partial`/`unknown` rather than borrowing a
verdict. Read-only: it changes no price and touches no channel.

**Competitor readiness:** `ObservationRecord.subject` is already `{kind:'self'} | {kind:'competitor', listingId}`
and every row written carries it, so the 4-5 comparable properties slot into the same store, the same
freshness and coverage machinery, and the same panel without a migration. What is still needed is
§6's `competitorListings` (the curated set and its normalisation attributes) and a capacity-band
comparison — not a change to anything built.

**Still owed in D:** D1 anchor config, D2 the two-anchor resolution, D3 channel cleaning fees,
D5 sentinels, D6 marginGuard, D7 2027 periods, D8 the benchmark-session decision.

#### Original D scope

No predictions. Everything on screen is something that was actually observed.

| # | Task |
|---|---|
| D1 | **Populate `pricingAnchors` - but seed it from OBSERVED live list prices, not the old spreadsheet.** The owner has flagged the sheet as likely outdated (Airbnb changed its commission handling and his prices were updated under the new model ~3-4 weeks before 2026-08-29), and he adjusts Airbnb prices periodically on Airbnb's own prompts (§3.4b). So transcribing the sheet would encode a fiction. Every capture already records `listTotal`; **the capture is the anchor**. This makes D1 depend on one Phase C run rather than being fully standalone |
| D1b | **Confirm the Airbnb fee from one real payout**, the way Booking's 23.02% was confirmed in §10 q0b. That method worked and took one screenshot. §10 q0 verified the arithmetic (15.5% x 1.21 RO VAT = 18.755%, matching the config) and that host-only means no guest-side fee, so the floor is correctly placed. What remains is a single confirmation that this listing pays 15.5% and not the 14-16% Airbnb allows for some hosts. No longer blocking, still worth doing before a price move |
| D2 | **Resolve the two-anchor conflict (§3.5) properly.** This is a design decision, not a rewire: `ChannelPush.target` is a single `nightly` while `buildAnchoredRows` emits a weekday/weekend **pair** per channel per period, so the push shape must change; and `rateSheets` are immutable and versioned by design while `saveAnchorConfig` is one mutable doc with no history. **Port the immutability** or next year's "did the dashboard change or did we?" becomes unanswerable |
| D3 | **Populate `channels.{id}.cleaningFee`** - no channel has one, which is why every push verification is skipped today (§3.3) |
| D4 | Channels tab: a **measured** parity grid showing the four numbers of §4.4 - direct, best measured OTA, gap, and the floor - plus coverage, staleness, and session class. Unmeasured reads `unknown`; a verdict missing any active channel reads `partial`, never `pass` |
| D5 | **Sentinels: the ~10 highest (value-at-risk x staleness) cells, weekly, one click to a `parity-next` run.** Bias selection toward windows currently being advertised, where being wrong costs twice. **This is the monitoring mechanism** |
| D6 | `src/lib/pricing/marginGuard.ts` - one floor implementation imported by the CLI, the ad validator and the compiler. Today it is duplicated in `parityMath` and stranded in `scripts/planner-pack.ts:96` |
| D7 | Propose 2027 periods from the seeded 2027 holidays; run `verify-period-identity.ts --selftest` before any `--write` |
| D8 | **Decide D6 (§0): the benchmark session class, per channel.** Nothing downstream is trustworthy until this is written down |

**Acceptance:** the owner can see, without a terminal, for any measured window: direct, best measured
OTA, gap, floor, when it was measured and under which session. He can set 2027 prices for every
channel from one screen and record what he typed.

**Honest limit to state on the screen:** direct's own 2027 prices are still set through
periods/compiler, and `anchorPricing.suggestedDirect` is a suggestion nothing writes. Phase D reduces
the two-worlds problem; it does not eliminate it.

### Phase E - Accumulate (not a code phase)

**Gate: at least three temporally separated capture cycles**, run through Phase C, under a decided
benchmark session (D8). Nothing in Phase F may begin before this. The corpus today is 3 days inside
an 11-day span with zero temporal replication - it cannot demonstrate the one property the model
needs.

### Phase F - The model (only after E)

| # | Task |
|---|---|
| F1 | `src/lib/pricing/decompose.ts` - the explicit `total → Σ nightly(date) + fees − discounts` contract (§4.2), pure and tested. **Needs per-channel fee config that no collection holds today** - add it in D3 |
| F2 | `discountModel.ts` - signature **must include session class and guests**, not just `(channel, nights, isHoliday)`. `isHoliday` comes from the `holidays` collection, never a hardcoded span (D5) |
| F3 | **Reconciliation gate**: for every observed cell, the anchor sheet's implied list total and the page's captured `listTotal` must agree within a stated tolerance, or the model refuses to fit. These are two different numbers and the first draft silently conflated them |
| F4 | `parityPrediction.ts` - must return `unknown`, never a number, when: `getAnchorConfig` reports `saved: false`; the period's push is not at least `applied`; the channel has no fitted model; or confidence is below threshold |
| F5 | `/api/cron/parity-recompute` + `parityModels`/`parityPredictions` + rules + indexes; `?dryRun=1` first |
| F6 | **Register the Cloud Scheduler job** (`europe-west1`, `Europe/Bucharest`, `0 4 * * *`) and record it in `CLAUDE.md`. Do not repeat `page-engagement-sync`, deployed and unscheduled for weeks |

**Acceptance, committed before fitting:** predictions within **5% on 90% of held-out cells**, AND a
**forward test against the next capture cycle** - not a random split, which shares promo regime,
session and price level with the training data and cannot fail in the way that matters.

### Phase G - Brain integration

| # | Task |
|---|---|
| G1 | `pricing` section in the situation pack; withheld on backtest via the `currentSignals` `{available:false}` shape. **Wrap `getParityConfig` in try/catch - it throws when unconfigured** |
| G2 | Fix a live defect: `situationPack.ts:134` tells the analyst `freeRuns` carries `askingAdr`; `priceRun` (`:577-593`) returns only `baselineAdr`. Thread `askingByDate` through, which also unlocks redefining `valueAtRisk` |
| G3 | Parity guard in `validateAdPlan`: add `parity` to `AdPlannerPackForValidation`, insert check 6 after the spend envelope. `losing` → `errors`, `thin`/stale → `warnings`. **Also add `parity` to `packJson` in `adPlanner.ts`**, or the planner can only fail, never comply |
| G4 | Mirror the instruction in **both** `situationAnalystMethod.ts` and `.claude/skills/situation-analyst/SKILL.md` |

**Note:** G3 works on *measured* parity from Phase D. It does not need the model.

### Phase H - Competitors (deferred by D4)

Design in §6. Not before Phase D is running and Phase E has completed.

## 9. Sequencing and why

**Phase C is the phase that pays for itself.** Without cheap capture the corpus never grows, and every
later claim rests on 199 rows from three days in August. It is also the immediate relief: the ritual
becomes an hour an agent drives instead of an afternoon you drive.

**D1 can start today, in parallel with everything.** Populating the anchor config is data entry into a
tool that already renders. It is the single highest value-per-minute item in this document.

**The model is deliberately last, and may never be needed.** Phases A-D deliver a working, honest
parity system whose monitoring mechanism is sentinels: ~10 measured cells a week on the windows that
carry the most money. That detects drift on what matters with **zero prediction risk**. Phase F
extends coverage to unmeasured windows; it does not replace measurement, and §3.2 shows it cannot yet.

Be clear-eyed about what the model would and would not buy. It interpolates across *cells*, not across
*time*. A Booking promo launched tomorrow is invisible to it until a sentinel run touches an affected
cell. Confidence decay handles models that are *old*; it does nothing for a model that is
*fresh and wrong*. Under D2 that failure has teeth: the tab reads healthy, direct sits above the OTA
for weeks, and ads keep sending paid traffic to the dearer channel. Sentinels are the guard against
that; the model is a convenience on top.

Nothing in Phases A-D changes a guest-facing price. Under D3 that is the point.

## 10. Open questions

0. ~~**The commission rate may be stale.**~~ **RESOLVED 2026-08-29, verified against Airbnb's own
   documentation.** The owner flagged that Airbnb had changed how it handles commissions and that his
   prices were updated under the new model. Checked online rather than from memory:

   - Airbnb is moving every host to the **single / host-only fee**. Most hosts pay **15.5%**
     ([Airbnb Help 1857](https://www.airbnb.com/help/article/1857)). The old **split fee** was ~3%
     host + 14.1-16.5% guest.
   - Under host-only, **the guest pays no separate service fee** - the nightly price the host sets is
     what the guest sees before taxes. This is exactly the owner's description: *"Before, the price I
     set in calendar was my net. Now, the price I use in calendar is the price the guest pays."*
   - In the EU the **VAT is charged on the service fee**. Romania's standard rate has been **21%**
     since 1 August 2025.
   - **EU/EEA hosts have until 13 October 2026** to adjust pricing for the change; the owner moved
     early, around 1-8 August 2026.

   **The arithmetic lands exactly on the configured value:**

   ```
   15.5% host-only fee  ×  1.21 Romanian VAT  =  18.755%
   channels.airbnb.economics.commissionPct    =  0.18755   ✓
   ```

   **So two things are confirmed rather than assumed:** `commissionPct` is right for the model the
   listing is actually on, and `guestFeePct = 0` is right because host-only has no guest-side fee.
   `indifferencePrice` - the floor D2 depends on - is correctly placed.

   **Two caveats that survive.** The `channels` doc was written **2026-08-07**, the same week as the
   repricing, so the value being correct today is partly luck of timing; it should be re-derived from
   a real payout at D1b rather than left as a coincidence. And **Airbnb states 15.5% for "most hosts",
   with some paying 14-16%** - so the exact rate for this listing still wants one confirmation from
   the host dashboard. The direction of any error is small and the floor is conservative either way.

0b. ~~**Is Booking's 23% right, and where does the Visibility Booster fit?**~~ **RESOLVED
   2026-08-29 from a real booking** (owner-supplied extranet screenshot, booking 6603646057,
   11-13 Sept 2026, 2 nights, 5 adults + 2 children):

   | | RON |
   |---|---|
   | Guest paid (Total price) | **2,064.00** |
   | Commissionable amount | 1,949.14 |
   | Commission and charges | **475.13** |
   | **Owner received** | **1,588.87** |

   ```
   effective take rate on the guest total   475.13 / 2064.00  =  23.02%
   channels['booking.com'].commissionPct                      =  23.00%
   netFromOta(2064, 23%)  = 1589.28   vs actual 1588.87   -> 0.41 RON out on a 2,064 booking (0.026%)
   ```

   **Three things confirmed at once.** The configured Booking rate is right to two decimal places.
   It **already includes the always-on Visibility Booster** - no separate term is needed, and adding
   one would double-count. And `booking.pricing.total` really is **net-to-owner**: this booking is
   `H1HCxzKqBpYAN6dXKKl7` in Firestore at `1589`, against an actual net of `1588.87`. The pack's
   `amountsNote` has been telling the truth.

   **The design consequence worth stating plainly:** for parity maths the thing that matters is the
   **end-to-end take rate from guest total to owner net**, not the itemisation into base commission +
   booster + VAT. `netFromOta` wants one number and that number is directly measurable from any
   booking. Do not model the components.

   **But it is a setting, not a constant.** The booster is a dial the owner controls, so 23.02% is
   *the current configuration*, not a structural property of Booking. If the booster is changed or
   paused, the floor moves. That makes it a `channels` value to re-derive from a fresh payout
   periodically, and a good candidate for the same cadence as a parity run.

   The guest total exceeds the "commissionable amount" by 114.86, and the owner has ruled that out of
   scope (2026-08-29): *"the gap of non-commissionable doesn't matter. What matters is what the guest
   pays (the rate set in calendar, plus different fees I have set, or extra guest fees) vs what I get
   from them."* Correct, and it is now the governing definition - see §7.

1. ~~**The Airbnb guest-fee model.**~~ **CONFIRMED FROM A REAL PAYOUT 2026-08-29 - see §3.4c.** The host earnings screen states `Host service fee (15.5% + VAT)` and `Guest service fee L 0.00`, and 3,578.32 x 15.5% x 1.21 = 671.11 to the leu. Effective take 18.755%, matching the config exactly. Original reasoning, now superseded but consistent: `parityMath.guestFeePct` defaults to 0, which
   treats the guest total as the host base. Two independent lines of evidence say that is correct
   here: the commission on file, **18.755% = 15.5% host-only fee × 1.21 RO VAT**, is the signature of
   Airbnb's *host-only* fee model, in which the guest pays no separate service fee; and a Sept 14-18
   list total implies ~514/night against a listed ~523. So the floor is **not** understated and D2 has
   the room it appears to have. Worth one confirmation against a real payout in the host dashboard,
   but this is no longer blocking. Note the related structural point: `guestFeePct` is applied
   *multiplicatively off the total* rather than additively on a host base, so if a split-fee channel
   is ever added, `netFromOta` needs changing - and it has a wide blast radius.
2. **Per-channel targets** rather than one global 10%. Beating Booking by 10% is cheap; beating
   Airbnb by 10% during a 29% length-of-stay discount may be impossible above the floor.
3. **The 7-vs-6 guest mismatch, now with a real booking behind it.** The property record says
   `maxGuests: 7`; the Airbnb listing advertises 6. Booking 6603646057 (§10 q0b) was **5 adults + 2
   children = 7 guests**, taken through Booking.com. So this is not a hypothetical: there is real
   demand at 7 that the Airbnb listing structurally cannot serve, and a guest searching for 7 never
   sees it there. Worth deciding deliberately rather than leaving as a side effect.
4. **The flat-rate group cliff.** Holiday overrides carry `flatRate: true`, so extra guests are free
   on those nights while the OTAs charge per guest - direct is 20-26% cheaper at 6 guests on NYE and
   nothing on the site says so. This is a deliberate pricing choice (see the `declined-means-closed`
   note); the open question is purely whether to *market* it.
5. **Request-volume safety.** Nothing bounds OTA page loads today. Sentinels are the intended answer;
   until Phase D's sentinels exist, keep runs to `--max 50` and pace them.
