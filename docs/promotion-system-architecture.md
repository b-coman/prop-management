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

**Build the intelligence before running the spend.** The execution machinery on every channel is already built and guarded. What is missing is the *brain* that decides and composes. We build that first; live ad spend is a deliberate act taken only once the brain is trusted, not a default.

**The principle that governs every LLM stage:** *feed the model facts + method + constraints, never conclusions.* Guardrails constrain only **truth and margin**; relevance, presentation, voice, and per-target adaptation are the model's job. (Plan §2 principles 1 & 5.)

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
  ┌─ inventory / pace / calendar ─┐                          ┌─ WhatsApp: planner → copywriter → wa.me   [BUILT]
  ├─ audience segments / dueNow ──┤                          ├─ Ads: ad planner → creative/copy → activate [TO BUILD]
  ├─ acquisition / market  [new] ─┤                          ├─ Page: post planner → composer → publish   [TO BUILD]
  └─ Facebook page health  [new] ─┘                          └─ price / min-stay / OTA / do-nothing (human)
```

The **spine** (sensors → analyst → router) is shared and channel-agnostic. Each **arm** is a per-instrument planner → generator → guarded execution gateway. The WhatsApp arm is the fully-built reference implementation; the ads and page arms reuse its exact shape.

| Layer | Shared? | Status |
|---|---|---|
| Sensors (`situation-pack.ts`) | shared | Built (inventory/pace/audience); **new: acquisition + page-health sensors** |
| Analyst (`situation-analyst` skill) | shared | Built — LLM over facts; **already routes to ads** as a menu item |
| Router / instrument choice | shared | Built into the analyst's reasoning (a menu, not a rules table) |
| Opportunity contract (`contracts.ts`) | shared | Built — **but `instrument` is WhatsApp-only today; generalize to `whatsapp\|ads\|page`** |
| WhatsApp planner + copywriter + validators | arm | **Built, live in prod** |
| Ads planner + creative/copy intelligence | arm | **Missing** (execution console exists; no brain) |
| Page post planner + composer | arm | **Missing** (+ needs token scopes) |
| Execution gateways (message / ads / page) | arm | Message + ads gateways built; page gateway new |

---

## 3. The shared brain

### 3.1 Sensors — what the system watches (`scripts/situation-pack.ts`)
Pure functions over Firestore + the clock. Today: `performance` (occupancy/ADR/RevPAR, like-for-like YTD), month baselines, channel/origin mix, `inventory` (gaps, **orphan nights**, unsellable-under-min-stay, named periods), `audience` (segments, `dueNow`, return clock), `dataQuality` (provenance + caveats). **To add:**
- **Acquisition/market sensor** — past ad performance (from the ad account: CTR/CPC/spend history), pixel pool size, seasonal demand signals. Tells the analyst whether an acquisition play is warranted and what has worked.
- **Facebook page-health sensor** — is the page alive (last post date, engagement trend), profile correctness (e.g. the website-link-to-Airbnb leak), audience. A dormant page is itself a flagged opportunity.

### 3.2 The analyst — an LLM over the facts (`.claude/skills/situation-analyst`)
Not a rules engine. It reads the pack and produces a **Situation Report** (headline → flags ranked by money at risk → opportunities with instrument + why → an explicit NORMAL section → questions → confidence). It **never computes** (every number is cited from the pack) and **never sends or spends**. Crucially, its instrument list is *"a menu, not a mapping"* — it already includes **Ads** (*"reaches strangers; scales with budget; hand over as a dated, sized proposal"*). So detection and the WhatsApp-vs-ads decision already live in this one shared reasoner. **This is why we extend it, never fork a second ads analyst** — a fork would duplicate the identical sensors and diagnosis and could disagree with itself.

### 3.3 The Opportunity — the one shape everything shares (`src/lib/growth/contracts.ts`)
`Opportunity` = `{ id, propertyId, source, window{start,end,nights}, daysOut, occasion?, valueAtRisk?, instrument, rationale }`. **Today `instrument` is the literal `'whatsapp'`** — the typed pipeline is WhatsApp-only by construction. **The core generalization this architecture requires: `instrument: 'whatsapp' | 'ads' | 'page'`** (or a discriminated union), so the analyst can route an opportunity to ads or the page and a matching planner can consume it — exactly as the WhatsApp planner consumes a whatsapp-routed one.

### 3.4 Routing — audience-math-driven, "both" allowed
The split is already encoded: the analyst's standing constraint (*"WhatsApp targets Romanian guests; foreign demand is an ads or OTA matter"*) plus `src/lib/growth/audience.ts` (`isRomaniaBased` / `classifyResidency` → **domestic / diaspora / foreign**). For a detected gap the router reasons: the **warm RO/diaspora/repeat** slice → WhatsApp; the **residual/strangers/foreign** slice → ads; a **silent brand page** → an organic post. *Often the answer is several arms for the same gap, to different people* — that is the cohesion, and only one shared analyst keeps it coherent.

**A window's character is a prior, not a verdict.** Detection and routing are deliberately separate: one detector surfaces the window; the router chooses the instrument, and it treats the window's character (warmth, occasion, nearness) as a prior only. Before selecting, the router reads two outcome streams — recent outreach results (a lever recently fired that converted ≈zero stays is *spent* for that window: escalate, don't repeat — `outreachHistory.pastCampaigns`) and forward cancellations (sold-then-cancelled inventory is simultaneously re-opened supply and fresh demand-softness evidence, raising urgency and shifting selection toward broader instruments — `inventory.recentCancellations`). The same gap can therefore route to different levers in different weeks: eligibility is a function of recorded history under current conditions, not of the window's character alone.

---

## 4. The channel arms

### 4.1 WhatsApp — the reference implementation (BUILT, live in prod)
`analyst → planner (`whatsapp-planner` skill + `planner-pack.ts`) → copywriter (`copywriter.ts`, Opus, in-app) → land (`createProposedCampaign`) → /admin/campaigns Gate-1 review → outbox → Gate-2 wa.me`. Guardrails: `validatePlan` (narrows-never-widens · run cap · offer ceiling) and `validateDrafts` (grounding · voice · self-ID · opt-out · sentiment). Ban-safe: the server never touches WhatsApp; the owner one-taps `wa.me`. This arm is the template the other two copy.

### 4.2 Ads — execution built, intelligence missing (THE main build)
**Built** (`src/services/growth/metaAds/*`, `adComposer`, `adExecutionGateway`, `/admin/ads`): the whole PAUSED create→approve→activate→pause→insights chain, two-switch spend gate, ownership asserts, spend-cap math, audit log — see `docs/growth-ad-engine-plan.md`. **Missing** — the *brain*, which is the twin of the WhatsApp arm:
- **Ad planner** (twin of `whatsapp-planner`): an ad-planner-pack (geo/interest candidates, budget ceiling `MAX_DAILY_BUDGET_MINOR`, the opportunity's nights/value, past-ad performance, page-best content) → LLM sizes targeting + budget + angle + creative brief → an ad-brief validator (spend-cap math, geo sanity) → a **PAUSED `adCampaigns` draft** landed into `/admin/ads` for Gate-1 review. `narrows-never-widens` becomes "narrows targeting/budget against candidates"; the offer-ceiling guard becomes the spend-cap guard.
- **Ad creative/copy intelligence** (twin of the copywriter): grounded in real gallery photos + best-performing past ad copy + the page's best posts; writes ad primary-text/headline/CTA and picks photos; validated for truth (no invented amenities) and the **public brand voice** (see §5.1). Feeds the existing composer.
- **The hand-off**: `POST /api/growth/ad-proposals` — the analyst→ads seam that lands a proposal into the console (mirrors `land-campaign.ts` → `/admin/campaigns`).
- **Admin symmetry**: reshape `/admin/ads` from a blank compose form into the campaigns-workspace pattern — **framing → "Generate ad" → Gate-1 review → guarded activate**.

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

1. **One shared analyst — extend, never fork.** Confirmed in code: the analyst already routes to ads over a menu; the RO/stranger split predicate exists.
2. **Ad planner + creative intelligence run in-app** (like the copywriter's "Generate"), landing PAUSED drafts into `/admin/ads`.
3. **Facebook page = sensor + instrument.** Read now (profile + aggregate health); posts/IG/publishing after a one-time token grant.
4. **Creative: real photos first** (asset_feed_spec crops); external generation (people/relight) is a later phase.
5. **Admin symmetry:** `/admin/ads` becomes framing → generate → Gate-1 review → guarded activate.
6. **One public brand voice** for ads + page, distinct from the private WhatsApp voice; same corpus-learning method.

---

## 7. Build order (value-first, lowest-risk first)

1. **Page understanding + the two free fixes** — ingest readable page data (profile + aggregate insights) + the ad-history sensor; surface "page dormant" and fix the Airbnb link. No provisioning.
2. **Generalize the Opportunity contract** (`instrument: 'whatsapp' | 'ads' | 'page'`) + make the analyst's ads/page routing emit typed opportunities.
3. **Ad planner** — routed opportunity → PAUSED ad draft into the console (twin of the WhatsApp planner).
4. **Ad creative/copy intelligence** — grounded in photos + best past-ad copy + page best posts; the `/admin/ads` framing→generate→review redesign.
5. **Organic page instrument** (after the token grant) — draft → approve → publish.
6. **Reconciliation cron + go-live** — the durability backstop (see ads plan), set the account spend limit, then run the first real ad as a deliberate act.

Do not build a later step before an earlier one proves out. Each arm reuses the WhatsApp arm's shape, so none is a from-scratch build.

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
