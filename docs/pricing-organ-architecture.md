# The Pricing Organ — target architecture

**Status:** design, 2026-08-07. Drafted against a four-agent survey of the live codebase.
**Companion:** `docs/ota-parity-system.md` (the audit half, built), `docs/promotion-system-architecture.md` (the brain).

---

## 0. The problem, stated once

The system has a **pricing engine** but no **pricing model**. `calculateDayPrice()` turns rules into a
night's price correctly. But nothing owns the rules: the 2026 seasons were written by a script that ran
once and cannot be re-run. Because nothing owns them:

- nothing can project them onto the other three channels (that lives in a spreadsheet);
- nothing can reason about them (the analyst is price-blind);
- nothing can tell when they have drifted (found by hand, once, today);
- and 2027 has no prices at all, because nobody re-ran the script.

The owner's real model — one base rate, a demand tier per period, per-channel gross-ups that preserve
net, direct set slightly below — exists only in a Google Sheet. **This document brings it inside.**

## 1. The governing principle

> **The guest-facing engine is frozen. Everything new compiles down into what already works.**

`calculateDayPrice()`, `priceCalendars`, `/api/check-pricing` and the booking flow never learn that
periods, channels or the brain exist. Each new layer is a compiler emitting artefacts they already
consume — the same relationship `priceCalendars` already has to `seasonalPricing`.

This is what makes the work buildable with no guest-facing risk, and it yields a decisive acceptance
test (§2.3).

## 2. The Period

### 2.1 The entity

The owner's spreadsheet row is already the right abstraction. It becomes a document:

```
pricingPeriods/{propertyId}_{year}_{slug}
{
  propertyId, year, slug,                    // 'craciun', 'vara-inalta', 'noiembrie-gol'
  name: { en, ro },
  startDate, endDate,                        // YYYY-MM-DD — explicit, never derived
  tier: 'min'|'low'|'base'|'medium'|'high'|'max',
  priority: number,                          // explicit overlap resolution; higher wins
  holidayRefs: string[],                     // holiday doc ids — REFERENCE, never recompute
  fixedNightPrice: number | null,            // hand-set peak; wins over tier
  minStay: number | null,
  status: 'draft'|'active'|'archived',
  updatedAt, updatedBy, compiledAt, compiledHash
}
```

**The tier ladder is data, not code.** `property.pricingConfig.tierMultipliers`, defaulting to the
owner's real six-tier vocabulary `{min .8, low .9, base 1.0, medium 1.1, high 1.2, max 1.3}`. The
engine's five-tier `SEASON_MULTIPLIERS` `{0.7 … 1.5}` (`price-calculation.ts:27`) is a fiction consumed
only by the season forms, and is **deleted** along with the dropdown→multiplier relink that silently
repriced Easter 1.1→1.2 and Summer 1.2→1.5.

**Holidays are anchors, not sources.** A period carries `holidayRefs`; the compiler *validates* the
anchor and never moves dates. When `holidays` gains 2027 rows the compiler emits a worklist — *"period
`paste` has no 2027 row; 2026 anchored to `RO_paste_2026` (Apr 10–13); the 2027 holiday is Apr 30–May
3"* — and the owner rolls each forward with one confirm. This honours `seed-holidays.ts`'s doctrine
(fetched facts, never computed) while finally wiring `holidays` into pricing, as a checklist generator
rather than a price input.

### 2.2 Compile, don't replace

```
pricingPeriods → COMPILER → seasonalPricing / dateOverrides (provenance-stamped)
              → generatePriceCalendar() → priceCalendars → /api/check-pricing → guest
```

Why compile rather than replace the collections:

- The engine, calendar generator, admin calendar and booking flow all read seasons/overrides/calendars
  today. Replacing them means rewriting the one revenue-carrying part of the system to gain nothing a
  compiler doesn't give.
- It fixes the **overlap defect without touching the engine**: the compiler emits a *flattened,
  non-overlapping* season set (winner-by-priority per day, split at boundaries), so
  `findMatchingSeason`'s broken highest-multiplier sort never sees two candidates. Overlap semantics
  become pure and unit-testable.

**Provenance is the field that makes this safe:**

```
provenance: { source: 'period-compiler'|'proposal'|'manual', periodId?, compiledAt, hash }
```

The compiler replaces only `period-compiler` rows. Legacy rows migrate as `manual`, badged in the UI as
"outside the period model" with an *adopt* action. Approved brain proposals emit `proposal` overrides —
visible, revertable, never confused with either.

Fixed peak prices compile to `dateOverrides`, whose replace-everything semantics are exactly what a
hand-set price means. Min-stay collapses to one system: `period.minStay` compiles into generated rows;
the writer-less `minimumStayRules` path is deleted; `defaultMinimumStay` remains the floor, with its
Zod omission fixed.

**Horizon** extends to `max(active period.endDate)`, minimum 12 months — replacing the hardcoded rolling
12 that nothing advances. This is what closes the live 2027 gap.

### 2.3 The acceptance test

> **`compile ∘ migrate = identity`.**

Migration lifts today's production rows into periods; recompiling must produce `priceCalendars`
**byte-identical** to live. A replacement architecture has no equivalent proof.

## 3. Channels

### 3.1 First-class

One closed vocabulary in `src/lib/channels.ts`: `ChannelId = 'direct'|'airbnb'|'booking'|'vrbo'` plus
`normalizeChannel(raw)` with alias maps covering all four existing string vocabularies
(`icalFeeds.name`, `booking.source`, `channelPricing.channels[].channel`,
`channelPriceObservations.channel`). `Property.channelIds` (dead) is deleted; `property.channelPricing`
migrates to:

```
channels/{propertyId}_{channelId}
{ channelId, displayName,
  economics: ChannelEconomics,      // parityMath's OWN exported type — imported, never redefined
  extraAdjustmentPct,               // deliberate margin beyond the structural factor
  currency, fx: {rate, asOf} | null,   // manual; staleness flagged, never auto-fetched
  cleaningFee, rounding,
  targetDirectDiscountPct, directEconomics,   // direct only
  listingUrl, icalFeedId, active }
```

### 3.2 One structure, four lists, net preserved

The gross-up is **derived from `parityMath`, not copied from the sheet**:

```
grossUpFactor(channel) = 1 / (1 − headroomPct(channel, direct)) × (1 + extraAdjustmentPct)
channelNightly         = round(directNightly × grossUpFactor)
```

This *decomposes* the sheet's magic numbers instead of enshrining them — and the decomposition is the
most valuable single output of this design:

Computed with `parityMath.headroomPct()` against the persisted rates, and the sheet's own base
(475 weekday) versus its per-channel listed prices:

Measured against the **direct base price of 525** (`property.pricePerNight`):

| Channel | Comm. | Listed | vs direct | Needed for equal net | Difference |
|---|---|---|---|---|---|
| Airbnb | 18.755% | 523 | 0.995× | 627 (**×1.195**) | **−16.7%** |
| Booking.com | 23.00% | 632 | 1.203× | 662 (**×1.261**) | **−4.6%** |
| VRBO | 20.00% | — (Airbnb ÷ 4.5) | — | 637 (**×1.214**) | — |

*Twice corrected, 2026-08-07. The first draft used a 15.65% Airbnb commission (real: 15.5% host-only ×
1.21 RO VAT = **18.755%**). The second used the sheet's `airbnb_w_price = 475` as the anchor — but 475
is the base the AIRBNB column is derived from, **not the direct price**. Against the real direct base
of 525 the gaps are larger and Booking is also mildly under, not over. Reproduce with
`npx tsx scripts/rate-sheet.ts --decompose`.*

**"Needed for equal net" is a reference line, not a target.** It says where a channel price would have
to be for a booking there to pay the same as a direct booking. It does not say the channel price should
move: accepting less from an OTA that reaches guests the direct site never would is a legitimate
strategy, and which lever to pull — channel price, direct price, or neither — is the owner's demand
judgement. The system measures; it does not prescribe.

**That negative number explains the entire parity finding.** Airbnb is listed at essentially the
direct price (522.5 against 525) while also taking 18.755%, so it necessarily shows the cheapest guest
price and returns the lowest net per night. The 2026-08 measurement — Airbnb the cheapest channel in 20
of 22 comparable windows, direct losing 9 of 15 — is not drift. It is the arithmetic consequence of a
channel price and a direct price that were maintained independently of each other.
`grossUp.test.ts` asserts the consequence and nothing more: a night sold on Airbnb at the sheet's price
pays less than the same night sold direct. What should change, if anything, is not the code's call.

Direct is grossed up by nothing, so it is structurally the cheapest window at comparable net — the
owner's five-year practice, now derived rather than hand-maintained. `indifferencePrice` becomes the
floor for any discounting. **No gross-up maths exists anywhere except `parityMath`.**

### 3.2b The owner's actual formulas (from the sheet, 2026-08-07)

No longer inferred. Constants: `airbnb_w_price = 475`, `airbnb_we_price = 625`, `bk_factor = 1.33`,
`airbnb_correction = 10%`, `taxa curatenie = 200`, `genius discount = 10%`.

```
abb week  = round( airbnb_w_price  × (1+tierPct) × (1+airbnb_correction) / 5 ) × 5
abb w/e   = round( airbnb_we_price × (1+tierPct) × (1+airbnb_correction) / 5 ) × 5
bk  week  = round( bk_factor × airbnb_w_price  × (1+tierPct) / 5 ) × 5
bk  w/e   = round( bk_factor × airbnb_we_price × (1+tierPct) / 5 ) × 5
VRBO week = roundup( abb_week / 4.5 / 5 ) × 5        // USD
VRBO w/e  = round(   abb_we   / 4.5 / 5 ) × 5        // USD
```

Period rows are `VLOOKUP(rule, tierMatrix)`; the Booking column is wrapped in
`if(done? = true, …, "")` — so **`done?` is not merely a tracking tick, it gates whether the Booking
price is displayed at all**. That is a workflow state and maps directly to `channelPushes.status`.

Three things this reveals that the design must absorb:

1. **Rounding is "to the nearest 5"** (round-up for the VRBO weekday leg). It belongs in
   `channels.rounding`, and it must be applied *after* the gross-up, exactly as here.
2. **`genius discount 10%` is declared and never used in any formula.** It is folded, undecomposed,
   into `bk_factor = 1.33`. Splitting it out is precisely what `extraAdjustmentPct` is for — otherwise
   nobody can tell how much of the 1.33 is commission, how much is Genius, and how much is margin.
3. **VRBO is not grossed up at all.** It is the *Airbnb* price divided by a hardcoded `4.5`. So it
   inherits Airbnb's −4% gap from net parity and adds a stale FX constant (4.5 against ~4.54 today),
   landing ~5–6% below net parity before FX drift. VRBO carries a 20% commission — the highest of the
   three after Booking — and is the least grossed up of them.

**A modelling gap this exposes:** `parityMath.guestFeePct` is currently 0 for every channel. That is
right for Booking.com, wrong for Airbnb pre-migration, and wrong for VRBO, which adds a guest service
fee on top of the host price. The sheet's numbers are *host* prices; the parity observations are
*guest* totals. Until each channel's guest-fee model is recorded, the two cannot be compared without
the error that produced the 2026-08 confusion.

### 3.3 Rate sheets and push tracking

`periods × channels` compiles the spreadsheet's replacement:

```
rateSheets/{propertyId}_{version}    // immutable, versioned
  rows: [{ periodId, channelId, nightly, cleaningFee, minStay, grossUpFactor, computedAt }]
```

The system **cannot push to the OTAs** — a human types into three dashboards. So the sheet's `done?`
checkbox becomes a state machine in the house idiom:

```
channelPushes/{id}
{ propertyId, channelId, periodId, rateSheetVersion,
  target: { nightly, minStay, cleaningFee },
  status: 'pending'|'applied'|'verified'|'drifted',
  appliedAt, appliedBy,                 // ONLY a human sets 'applied'
  verificationObservationId }           // ONLY an ota-parity capture sets 'verified'
```

- **pending** — a new rate-sheet version differs from the last applied value.
- **applied** — the owner confirms they entered it. The human gate.
- **verified** — an `ota-parity` capture matches within tolerance. *The parity system built on
  2026-08-07 is the verification loop*: `parityWorklist`'s cell ids, coverage and staleness schedule
  re-verification; `evaluateParity` judges the capture.
- **drifted** — a later observation contradicts the applied value (a promo, a typo, a forgotten push).
  Drift becomes a fact the brain can see.

Surface: a **Channels** tab on the existing `/admin/pricing` five-tab layout — the rate-sheet grid
(visually the owner's spreadsheet), per-cell status chips, deep links to each OTA dashboard, and the
exact number to type. The human is the API; the UI's job is to make typing errorless and verification
automatic.

## 4. Giving the brain its missing sense

### 4.1 A 13th pack section

```
pricing: {
  live:     { horizonEnd, unpricedMonths[], windows[{start,end,periodId,tier,avgNightly,minStay,source}] },
  channels: [{ channelId, grossUpFactor, headroomPct, pendingCells, driftedCells, lastVerifiedAt }],
  parity:   [{ window, channelId, status, guestGapPct, netAdvantage, promoDriven }],
  askedVsAchieved: [{ month, askAdr, achievedNetAdr, gapPct }]
}
```

**Withheld on backtests exactly as `inventory` is** — forward asking prices as of a past date were
never snapshotted, so the pack refuses rather than approximates.

**Two lies fixed as prerequisites:** `dataQuality.pricing.systemPricingInUse` becomes true with an
honest note (the booking engine *is* live); `constraints.minStayNights` is read per-day from
`priceCalendars`, making `orphanNights` and `unsellableUnderMinStay` correct precisely on the Dec 24–31
dates where they are currently wrong.

**Net normalisation:** with `normalizeChannel` and channel economics, every historical revenue fact
normalises to net (direct minus `paymentCostPct`; OTA already net or derived from commission). The
pack's "directly comparable" note becomes true instead of asserted.

### 4.2 `valueAtRisk`, redefined

Today it is `nights × baselineAdr` — a multi-year blended *achieved* average, net/gross-mixed, and the
**sole determinant of the ad spend envelope**. It becomes:

```
valueAtRisk = Σ currentAskingPrice(night) over the open nights in the window
```

A forward fact instead of a historical echo. `baselineAdr` survives as `achievedNetAdr`, and the spread
between asked and achieved becomes a new analyst signal in its own right. On backtests, where pricing
is withheld, it falls back to the historical formula and says so.

### 4.3 The dead instruments become real

`price` / `ota` / `minstay` / `los` currently pass the validator with **zero structural checks** and are
marked `accepted` with no draft. Each gains a typed hand-off and a receiving surface, in the ads idiom:

- **`price`** → `priceProposals/{id}` (window, per-day current vs proposed, rationale, cited facts) →
  a Proposals queue on `/admin/pricing` → approve → compiler emits `proposal`-provenance overrides →
  regenerate → changed channel cells become `pending` pushes.
- **`ota`** → a channel-action draft: reconcile a `drifted` cell, clear `pending`, adjust
  `extraAdjustmentPct`, or request a parity capture.
- **`minstay` / `los`** → structural drafts against `period.minStay` or
  `pricingConfig.lengthOfStayDiscounts`.

**What the validator must enforce** (today: nothing):

- `price` — window required and inside the priced horizon; figures cited to `pricing.live.windows`;
  **floor enforced** — never below `indifferencePrice` against the strongest active channel, never
  beyond `maxDiscountPct`. That guard, today stranded in `scripts/planner-pack.ts` and unreachable from
  any in-app path, moves to `src/lib/growth/marginGuard.ts` imported by the CLI, the validator and the
  compiler — one implementation, three enforcement points.
- `ota` — `channelId` from the canonical vocabulary; must cite a real cell or drift fact in the pack.
- `minstay`/`los` — window plus integer nights, and must differ from the current value.
- All four — rejected when the pricing section is withheld. A backtest cannot recommend a price move.

## 5. Sequence

Every step ships something working; each defect is fixed at the step that would otherwise build on it.

**Step 0 — make the write paths honest.** *(Prerequisite for everything.)* Fix the broken season and
override create forms (`formData.forEach` TypeError), the two boolean-coercion switches that can never
set false, delete-reports-failure, `$`-for-RON, the `pricePerNight` regeneration gate
(`properties/actions.ts:288`), the Zod-dropped `defaultMinimumStay`. Delete `SEASON_MULTIPLIERS` and the
dropdown relink. Fix the pack's two lies. *Why first: Steps 2–3 compile through these write paths;
building on a form that silently reprices Easter would poison the identity proof.*
**Ships: a working pricing admin and an honest pack.**

**Step 1 — channels first-class.** `src/lib/channels.ts`, the `channels` collection, an admin card,
`normalizeChannel` applied read-side, `channelPricing` migrated, `Property.channelIds` deleted, parity
CLIs reading economics from Firestore. *Why before periods: rate sheets and net normalisation both need
economics; nothing here needs periods.*
**Ships: one channel vocabulary; the parity system on live config.**

**Step 2 — periods + compiler + provenance.** Migration, flattening compiler with priority, the
byte-identical acceptance test, horizon extension, the holiday-anchored 2027 worklist. Delete
`minimumStayRules`; retire `setup-2026-pricing.ts` to reference.
**Ships: the period model live, 2027 priced, provable no-change for 2026.**

**Step 3 — rate sheets + push tracking.** `rateSheets`, `channelPushes`, the Channels tab, verification
wired to `ota-parity` captures.
**Ships: the spreadsheet replaced, with zero engine change.**

**Step 4 — the brain's price sense.** The `pricing` pack section, net normalisation, `valueAtRisk`
redefined, method updated.
**Ships: materially better weekly reports before any new instrument exists.**

**Step 5 — live instruments.** `priceProposals`, channel-action drafts, validator checks,
`marginGuard.ts`, router hand-offs, the proposals queue.
**Ships: the closed loop — advise → approve → apply → parity-verify.**

**Deleted honestly:** `SEASON_MULTIPLIERS` + relink (0); `minimumStayRules` (2); `Property.channelIds`
and untyped `channelPricing` (1); planner-pack's private `maxDiscountPct` (moved, 5); the guest-facing
`pricingTable` free-text block — after Step 2 it renders from compiled periods or stays hidden, never
hand-maintained again.

## 6. Amendments to the drafted design

1. **Add the ads guard to Step 5.** `docs/ota-parity-system.md` §7.2 already specifies it and it is one
   field on `AdPlannerPackForValidation`: refuse, or loudly warn, when a campaign targets a window an
   OTA undercuts. The 2026-08 campaign advertised 23 Aug – 7 Sep while 28–30 Aug was 24% cheaper on
   Airbnb — the exact failure this prevents, and the cheapest guard in the document.
2. **Step 0 also needs the `website-pending` fix.** The Stripe webhook never rewrites
   `booking.source`, so direct web bookings will carry `website-pending` forever. Live data is clean
   only because volume has been low; Step 1's `normalizeChannel` would otherwise inherit a bucket that
   silently splits `direct`.
3. **Record the Airbnb decision explicitly.** §3.2's `extraAdjustmentPct: −4%` for Airbnb is a
   *finding*, not a setting to preserve. Migration should surface it as a question — "your Airbnb
   gross-up is 4% below net parity; keep, or move to 1.151?" — rather than encoding five years of
   accumulated drift as intent.
4. **The one thing to get right** (Fable's, and I agree): *the period entity with provenance-stamped
   compilation, proven by the identity migration.* Channels need something to gross up. The rate sheet
   is periods × channels. Push tracking tracks period cells. The brain's new sense reads what periods
   compiled. The horizon gap, the overlap bug, the two ladders, the 2027 hole and the spreadsheet are
   all the same problem: **pricing intent exists nowhere — only its untraceable residue in
   `seasonalPricing` rows.** Build that with the byte-identical proof and everything after is additive
   and safe; skip it and everything after hardcodes around a vacuum.
