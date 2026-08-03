# Promotion System Architecture — the RentalSpot Growth Brain

**Author:** Opus 4.8, from a full investigation of the codebase + a live read-only audit of the Meta account/page · 26 July 2026
**Status:** Agreed architecture — the umbrella that unifies WhatsApp reactivation, Meta ads, and the Facebook page under one intelligence layer. This is the durable source of truth; it **references, never re-copies** the detailed plans below.

**Companion documents (read for depth on each area):**
- `docs/meta-ads-infrastructure-2026.md` — verified external Meta facts + live-account contract spikes + the 26 Jul live audit (§11). *committed.*
- `docs/growth-ad-engine-plan.md` — the ads execution engine + the ads-intelligence build phases. *committed.*
- `plans/engagement-system.md` — the Opportunity Engine / WhatsApp arm, in full detail. *local-only (gitignored).*
- `plans/growth-engine.md` — the original locked decisions (Core/Brain planes, the seam). *local-only.*
- `docs/business/growth-engine-roadmap.md` — the business rationale. *local-only.*

**Memory pointers:** `growth-engine-core`, `engagement-system`, `meta-ads-page-live-state`.

---

## 0. The one idea, and the one sequencing decision

**One detector, many responses.** A property has *one* situation each week — the gaps, the pace, the RevPAR trend, the dormant page. That situation is diagnosed *once* by a shared analyst, which then routes each opportunity to the instrument that fits: a WhatsApp message to warm past guests, a Meta ad to strangers, an organic page post, a price change — or, explicitly, *nothing*.

**Build the intelligence before running the spend.** The execution machinery *and* the per-arm intelligence (the ads planner + creative, the WhatsApp copywriter) are now built and guarded (see §0.5). What is still missing is the *shared brain's runtime* — an in-app analyst + router that detects the situation and emits routed opportunities into those arms, rather than a human running a skill and hand-typing windows. We build that; live ad spend is a deliberate act taken only once the brain is trusted, not a default.

**The principle that governs every LLM stage:** *feed the model facts + method + constraints, never conclusions.* Guardrails constrain only **truth and margin**; relevance, presentation, voice, and per-target adaptation are the model's job. (Plan §2 principles 1 & 5.)

---

## 0.5 Current state — verified as-built (2026-08-03)

> Verified against the code (`file:line`) + a live Meta read. **This section is the single source of truth for what EXISTS vs what is still INTENT;** the design sections below (§2–§7) describe the *target*. Where an older claim in §2–§7 conflicts with this, this wins — those conflicts are corrected in place.

**Two arms are genuinely built, in-app, and coherent** (this is real, working code, not scaffolding):
- **Ads arm — end to end.** Deterministic pack → in-app LLM planner (`adPlanner.ts:123`) → in-app creative (`adCopywriter.ts`) → truth/money validators (`validateAdPlan.ts`, `validateAdCreative.ts`) → PAUSED Meta compose (`adComposer.ts`) → a real **generate → review-before-push → approve → activate** console (`src/app/admin/ads/actions.ts:492,665,277,348`) → a reconciliation cron that freezes outcomes and feeds `buildAdLearnings` back into the planner pack (`adReconciliation.ts:163` → `adPlannerPack.ts:111`). Two-switch spend gate + spend-cap math. Never run live.
- **WhatsApp arm.** In-app audience selection (`warmupAudience.ts`), in-app copywriter (`src/services/growth/copywriter.ts`), the full execution gateway (consent/suppression/dedup/frequency/active-booking gates, `executionGateway.ts:259`), the warmup cron, and the campaigns admin (Gate-1 review → Gate-2 wa.me).
- Plus: the vision/caption layer (`galleryVision.ts` + `caption-gallery` cron), a **manual** page-post drafting tool (`src/app/admin/page-posts`), in-app brand-health sensors (`brandHealth.ts`), and real two-switch config.

**The shared BRAIN is intent-only — it exists as a Claude skill + a CLI script + this doc, not as running code:**
- **No in-app analyst** — analysis happens only in the `.claude/skills/situation-analyst` skill, run by a human.
- **No in-app detector/router** — every `Opportunity.instrument` is a hardcoded literal set by its entry point (`src/app/admin/ads/actions.ts:526` for ads; `warmupAudience.ts:89` for WhatsApp). The residency predicate (`audience.ts:52`) exists but nothing calls it to route. `PageOpportunity` has zero producers.
- **The fact pack is a CLI** (`scripts/situation-pack.ts`), not a service — nothing in `src/` imports it. The two routing signals it computes (`inventory.recentCancellations`, `outreachHistory.pastCampaigns.bookedWithin120d`) live **inline in that script**.
- **No `POST /api/growth/ad-proposals` seam** — the console calls the ads intelligence in-process (`generateAdProposalAction` → `planAndCreative`) instead.

**So:** the arms the brain would drive are built and operator-triggered; the *"one shared brain that routes across arms"* is the remaining build. It is short because the `Opportunity` contract and the arm-side seams (e.g. `planAndCreative(opportunity)`) were built ahead of it. The build order in §7 is therefore now: **give the brain a runtime** — sensors-as-a-lib → an in-app analyst service that emits routed opportunities → a `/admin` surface where the owner approves → hand-off to these already-built arms.

---

## 1. The business problem this serves

Measured in `plans/engagement-system.md` §0 (2026-07-22): a three-year decline, RevPAR −40% in 2026, driven by an **acquisition** collapse (new-guest bookings 39→34→18) as foreign waves faded and OTA rate rises cut ranking. The recovery target is ~65 more nights this year. The instruments split by who delivers them:

- **OTA rate/ranking recovery** — the largest single block (owner + OTA action).
- **Meta ads — ~30–75 nights** — rebuild acquisition; reach strangers. *The lever this architecture most enables.*
- **WhatsApp reactivation — ~15–25 nights/yr** — the best-*margin* nights (direct ADR 719 vs Airbnb 588 + commission saved), but a scalpel, not an engine: ~130 warm RO guests, finite goodwill.
- **Calendar hygiene** — immediate, unblock bookability.

Acquisition is the constraint, and acquisition is ads + a live brand page. That is why finalizing the ads/page intelligence is aligned with the real revenue problem, not a side quest.

---

## 2. The architecture — one brain, many arms

```
  SENSORS ─────────────────────────────► ANALYST ──► ROUTER ──►  ARM (per instrument)
  (deterministic facts, no conclusions)   (LLM over    (audience-
                                           the facts)   math)
  ┌─ inventory / pace / calendar ─┐                          ┌─ WhatsApp: planner → copywriter → wa.me   [BUILT*]
  ├─ audience segments / dueNow ──┤                          ├─ Ads: ad planner → creative/copy → activate [BUILT]
  ├─ acquisition / market ────────┤                          ├─ Page: post → manual publish [BUILT (manual); auto-publish TO BUILD]
  └─ Facebook page health ────────┘                          └─ price / min-stay / OTA / do-nothing (human)
```
`SENSORS → ANALYST → ROUTER` is the intended **spine**; today it is **not yet in-app** — the analyst + router live in the `situation-analyst` skill over a CLI pack (see §0.5), and each arm's `instrument` is hardcoded by its entry point. `[BUILT*]` = the WhatsApp *copywriter* is in-app but its *gap-planner* is still skill+CLI. Each **arm** is a per-instrument planner → generator → guarded execution gateway; the WhatsApp arm is the reference the ads/page arms copy.

| Layer | Shared? | Status (verified — §0.5) |
|---|---|---|
| Sensors (`situation-pack.ts`) | shared | Built, incl. acquisition + page-health sensors — but as a **CLI script**, not an in-app service |
| Analyst (`situation-analyst` skill) | shared | Built as a **Claude skill only**; no in-app analyst service |
| Router / instrument choice | shared | **Intent-only** — lives in the analyst skill's reasoning; no in-app router (every `instrument` is a hardcoded literal) |
| Opportunity contract (`contracts.ts`) | shared | Built — the `whatsapp\|ads\|page` union **already shipped** (`contracts.ts:22`); it just has no automated producer |
| WhatsApp planner + copywriter + validators | arm | Copywriter + validators **built in-app**; gap-**planner** is still skill + `planner-pack.ts` |
| Ads planner + creative/copy intelligence | arm | **Built in-app** (`adPlanner.ts`, `adCopywriter.ts`, validators, review-before-push, learning loop, reconcile cron) |
| Page post planner + composer | arm | Manual **draft** tool built (`admin/page-posts`); opportunity-routed planner + auto-publish **to build** (+ token scopes) |
| Execution gateways (message / ads / page) | arm | Message + ads gateways built; page = manual wa.me-style hand-post (no gateway) |

---

## 3. The shared brain

### 3.1 Sensors — what the system watches (`scripts/situation-pack.ts` — today a CLI, to become a lib)
Pure functions over Firestore + the clock. Built: `performance` (occupancy/ADR/RevPAR, like-for-like YTD), month baselines, channel/origin mix, `inventory` (gaps, **orphan nights**, unsellable-under-min-stay, named periods, **`recentCancellations`**), `audience` (segments, `dueNow`, return clock), **`outreachHistory` (per-run reply + `bookedWithin120d` conversion)**, `dataQuality` (provenance + caveats). Both sensors below are now **built and wired** (`brandHealth.ts`, consumed by `situation-pack.ts` + `adPlannerPack.ts`):
- **Acquisition/market sensor** — past ad performance (from the ad account: CTR/CPC/spend history), pixel pool size, seasonal demand signals. Tells the analyst whether an acquisition play is warranted and what has worked.
- **Facebook page-health sensor** — is the page alive (last post date, engagement trend), profile correctness (e.g. the website-link-to-Airbnb leak), audience. A dormant page is itself a flagged opportunity.

> Note: this whole pack is a **CLI script** today, not an in-app service. Extracting it (and its two routing signals) into `src/lib/growth/` is the first move toward the in-app brain (§7).

### 3.2 The analyst — an LLM over the facts (`.claude/skills/situation-analyst`)
Not a rules engine. It reads the pack and produces a **Situation Report** (headline → flags ranked by money at risk → opportunities with instrument + why → an explicit NORMAL section → questions → confidence). It **never computes** (every number is cited from the pack) and **never sends or spends**. Crucially, its instrument list is *"a menu, not a mapping"* — it already includes **Ads** (*"reaches strangers; scales with budget; hand over as a dated, sized proposal"*). So detection and the WhatsApp-vs-ads decision already live in this one shared reasoner. **This is why we extend it, never fork a second ads analyst** — a fork would duplicate the identical sensors and diagnosis and could disagree with itself.

### 3.3 The Opportunity — the one shape everything shares (`src/lib/growth/contracts.ts`)
`Opportunity` = `{ id, propertyId, source, window{start,end,nights}, daysOut, occasion?, valueAtRisk?, instrument, rationale }`. **The `instrument: 'whatsapp' | 'ads' | 'page'` union is already shipped** (`contracts.ts:22`), with narrowed `WhatsAppOpportunity`/`AdOpportunity`/`PageOpportunity` subtypes (`:44-46`), so a matching planner can consume a routed opportunity — the ads seam already does (`planAndCreative(opportunity: AdOpportunity)`). **What's still missing is the *producer*:** nothing emits a *routed* opportunity yet — every `instrument` is hardcoded by its entry point, and `PageOpportunity` has no producer at all. Building that producer (the in-app router) is the point of §7.

### 3.4 Routing — audience-math-driven, "both" allowed
This is the intended routing *logic* — today it lives in the analyst **skill's reasoning**, not in an in-app router (§0.5); building the in-app router that applies it is §7. The split draws on the analyst's standing constraint (*"WhatsApp targets Romanian guests; foreign demand is an ads or OTA matter"*) plus `src/lib/growth/audience.ts` (`isRomaniaBased` / `classifyResidency` → **domestic / diaspora / foreign**) — a predicate that exists in code but is **not yet called to route**. For a detected gap the router reasons: the **warm RO/diaspora/repeat** slice → WhatsApp; the **residual/strangers/foreign** slice → ads; a **silent brand page** → an organic post. *Often the answer is several arms for the same gap, to different people* — that is the cohesion, and only one shared analyst keeps it coherent.

**A window's character is a prior, not a verdict.** Detection and routing are deliberately separate: one detector surfaces the window; the router chooses the instrument, and it treats the window's character (warmth, occasion, nearness) as a prior only. Before selecting, the router reads two outcome streams — recent outreach results (a lever recently fired that produced ≈zero *new bookings* — `outreachHistory.pastCampaigns.bookedWithin120d`, which counts only bookings made after the run, not pre-existing reservations — is *spent* for that window: escalate, don't repeat) and forward cancellations (sold-then-cancelled inventory is simultaneously re-opened supply and fresh demand-softness evidence, raising urgency and shifting selection toward broader instruments — `inventory.recentCancellations`). The same gap can therefore route to different levers in different weeks: eligibility is a function of recorded history under current conditions, not of the window's character alone.

---

## 4. The channel arms

### 4.1 WhatsApp — the reference implementation (BUILT, live in prod)
`analyst → planner (`whatsapp-planner` skill + `planner-pack.ts`) → copywriter (`copywriter.ts`, Opus, in-app) → land (`createProposedCampaign`) → /admin/campaigns Gate-1 review → outbox → Gate-2 wa.me`. Guardrails: `validatePlan` (narrows-never-widens · run cap · offer ceiling) and `validateDrafts` (grounding · voice · self-ID · opt-out · sentiment). Ban-safe: the server never touches WhatsApp; the owner one-taps `wa.me`. This arm is the template the other two copy.

### 4.2 Ads — arm fully built (intelligence + review-before-push + learning); only the *automated* hand-off is missing
As of 2026-08-03 the ads arm is the **most complete** part of the system — both execution and intelligence:
- **Built — execution** (`src/services/growth/metaAds/*`, `adComposer`, `adExecutionGateway`, `/admin/ads`): the whole PAUSED create→approve→activate→pause→insights chain, two-switch spend gate, ownership asserts, spend-cap math, audit log — see `docs/growth-ad-engine-plan.md`.
- **Built — the intelligence** (the twin of the WhatsApp arm, now real): the **ad planner** (`adPlanner.ts`) over an ad-planner-pack (`adPlannerPack.ts` — geo candidates, budget ceiling, opportunity value, past-ad performance + `buildAdLearnings`) → an ad-brief validator (`validateAdPlan.ts`, spend-cap + geo "narrows-never-widens"); the **ad creative** (`adCopywriter.ts`) grounded in real gallery photos (+ `aiDescription`) + asset-gap declarations, validated for truth + public brand voice (`validateAdCreative.ts`); the composer produces a PAUSED draft.
- **Built — the console**: `/admin/ads` is the framing → generate → **review-before-push** → approve → activate workspace (`generateAdProposalAction` lands a Firestore-only draft; `pushAdToMetaAction` is the first Meta touch; go-live is gated). A **learning loop** freezes per-campaign outcomes (`adOutcomes.ts`) and feeds them back into the pack; the `ad-reconcile` cron is the durability backstop.
- **Still missing — the *automated* hand-off only.** The console is operator-initiated (a human types the window/framing). The `POST /api/growth/ad-proposals` seam does **not** exist; the console calls `planAndCreative` in-process. The real remaining ads work is upstream: an **in-app analyst/router** that emits a routed `AdOpportunity` into this arm automatically (§0.5, §7) — plus the deliberate go-live.

### 4.3 The Facebook page — sensor AND instrument (NEW; needs a token grant)
The page (`ComarnicChalet`, 552 followers) is a real, **dormant** asset the system should both understand and keep alive.
- **As a sensor** (§3.1): page health, post performance, audience — a corpus for voice + what-to-promote, and a flag when it goes quiet.
- **As an instrument**: an organic-post planner + composer → **draft → owner approves → publish**, under the same gate discipline as ads/WhatsApp. Never auto-post; content guardrail = truth + real assets + the owner's brand voice.
- **Provisioning boundary** (from the 26 Jul live audit): reading the page *profile + aggregate insights* works today; reading *post content* + Instagram + *posting* needs added token scopes (`pages_read_user_content`, `pages_manage_posts`, `instagram_*`) + a `CREATE_CONTENT` page task. See `docs/meta-ads-infrastructure-2026.md` §11 and the provisioning checklist there.
- **Immediate free win** (no token change): the page's `website` field points at `airbnb.com/rooms/43265214` — change it to `prahova-chalet.ro` to stop leaking direct-booking margin.

### 4.4 Non-campaign instruments (the analyst must be able to propose these)
Price change, minimum-stay change, length-of-stay discount, OTA action, and **do nothing (with a reason)**. A system that never says "this is normal" can't be trusted when it says "this isn't."

---

## 5. The shared patterns — what makes it cohesive

### 5.1 Corpus voice-learning — one voice, per-surface register
The copywriter learns the owner's voice from a **real, outcome-labeled corpus**, not a description (`copywriterPack.ts`: the owner's own outbound, tagged booked/replied/silent, ranked toward what booked). The same method extends across channels **with a different corpus per surface**:
- **WhatsApp** → the private, warm 1:1 register (*tu/voi*, self-ID) from WhatsApp threads.
- **Ads + page** → a **public brand voice**, learned from the best-performing past ad copy + the page's best posts. Same method (learn from real, outcome-weighted content; ground every claim; validate) — different corpus, so each channel sounds right for its context while all stay unmistakably the owner. *Things to promote* likewise draw on which page posts/photos and which ad angles actually resonated (the account's historical CTR was 6.7% — the instincts worked).

### 5.2 Grounding + validators — truth and margin in code
Every LLM stage declares the facts it used; a pure validator checks them against a whitelist and rejects anything ungrounded (`validateDrafts`: `factsUsed ⊆ groundedFacts`; `validatePlan`: eligible-set + cap + offer ceiling). A bounded repair loop feeds errors back once. The LLM owns intelligence; code owns truth + margin.

### 5.3 Two-gate review + guarded execution
Every channel: create/compose is safe by default and nothing goes live without a human gate. WhatsApp: Gate-1 review → Gate-2 wa.me. Ads: PAUSED-by-default + `GROWTH_ADS_ENABLED` + `GROWTH_ADS_MODE=live` two-switch + operator approve → activate. Page: draft → approve → publish. **Emergency stop is the Pause/limit, never the env switch (a deploy).**

### 5.4 Facts + method + constraints, never conclusions
The governing principle for every pack and prompt (§0). Validate via the strip test: remove any planted conclusion, re-run cold; what survives is real reasoning.

---

## 6. Locked design decisions (26 Jul 2026)

1. **One shared analyst — extend, never fork.** (Decision.) The analyst reasons over a menu and the RO/stranger split predicate exists (`audience.ts:52`) — but note per §0.5 this routing lives in the *skill*, not in code; the in-app router is the thing §7 builds. The decision stands: one analyst, extended — not a second ads analyst.
2. **Ad planner + creative intelligence run in-app** (like the copywriter's "Generate"), landing PAUSED drafts into `/admin/ads`. ✅ **Done** (§4.2).
3. **Facebook page = sensor + instrument.** Read now (profile + aggregate health); posts/IG/publishing after a one-time token grant.
4. **Creative: real photos first** (asset_feed_spec crops); external generation (people/relight) is a later phase.
5. **Admin symmetry:** `/admin/ads` becomes framing → generate → Gate-1 review → guarded activate.
6. **One public brand voice** for ads + page, distinct from the private WhatsApp voice; same corpus-learning method.

---

## 7. Build order (value-first, lowest-risk first)

Original order (26 Jul), now annotated with verified status (§0.5):
1. **Page understanding + the two free fixes** — page/ad-history sensors + "page dormant" flag. ✅ **Sensors built** (`brandHealth.ts`); Airbnb-link fix = owner action (§8).
2. **Generalize the Opportunity contract** + make the analyst emit typed opportunities. ◐ **Contract done** (`contracts.ts:22`); **the analyst emitting routed opportunities is NOT built** — this is the core of the remaining work.
3. **Ad planner** — routed opportunity → PAUSED ad draft. ✅ **Built** (`adPlanner.ts`), currently fed by the operator console rather than an automated router.
4. **Ad creative/copy intelligence + the `/admin/ads` redesign.** ✅ **Built** (`adCopywriter.ts` + review-before-push console).
5. **Organic page instrument** (after token grant) — draft → approve → publish. ◐ **Manual draft built**; auto-publish pending a token grant (§8).
6. **Reconciliation cron + go-live.** ✅ **Reconcile cron built** (`ad-reconcile`); go-live = a deliberate owner act (still off).

**Remaining build — "give the brain a runtime"** (the value-first sequence, replacing what's left of steps 2/5/6):
- **M1.** Extract the fact pack + its two routing signals from `scripts/situation-pack.ts` into `src/lib/growth/` (pure refactor; makes them importable by any arm).
- **M2.** An **in-app analyst service** (shape of `adPlanner.ts`): pack → LLM → typed `SituationReport` + routed `Opportunity[]` → a report validator (enforces in code what the skill enforces in prose) → land into Firestore + a minimal `/admin` surface (report + opportunities + approve/dismiss). *This is the move that makes "the analyst routes in code" true.*
- **M3.** Wire **Approve → the existing arm** (ads: the routed `AdOpportunity` flows into `planAndCreative`; WhatsApp: framing lands in the campaigns flow).
- **M4.** Feed the two ledgers into the **arm** packs (`adPlannerPack`, the WhatsApp planner pack) so the routing doctrine fires even when no human runs the ritual.
- **M5.** A weekly cron + owner notification. **M6.** Migrate the WhatsApp gap-planner in-app (same pattern), retiring the CLI from the production path.

The **skills** (`situation-analyst`, `whatsapp-planner`) do not get thrown away — after M2 they become the *interactive console* (backtests, deep-dives) over the same lib-built pack. Do not build a later move before an earlier one proves out.

---

## 8. Provisioning & backstops (owner actions, not code)

- **Token scopes for the page** — add `pages_read_user_content`, `pages_manage_posts`, `instagram_*` + a `CREATE_CONTENT` page task; regenerate the system-user token into the `META_ADS_TOKENS` secret. Needed only for reading posts + Instagram + posting; do it in one batch. Detail: `docs/meta-ads-infrastructure-2026.md` §11.
- **Account spend limit** — Meta `spend_cap` is currently `0`; set an account-level limit in Ads Manager before any live spend. This is the platform backstop that survives our bugs/dead tokens.
- **Page website link** — change from the Airbnb URL to `prahova-chalet.ro`.

---

## Appendix — which document owns what (no duplication)

| Concern | Home |
|---|---|
| Whole-system architecture, the brain, the arms, shared patterns, decisions, build order | **this file** |
| Verified external Meta facts, API contracts, live-account + page + token audit | `docs/meta-ads-infrastructure-2026.md` |
| Ads execution engine + ads-intelligence build phases + go-live runbook | `docs/growth-ad-engine-plan.md` |
| WhatsApp arm in full (opportunity engine, planner, copywriter, gates) | `plans/engagement-system.md` *(local)* |
| Original locked decisions (Core/Brain planes, the seam) | `plans/growth-engine.md` *(local)* |
| Business rationale / roadmap | `docs/business/growth-engine-roadmap.md` *(local)* |
