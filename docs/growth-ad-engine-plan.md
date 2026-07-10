# Growth Ad Engine — Implementation Plan (Core)

**Author:** Opus 4.8, with full context of the design discussion · 9 July 2026
**Status:** v2 — reconciled after Fable adversarial review (§9, §10, §12, §13 revised). Companion to `docs/meta-ads-infrastructure-2026.md` (verified Meta infra) and the local driver `plans/growth-engine.md`. **Two structural changes drive everything: (1) prove one ad manually before building the factory (§9 Phase 0.5); (2) build the STOP side before the START side (§13).**

---

## 1. Goal
Close the **paid-acquisition loop** on Core so ad spend produces *measurable direct bookings*:

```
segment (guests) → Custom/Lookalike audience → campaign+adset+ad+creative (PAUSED)
→ operator approves → activate → Meta delivers → insights (spend) → ROAS (spend ÷ attributed bookings)
```

The **measurement half is already done** (Pixel + CAPI, per-property, deduped). This plan builds the **management half**: create/sync/activate ads and read results back.

**Principle (locked):** build **multi-tenant-shaped, proven on one property**. Beautiful for Prahova now; tenant #2 = config + a token, no rip-out. No onboarding/billing/self-serve yet.

---

## 2. Where it lives (decided)
- **Core, this codebase, as a clean `growth` module** — NOT a separate project. The engine is data-cohesive with bookings/guests/conversions; the real separation (decisioning) is already the OpenClaw brain. Modular monolith → extractable later only if we ever sell ads-as-a-service to properties *not* on this booking platform.
- **Meta interface = raw Marketing API from Node** (v25). We set `status: PAUSED` ourselves (replicates the CLI's one safety property). NOT the Python Ads CLI (VM-/single-token-shaped). Hosted MCP reserved for the conversational brain later.
- **Module namespace:** `src/services/growth/*` (ads), `src/app/admin/ads/*` (operator console + ROAS), `src/app/api/growth/*` (agent proposals). Reuse existing `segmentService`, `executionGateway`, `meta-capi`, `BookingAttribution`.

---

## 3. Business-model shape (agency-first)
Most future clients will **not** own their Meta ad account — the likely model is **agency**: one agency Business Manager holds an ad account **per property**, managed by **one/few shared system-user token(s)**. So resolution is NOT per-tenant-token; it's:

**Per-property ad config** (extends the `analytics` config we already have):
```
property.analytics.meta = {
  pixelId,            // done (metaPixelId today — fold in here)
  adAccountId,        // "act_<id>" — the property's ad account
  tokenRef,           // key into a secret map; may be shared "agency" or property-own
}
```
- **Prahova (now):** its own BM "Comarnic Mountain Chalet", account "Bogdan-Comarnic", own token → `tokenRef: "prahova"` in `META_ADS_TOKENS` secret.
- **Agency client (later):** agency-owned account, `tokenRef: "agency"` → same shared token manages many accounts.

Tokens live in a per-ref JSON secret `META_ADS_TOKENS = { "<ref>": "<system-user-token>" }` (mirrors `META_CAPI_TOKENS`). CAPI tokens stay separate (already deployed).

---

## 4. Data model
Reuse `segments`, `messageLog`, `suppressionList`, `campaigns` (WhatsApp). New:
- **`adCampaigns`** — `{ id, propertyId, segmentId, metaCampaignId?, metaAdSetIds[], metaAdIds[], audienceRef?, objective:'OUTCOME_SALES', dailyBudget, spendCap, status: draft|pending_approval|approved|active|paused|failed, creativeRef?, approvedBy?, insights?{spend,impressions,clicks,bookings,roas}, lastSyncedAt, createdAt, updatedAt }`
- **`customAudiences`** — `{ id, propertyId, metaAudienceId, sourceSegmentId, type:'custom'|'lookalike', size?, lastSyncedAt }`
- **`creatives`** (from the driver §5) — copy variants + image refs, `aiLabeled`, provenance, approval. (Phase 3.)
- Firestore rules: admin/operator read, `write:false` (Admin SDK only). Indexes: `adCampaigns(propertyId, status)`, `adCampaigns(propertyId, lastSyncedAt)`.

---

## 5. Meta integration layer (`src/services/growth/metaAds/*`)
A thin, well-tested Marketing-API client. **Every write sets `status: PAUSED`.** Every call resolves `(adAccountId, token)` from the property's config — **never a global**. Functions:
- `resolveAdContext(propertyId) → { adAccountId, token } | null` (cached; no-op if unconfigured → multi-tenant isolation, same discipline as the pixel).
- **Audiences:** `syncCustomAudience(propertyId, segmentId)` (hash via existing `hashForMeta`, upload), `createLookalike(propertyId, sourceAudienceId, spec)`.
- **Campaign build:** `createCampaign` / `createAdSet` (targeting: audience + geo/interest) / `createAdCreative` / `createAd` — all PAUSED, budget + **hard spend cap** required.
- **Activation:** `activateCampaign(propertyId, metaCampaignId)` — the ONLY call that un-PAUSEs; routes through the **Execution Gateway** (audit + caps + operator-approval check).
- **Insights:** `getInsights(propertyId, metaCampaignId, dateRange) → {spend, impressions, clicks}`.
- Errors: typed, logged (`loggers.tracking`/new `ads` namespace); never throw into the booking path.

Make the existing inert stubs real: `metaAudienceService.syncCustomAudience`, `metaAdsService.getCampaignInsights` fold into this module.

---

## 6. The operator console + ROAS (`src/app/admin/ads`)
An **internal operator surface** (one operator, many properties — not per-owner self-serve):
- **Proposals queue:** campaigns in `pending_approval` (from the brain or created manually) → shows audience (count + reachable), targeting, creative preview, **daily budget + spend cap** → **Approve** (activates via gateway) / Reject.
- **Active campaigns:** status, spend, and **ROAS by campaign/property** — spend (from insights) ÷ attributed direct bookings (join `BookingAttribution.fbclid/utm` + CAPI Purchases). Judge by *attributed bookings*, not clicks.
- Property-scoped via `PropertyUrlSync`; super-admin/operator gated; server actions `'use server'` async-only.

---

## 7. The brain seam (agent API)
Brain proposes; Core executes. `POST /api/growth/ad-proposals` (scoped agent token): `{ propertyId, segmentId, objective, dailyBudget, spendCap, creativeDraft }` → creates an `adCampaigns` doc in `pending_approval` (PAUSED in Meta). Operator approves → activate. One brain serves N tenants (reads each via agent API; holds no secrets). Creative generation (image+copy) is brain-side (AI) — Phase 3.

---

## 8. Guardrails (non-negotiable)
- **PAUSED-by-default** on every create; only `activateCampaign` un-PAUSEs, and only via the gateway after operator approval.
- **Hard spend cap** required on every campaign (reject creation without one).
- **Per-property token/account isolation** — resolve from config; a call for property A can never touch property B's account. (Same test discipline as the pixel: "no-op / no cross-property.")
- **Autonomy starts at `operator-approves-everything`.** No auto-spend.
- **Audit:** every activate/spend-affecting action → audit log.
- **Secrets:** `META_ADS_TOKENS` in Secret Manager; never in repo/property doc (public).

---

## 9. Build phases + model allocation (REVISED after Fable review — H6)
**Prove manually before building the factory.** My own infra doc (§8) says: run a first ad manually → measure → *then* automate. The original phasing violated that. Corrected:

**Phase 0.5 — MANUAL proof (OWNER, ~1 week, near-zero code) — DO FIRST:**
- Provision Meta (per revised §10). Create **one small interest+geo campaign manually in Ads Manager**, landing URL stamped `?utm_source=facebook&utm_campaign=<label>`.
- Existing Pixel/CAPI/`BookingAttribution` measure it. Goal: **prove ads → bookings at Prahova's budget BEFORE building automation** (and give Phase 1 real data to read). Might reveal it doesn't pay — cheapest possible time to learn.

**Phase 0 — config + stop-side scaffolding (small code, no ad-writes):**
- Per-property ad config (`{adAccountId, pixelId, pageId, instagramActorId, tokenRef}`) + `resolveAdContext` (cached, **shared-token isolation-tested**, H2).
- `META_ADS_TOKENS` secret + `GRAPH_API_VERSION` consolidation (L2) + `adExecutionGateway` + env switches `GROWTH_ADS_ENABLED`/`GROWTH_ADS_MODE` default-off (H5).
- Central Meta request builder that injects `status:PAUSED` unconditionally + Bearer-header auth (C2, M5). `pauseCampaign`/`pauseAllForProperty` FIRST (C1). Account-level spending limit as platform backstop (C1).

**Phase 1 — API contract spike + insights (needs token):** a throwaway script exercising each real call against Prahova's account (H4: `special_ad_categories`, `promoted_object`, creative flow, CA ToS, Lookalike floor) BEFORE coding §5 for real. Then `getInsights` reading the Phase-0.5 manual campaign (real data). **No audience layer** (cut — M1).

**Phase 2 — ad creation + activation + stop/reconcile (needs token):** `createCampaign/AdSet/Creative/Ad` (PAUSED, post-create read-back verify, C2) with `promoted_object`+pixel (H4) and `utm_campaign=<adCampaigns.id>` on the creative link (H1). Operator approve (snapshots budget/cap) → `activateCampaign` via `adExecutionGateway`. **Reconciliation cron** (effective_status, REJECTED/WITH_ISSUES, drift → re-approval; catches escapes — C2/M2/M4). DoD includes: **operator pauses it and delivery stops.**

**Phase 3 — creative + full loop:** brain-side creative, agent proposal endpoint (moved here — its consumer lives here, not Phase 0), brain→propose→approve→execute, ROAS closing. Audience/Lookalike layer *if* the pixel pool has grown enough (H4.5/M1), suppression-gated (M1).

*Per phase:* Sonnet builds to spec; Haiku runs tests + watches deploys; **money-path verification + adversarial review on a strong model (not Haiku).**

---

## 10. Prerequisites — token provisioning (OWNER action) — REVISED (H3)
On the **Comarnic Mountain Chalet** BM (App Review NOT required — own account). The original runbook was **not executable** — it skipped the app and the Page. Corrected order:
1. **Confirm** the ad account ("Bogdan-Comarnic") exists with a **payment method**, and the **Facebook Page** exists (+ Instagram linked for IG placements).
2. **Create a new Business-type app** in this BM (the "Access token only" CAPI app **cannot** manage ads — verified, infra doc §0). Enable Marketing API.
3. **Business Settings → System Users →** create one (role Admin).
4. **Assign ALL required assets** to the system user: the **ad account**, the **pixel** (`1010060168431159`), **AND the Facebook Page** (+ IG actor) — ads publish *as* a Page; `createAdCreative` needs `page_id` (H3).
5. **Accept the Custom Audience Terms** on the ad account (one-time, if we ever use customer-list audiences — M1/H4).
6. **Generate token**, scopes **`ads_management`, `ads_read`, `business_management`**. **Prefer a non-expiring system-user token** (Meta permits it) — expiry silently kills our stop/insights control while spend continues (C1). Copy once.
7. Note the **ad account id** (`act_<number>`), **Page id**, **IG actor id**.
Give me **token + ad account id + page id (+ IG id)** → token → `META_ADS_TOKENS` secret; ids → Prahova ad config. Note: scaling to N client properties later needs **business verification + partner access to each client's Page** (weeks — start early; H7).

---

## 11. Reality checks (honest constraints)
- **Prahova's ~130-guest list is too small for a performant Custom Audience/Lookalike seed** (Meta wants ~100+ *matched*, more to perform). So the real Phase-1/2 acquisition play is **interest+geo targeting + Pixel retargeting**, with Custom Audience mainly for **suppression** (exclude existing guests) and a *seed* for Lookalike once the pixel pool grows. Set expectations: early ROAS ramps; don't over-invest in the audience layer at current volume.
- **Advantage+ AI creative generation is Ads-Manager-only, not raw API.** So creative is either (a) brain-generated (AI, Phase 3) or (b) real photos + our copy uploaded as creatives. We won't get Meta's auto-creative via the API.
- **CAPI conversions already feed ROAS** — the measurement input is ready; ROAS is a join, not new tracking.

## 12. Definition of done (loop proven on Prahova) — REVISED
A campaign **created via our API (PAUSED, read-back-verified)** → visible in Ads Manager → **approved in the operator console** → **activated via `adExecutionGateway`** → spending under its cap → **insights pulled** → **ROAS shown** (utm_campaign join) → **operator PAUSES it and delivery stops** — all through per-property config, with the **reconciliation cron** and **account-level spending limit** proven as backstops.

---

## 13. Adversarial-review reconciliation (Fable, 9 Jul 2026) — accepted changes
Fable attacked the plan; I accept nearly all of it. §9/§10 already revised above. The rest, by theme:

**Stop-side & PAUSED enforcement (C1, C2) — the biggest miss.** The plan defined how spend *starts*, not how it *stops* — and real ad-ops incidents are about failing to stop.
- `pauseCampaign` + `pauseAllForProperty` are Phase-2 deliverables (built with/before activation).
- **Account-level spending limit** set on the ad account = a platform backstop that survives our bugs/dead tokens.
- **PAUSED is OUR convention, not a platform default** (raw API ≠ CLI). Enforce via: a single request builder that injects `status:PAUSED` (create fns can't pass status), **post-create read-back** asserting `effective_status`, and a **reconciliation cron** listing non-paused campaigns not in our approved set (also catches other-token-holder escapes).
- **`GROWTH_ADS_ENABLED` + `GROWTH_ADS_MODE=live` env switches, default off** — money path gets the same two-switch gate the messaging path had; a UI click alone must not spend (H5).

**Isolation with a SHARED token (H2) — auth no longer saves you.** Under the agency shared token, `activate(propA, campaignOfB)` *succeeds*. Every mutate-by-id must **fetch the object and assert `account_id === resolved adAccountId`**; `syncCustomAudience` must assert `segment.propertyId === propertyId` (else property A's guest PII → property B's account). Isolation tests must cover the shared-token adversary, not just "unconfigured → no-op." Keep per-property tokens as long as feasible; shared token is a scaling concession + per-account spend limits + IP allowlist.

**Execution gateway is NOT reusable as-is (H5).** The existing `executionGateway` is message-shaped (consent/suppression/messageLog) — no approval check, nothing about un-pausing ads. Build a **dedicated `adExecutionGateway`** (approval-state check, spend-cap-present check, audit doc per activation). "Routes through the gateway" was fiction; corrected.

**ROAS join is weaker than claimed (H1).** `fbclid` = "Meta as channel," NOT a campaign; and CAPI is *outbound* (not a queryable input) — I mis-stated the formula. Real join = `bookings.attribution.utm_campaign ↔ adCampaigns.id`, which only works if `createAdCreative` **stamps `utm_campaign=<adCampaigns.id>&utm_source=facebook` on the landing URL** (hard requirement; reject creative without it). fbclid-only bookings shown as "Meta, campaign unknown." Accept known undercount (cookie window, cross-device, last-touch overwrite) — state it, don't hide it.

**API contract is unverified (H4) — a spike precedes real coding.** Named unknowns to verify against the live account: `special_ad_categories` is **required**; **is vacation-rental forced into the Housing special category** (would kill Lookalikes/detailed targeting?); `OUTCOME_SALES` needs `promoted_object{pixel_id, custom_event_type:PURCHASE}` + `optimization_goal:OFFSITE_CONVERSIONS` at ad-set; creative is multi-step (`/adimages` → `image_hash` → `object_story_spec`); Custom Audiences need ToS accepted + `customer_file_source`; **Lookalike floor ≥100 matched in one country** — Prahova's ~130 likely 400s. Beta; re-verify (v26 expected mid/late 2026).

**Agency Meta mechanics (H7).** "Tenant #2 = config + token" is too glib: BM ad-account creation limits (Comarnic is UNVERIFIED), Marketing API access-tier/verification for scale, **client Pages need partner access** (add `pageId`/`instagramActorId` to config NOW — done in §9), system-user caps. Demoted to "config + a partner-access/verification workflow (weeks)."

**Mediums:** M1 cut the audience layer from Phase 1 (premature at 130; and `buildCustomAudiencePayload` must be **suppression-gated** before ever shipping PII — GDPR). M2 store Meta `effective_status` + reconciliation cadence. M3 budgets in **minor units (bani)** — declare unit, convert once, read-back; verify RON spend-cap/daily minimums (platform min may exceed "small test"). M4 approval snapshots `{budget, cap, creative}`; drift → demote to pending_approval + pause. M5 token in **header/body, never URL** (`getCampaignInsights` stub leaks it today).

**Lows:** L1 don't let the `analytics.metaPixelId → analytics.meta.pixelId` refactor break deployed CAPI/pixel reads (keep old path or migrate atomically). L2 consolidate one `GRAPH_API_VERSION`. L3 cache "last-known" retains spend capability after offboarding (note for agency). L4 insights rate limits bite at N, not 1.

**What Fable agreed was sound:** the per-property `{adAccountId, tokenRef}` + JSON-secret pattern, `write:false` rules, modular-monolith placement, operator-approves-everything, RON-only, and §11's audience-size honesty (the plan just now *acts* on it — M1).

## 14. Media Assets & Creative (design — 10 Jul 2026)

Media is the thing that quietly makes or breaks an ad engine. Verified Meta specs live in `docs/meta-ads-infrastructure-2026.md` §10; this section is the ARCHITECTURE. Core rule from §2 applies: media lives on **Core**, the Brain reasons over metadata, Meta stores its own copy.

### 14.1 Three planes (media)
- **Core** — canonical bytes (reuse the EXISTING gallery/`PropertyImage` + Firebase Storage), holds the Meta token AND the generation-provider keys, does uploads, owns bookings/guests/conversions.
- **Brain (OpenClaw)** — reasons over a metadata **catalog**; never touches bytes; holds no secrets; formulates needs.
- **Meta** — its own store: `image_hash`/`video_id` are **per-ad-account** (§10) → Core keeps a per-account upload cache; `copy_from` copies bytes across accounts (agency).

### 14.2 The asset record (one store, two views)
Extends `PropertyImage`. Key fields:
```
id, propertyId, kind: image|video
role: master | variant
derivedFrom: <parentAssetId|null>      # variant lineage — a tree; variants can have variants
transform: crop-9:16 | ai-relight | ai-people | short-clip | platform-tiktok ...
aiAdjusted: bool, aiMethod, aiPrompt   # INTERNAL flag + provenance (see 14.6)
contentHash                            # dedup — computed on the MASTER only
llmDescription: { subjects, setting, season, mood, activities, people, palette,
                  aspirational_angle, fits_copy_themes[] }   # the Brain's decision input
tags[], rights/consent
galleryVisible: bool                   # website gallery = CURATED SUBSET, not the catalog
uploads: { <adAccountId>: image_hash|video_id }   # per-account cache
performance: { withinDynamicCreative[], aggregate }   # see 14.7
state: draft → described → qa_passed → in_use → retired
```
Two orthogonal axes, both owner-requested:
- **Gallery ≠ catalog.** The public website gallery shows only curated, real, picked assets (`galleryVisible`). The ad catalog is the superset — every crop/style/platform variant, and **all AI-adjusted versions, which are catalog-only and NEVER shown in the gallery** (they'd misrepresent the property).
- **Variant lineage.** Every derived asset points at its parent via `derivedFrom` + a `transform`. Group by root master. This both answers "these are variants of the same photo" AND makes dedup correct: hash the master, so intentional variants aren't flagged as dupes.

### 14.3 Selection (Brain picks over metadata)
Given `{objective, audience, season, offer, copy}` + the catalog snapshot, the Brain **ranks candidate assets, picks a set (1 single / N for `asset_feed_spec`), justifies, and runs an adversarial judge pass** to kill mismatches. Returns asset IDs — never bytes. Favors: on-season, subject matches the message, brand-safe, available in needed ratios, and (weakly) past performance.

### 14.4 Creative assembly (Core)
Ship multi-ratio quality via **`asset_feed_spec`** (§10, API-native): put the 4:5 + 9:16 crops (and copy variants) in ONE creative and let Meta place per-placement. Store a high-res **master** → derive crops; keep copy AS TEXT (localizes RO/EN, avoids text-heavy throttle); respect Reels/Stories **safe zones**. Video: master → short-clip variants (9:16, ~15-30s), captions, async upload (poll status).

### 14.5 Generation — layered, Core-gated (DECIDED: Brain → Core → external service)
The image/video model is an **external service**; **the Brain formulates the need, CORE calls the service** (never Brain-direct). Rationale: the provider key is a Core secret (Brain holds none); the output must become a Core catalog asset anyway; Core meters cost + dedups-before-generate; Core routes to the right provider per transform without the Brain knowing; symmetry with ad execution + one audit trail. Core grows a **generation gateway** (sibling to `adExecutionGateway`): validate → cache/dedup check → route to provider → meter cost → store result as a first-class provenance-tagged asset → QA judge → return assetId. Exposed to the Brain AS A TOOL (same agentic ergonomics), **async** (job handle → poll/notify).

Three routes Core chooses among per need:
1. **Use existing** catalog asset (free) — always checked first.
2. **Meta Advantage+ enrollment** (`degrees_of_freedom_spec`, §10) — `image_uncrop` (ratio fill), `image_animation` (still→video), `text_generation` (copy). Cheap, API-toggled at creative build; NO new asset (Meta transforms at serve time); good for ratio/animate/minor touch-ups.
3. **External generation** (dedicated tool) — novel imagery Meta can't do: **relight (more sun), populate scenes with people doing the activity in the copy** (the owner's priority — high-performing lifestyle imagery). Produces a NEW catalog asset.

**Guardrails (non-negotiable):** never invent rooms/decor/amenities — only bring REAL scenes to life; activities shown must actually be available; synthetic people need no release but must not imply non-existent experiences. Quality is paramount → Advantage+ only where it's genuinely good; dedicated tools for people-compositing/relight; **A/B Meta-enhanced vs dedicated early to calibrate.**

### 14.6 AI labeling (verified §10)
Commercial ads: **no advertiser self-declaration required** and **no Marketing API field** to declare it. Meta **auto-detects + labels** ("AI Info") significant AI edits (image/background generation, people-population) as of **1 Jun 2026**; minor edits (resize/color) don't trigger. (Political/social-issue ads DO require self-disclosure — not us.) We still keep an **internal `aiAdjusted` flag** regardless — for governance, honesty/QA, and future-proofing.

### 14.7 Performance attribution (honest)
A single ad's outcome **cannot be blamed on the photo alone** — confounded by copy/audience/budget/timing/bid. Per-asset signal is trustworthy ONLY in two places: (1) **within Dynamic Creative / `asset_feed_spec`**, where Meta rotates images inside the SAME ad set → a controlled experiment isolating the image (Meta's per-asset breakdown); (2) **aggregate across many campaigns**. Store per-asset performance, but the Brain weights within-experiment + aggregate and treats single instances as weak signal. The feedback loop (asset→ROAS) is real but statistically humble.

### 14.8 Brain ↔ Core contract (structured, verified handshake)
Not free text. Mirrors the gateway discipline (validate → gate → act → audit):
- **Catalog request →** Core returns a VERSIONED snapshot (metadata + `llmDescription`, no bytes, `catalogVersion`).
- **Ad proposal (Brain→Core) →** `{schemaVersion, proposalId (idempotency key), propertyId, catalogVersion, objective, targeting, budget{dailyMinor, capMinor}, copy[{primary,headline,cta,lang}], assets:[{assetId,role}], generationRequests:[{prompt,baseAssetId,transform}], landing{url,utms}}`.
- **Core validates (the teeth) →** schema ok; `catalogVersion` not stale (else reconcile); **every assetId exists AND belongs to propertyId** (shared-token ownership assert, H2, applies to asset selection too); budget within policy; spend cap present; targeting sane; dedupe by `proposalId`. Returns `{accepted|rejected, reasons[], createdPausedIds?}`. Creation stays PAUSED; activation stays the human gate.
- **Nuances:** idempotency/retries; catalog-version pinning + drift reconciliation; authN/authZ of the Brain↔Core channel (scoped to allowed properties); a dry-run "validate without creating" preflight; generation cost governance (metered/capped); **preview as a formal step** (Meta create-PAUSED → GET preview → activate — where AI output is judged).

### 14.9 Pre-flight QA + dedup
- **Pre-flight QA judge** (adversarial): every asset-at-crop / AI output reviewed before it can become a live ad — on-message, safe-zone-clean, not-beheaded, realistic (AI people), on-brand, HONEST (no implied non-existent amenity). Uses Meta's PAUSED→preview flow.
- **Dedup** on the master's `contentHash`; variants are known derivations, not dupes.

### 14.10 Phasing
- **2a (minimal, now):** reuse existing photos, thin ad-asset record + per-account upload cache, proper 4:5 + 9:16 crops via `asset_feed_spec`, opt into Meta auto-enhance. Enough to run REAL ads with real photos — and it seeds the catalog/performance data. (Pairs with the "one manual real ad first" step.)
- **2b:** vision-caption the library (`llmDescription`) + Brain-driven selection with judge + per-asset performance capture (within-Dynamic-Creative).
- **2c:** the generation gateway (Brain need → Core → external service) for relight/people/seasonal gaps + video short-clip splitting + Meta `image_animation`.
Don't build 2b/2c before 2a proves photos → bookings.

### 14.11 Open decisions
- Which external provider(s) for relight vs people-compositing (quality-led; A/B vs Advantage+).
- Video: split the existing tour/drone master into short-clip variants now, or wait for more footage.
- Exact catalog-snapshot/versioning + agent-API auth mechanism (part of the §7 brain seam).
