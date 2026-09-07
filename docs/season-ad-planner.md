# Season Ad Planner

The layer above the per-campaign ad planner. It decides **which stay windows are worth advertising
across a whole season, in what order, and with how much of the year's budget** — then hands each
chosen window to the existing `/admin/ads` flow, which is unchanged.

Built 2026-09-07. Nothing here spends, activates, or touches Meta with a write.

## Why it exists

The ads arm could plan one campaign well and could not plan a season at all. The owner typed a window
into a form; `buildAdPlannerPack` sized a budget for that window alone, capped at 500 RON, blind to
every other window and to the year. Three facts made that untenable:

- **201 consecutive nights were empty** (11 Oct 2026 → 29 Apr 2027), including Crăciun, Revelion and
  the winter school break. Nothing in the system surfaced that.
- The budget is **4,000 RON/year**, all Meta. At an average 2,414 RON net per direct booking, the
  whole year breaks even on fewer than two bookings — but only if it is spent where it can work.
- The goal is **occupancy, not direct-channel share**. The OTAs are the owner's own listings minus
  ~20% commission.

## Shape

```
scripts/season-pack.ts ──► SeasonPack (facts + a complete BASELINE plan)
                              │
                              ▼
        .claude/skills/season-ad-planner  (judgement: exclude / emphasis / angle)
                              │
                              ▼
        scripts/land-season-plan.ts ──► seasonPlans/{id}   (draft, then active)
                              │
                              ▼
        adPlannerPack.constraints.seasonSlot  ──► the existing /admin/ads flow
```

| Piece | File | Purity |
|---|---|---|
| Money constants, ad year | `src/config/growth-ads.ts` | pure |
| Candidate windows | `src/lib/growth/seasonWindows.ts` | pure, tested |
| Rank + allocate | `src/lib/growth/seasonAllocator.ts` | pure, tested |
| Ledger arithmetic | `src/lib/growth/seasonLedger.ts` | pure, tested |
| In-flight campaigns | `src/lib/growth/inFlight.ts` | pure + a thin fetcher, tested |
| Validator | `src/lib/growth/validateSeasonPlan.ts` | pure, tested |
| Fact pack | `src/lib/growth/seasonPack.ts` + `scripts/season-pack.ts` | I/O |
| Account spend | `src/services/growth/metaAds/accountSpend.ts` | Graph, read-only |
| Parity board loader | `src/services/growth/parityPositions.ts` | I/O (shared with the admin tab and `pricing-position.ts`) |
| The one write path | `src/services/growth/seasonPlanService.ts` + `scripts/land-season-plan.ts` | guarded |
| Judgement | `.claude/skills/season-ad-planner/SKILL.md` | no arithmetic |

## The decisions, and why

**The allocator ranks; the skill re-tiers.** Comparison and weighting *are* arithmetic, so a skill
that ranks is a skill doing arithmetic. But an allocator whose order is final makes the skill a
formatter. So the allocator produces a baseline with printed score components, and the skill may only
`exclude` (with a reason), shift `emphasis` by one named tier (citing a pack field), and write the
`angle`. `SeasonPlanEdits` carries **no numeric field anywhere** — the skill cannot set a budget
because there is nowhere to type one.

**An ordinal ladder, not a weighted score.** With `hasConversionHistory:false` and one completed
campaign, any expected-value score would be a fabricated conversion rate wearing a number's clothes.

**Breadth before depth.** Pass 1 funds as many windows as possible at the minimum daily budget that
can actually deliver — *derived from the account's own CPC*, not chosen. Pass 2 tops up in rank
order. Smearing 4,000 RON across seven months is ~19 RON/day, under Meta's learning threshold, so the
honest output is to fund a handful properly and mark the rest explicitly unfunded.

**A `losing` parity verdict is a hard gate.** If a guest can beat the price on Booking, an ad pays to
send them to the worse price. This is the most important guard in the design and it came out of a
real incident: 3–6 Sep 2026, ~182 RON of spend produced a Booking.com reservation because direct was
only 4.4% cheaper, and ~355 RON of margin went to the platform.

**Per-window budgets are ADVISORY; the annual envelope BITES.** The owner sets the number at review.
`validateAdPlan` only *warns* when a plan exceeds its slot. But `approveAdAction` refuses an approval
that would breach the ad year unless `overrodeAnnualBudget` is explicitly set, and that choice is
recorded on the campaign.

**The ledger reads account-level Meta spend.** Boosts made by hand in Ads Manager never produce an
`adCampaigns` doc, and they come out of the same 4,000 RON. It also counts `reservedInFlightMinor` —
the forward commitment on live flights — because counting only what Meta has already billed makes
"remaining" look better than it is every single day.

**The ad year runs 1 Sep → 31 Aug.** A calendar year splits a winter season across two envelopes, and
would charge the flights launched 6 Sep 2026 to a year with no plan.

## Traps this build hit, in case they resurface

- `travelWindow` must **never** be fed a `school-break` row. The 19-day winter break would come back
  as one absurd 19-night "window".
- `computeFreeRuns.end` is the **last free night**; `travelWindow.checkOut` is **exclusive**. Clipping
  is `checkOut <= addDays(run.end, 1)`.
- `insights.spend` is **RON**; `account.amount_spent` is **bani**. Both come out of `brandHealth.ts`.
- The tracked-campaign set for the ledger must be **every** campaign ever created, not just live ones.
  Using the in-flight set reported 74.34 RON of "hand-made boosts" when the true figure was 5.58.
- `adPlanner.ts` builds `packJson` from an **explicit whitelist**. A field added to the pack is
  invisible to the model until it is named there.
- `getPropertyWithDb` returns the pricing projection and carries **no images**.
- Candidates overlap by construction (Crăciun exists as its own occasion *and* as a school-break
  slice). The allocator refuses to fund two overlapping stays, or they bid against each other.

## Running it

```bash
npx tsx scripts/season-pack.ts --start 2026-10-11 --end 2027-04-29 --label "Winter 2026-27" --out /tmp/season.json
# then the skill, then:
npx tsx scripts/land-season-plan.ts --plan /tmp/plan.json --pack /tmp/season.json [--activate]
```

`land-season-plan` re-runs the validator, refuses on any hard error, and re-checks the envelope
against a **live** ledger — a plan built on Tuesday against a boost made on Wednesday is
arithmetically valid and financially wrong.

## Not built yet

- **Ledger caching in the `ad-reconcile` cron.** The pack reads spend live (2 Graph GETs). Caching to
  `adSpendLedger/{propertyId}_{adYear}` would make pack builds free.
- **`seasonPlanId` / `seasonSlotId` written at generate time.** The review screen currently matches a
  campaign to its slot by stay-window overlap, which works but is a heuristic.
- **A `/admin/season` surface.** The plan is CLI-landed and read back with `query-firestore.ts`.
