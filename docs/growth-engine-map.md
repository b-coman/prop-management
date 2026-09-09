# The growth engine, end to end

Written 2026-09-09 after building the season layer without first reading the rest, and being told so.
This is the map I should have had first: what exists, what state it's in, and which seams are wired.

## The shape

One brain routes; three arms execute; a pricing and parity substrate feeds all of them.

```
                   situationPack (facts)
                            |
                   situationAnalyst  ──►  situationReports + opportunities
                            |                        |
                            |            approveOpportunityAction (human)
                            |                        |
              ┌─────────────┼─────────────┐──────────┘
              ▼             ▼             ▼
          WhatsApp        Ads          Page post
              |             |             |
        campaignService  adPlanner    pagePostWriter
        copywriter       adProposal   pagePublisher
        executionGateway adCopywriter
              |          adComposer
              |          adExecutionGateway ──► Meta
              |             |
              |          adReconciliation ──► adOutcomes ──► adLearnings
              |                                                  |
              └──────────────────────────────────────────────────┘
                         (feeds the next pack)

    substrate: pricingPeriods → compile → priceCalendars
               channelPriceObservations → parityPositions → verdicts
               signals.ts (free runs, holidays) — shared by situationPack and seasonPack
```

## The brain

`situationAnalyst.ts` + `situationAnalystMethod.ts` (the method) + `situationPack.ts` (the facts).
Admin at `/admin/situation`, run by a button. Writes `situationReports` and `opportunities`.

It routes to seven actions, not three: `whatsapp | ads | page` are campaign arms;
`price | minstay | los | ota | none` are owner actions surfaced for a human.

**It already holds the instrument-routing doctrine**, and holds it better than anything else here:

- smallest instrument that fits the size AND cause
- read the outreach and cancellation ledgers first — a recently-spent channel is disqualified
- instruments are NOT exclusive; a big window takes a warm WhatsApp arm AND a cold ads arm in parallel
- WhatsApp targets Romanian past guests; foreign demand is an ads or OTA matter
- a window ~3 weeks out is too short for a cold ads account to ramp → warm channel only

**State:** has run. 1 report, 5 opportunities, including `ads` and `whatsapp` arms both pointing at
the Oct/Nov gap with `valueAtRisk 100890`, plus a `page` arm for the dormant page.

## Arm 1 — WhatsApp

`campaignService.ts`, `campaignMessaging.ts`, `copywriter.ts`, `executionGateway.ts`.
Skills: `whatsapp-planner`, `whatsapp-copywriter`, `whatsapp-backfill`. Admin at `/admin/campaigns`.

**State:** 4 campaigns, 3 sent. Working, and the only arm that has completed a full cycle.

## Arm 2 — Ads

`adPlanner` (takes an `AdOpportunity`) → `adProposal` → `adCopywriter` → `adComposer` →
`adExecutionGateway` → Meta. Facts from `adPlannerPack`. Admin at `/admin/ads`.

Money gates: `GROWTH_ADS_ENABLED` + `GROWTH_ADS_MODE=live`, a per-campaign approval cap, a server
daily ceiling, and the account's own spend cap (750 RON, 111 spent).

Learning loop: `adReconciliation` mirrors Meta every 6h → `adOutcomes` freezes a record 14 days after
a campaign ends → `adLearnings` feeds the next pack.

**State:** 9 campaigns. 4 live, two of which were made in Ads Manager and adopted by reconciliation on
2026-09-09. `adOutcomes` is empty because nothing has settled yet — the first two settle 14 September.

## Arm 3 — Page posts

`pagePostWriter.ts`, `pagePublisher.ts`, `fortnightPlanner.ts`. Admin at `/admin/page-posts`.

**State:** 2 posts, `fortnightPlans` empty. Least exercised of the three.

## The season layer (built 2026-09-09)

`seasonPack` → `seasonAllocator` → `validateSeasonPlan` → `seasonPlanService`, plus the
`season-ad-planner` skill and `ad-doctrine.ts`.

It is NOT a fourth arm and must not become one. Its job is the year's SHAPE and MONEY: which windows
deserve budget, in what order, at what pace — and it feeds the ads console through
`SeasonSlotContext` at the two moments money is decided, the daily-budget field and the Go-live
dialog.

**State:** 1 plan, `draft`. `fetchSeasonSlotContextAction` reads `getActiveSeasonPlan`, so the seam
stays dark until a plan is activated.

## The substrate

- **Pricing**: `pricingPeriods` → `compilePeriods` → `priceCalendars`. Canonical season rules in
  `src/config/pricing-seasons.ts` resolve to dates per year. Priced to 2028-08-31.
- **Parity**: `channelPriceObservations` → `parityPositions` → a verdict per period. `losing` is a
  hard gate on advertising. Skills: `ota-parity` (our own listings), `competitive-position` (the
  comparable set).
- **Shared**: `signals.ts` (free runs, holidays) is read by both `situationPack` and `seasonPack`.
  `parityPositions` is read by `seasonPack`, `pricing-position` and the competitive skill.

## The seams — what is wired and what is dark

| seam | state |
|---|---|
| analyst → opportunities | wired |
| opportunity → ads draft (`approveOpportunityAction`) | wired — creates a real draft, keeps its own review |
| opportunity → page draft | wired |
| opportunity → WhatsApp | wired as a hand-off URL to `/admin/campaigns` (in-app planner deferred) |
| parity verdicts → season pack | wired |
| parity verdicts → ad planner pack | wired |
| learning loop → packs | wired, first data 14 Sept |
| season plan → ads console | wired, **dark**: needs an active plan |
| **analyst opportunities → season pack** | **not wired** |

## The two real problems

**1. The season planner and the analyst decide the same thing without talking.** The analyst routed
the Oct/Nov gap to ads with a parallel WhatsApp arm. The season planner independently picked its own
windows and never read that. Two brains, one decision. The season pack should read live
`opportunities` — at minimum as evidence, ideally so a window already routed to WhatsApp is not
separately funded for ads.

**2. Instrument routing is written twice.** `ad-doctrine.channelFit` says a near gap is a WhatsApp
job; `situationAnalystMethod` says the same thing with more nuance and a ledger check. One of them
should cite the other. The analyst's version is the better one and should be the source.

## What is deliberately NOT here

- The season layer does not write copy or pick cities — that is the per-campaign layer.
- The analyst does not set budgets — that is the season layer and the approval gates.
- No arm spends without the two switches, an approval cap and a human pressing Go live.
