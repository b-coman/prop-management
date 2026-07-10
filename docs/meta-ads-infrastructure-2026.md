# Meta Ads Infrastructure for Agentic Advertisers — Verified Reference

> **CLAUDE.md READS THIS FILE for any Facebook / Instagram / Meta-ads work.** This is verified, cited knowledge that post-dates the model's training — do NOT answer Meta-ads questions from memory; read here first, and re-verify against Meta's own docs before building (it's a beta).

**Fetched & fact-checked:** 8 July 2026 (deep-research, 22 sources, 25 claims adversarially verified 3-vote, 22 confirmed / 3 refuted). Follow-up on the operator's existing assets: 8–9 July 2026 (5 additional claims verified; some CAPI details rate-limited → flagged unverified below).
**Shelf life:** SHORT — everything below is an April 29 2026 **open beta**; re-verify against Meta's own docs before building. Marketing API cadence predicts a v26 ~mid/late 2026.
**Authoritative sources:** developers.facebook.com, facebook.com/business/news + /help, Meta for Developers blog. Third-party blogs flagged.

---

## 0. THIS OPERATOR'S existing assets — reuse verdict (added 9 Jul 2026)

The owner already has, in Meta Business Manager **"Comarnic Mountain Chalet"** (ID `284793355854966`, **business verification = UNVERIFIED**):
- an app **"Conversions API Application"** — App ID `356355235972444`, type **"Access token only"**, Mode Live, calling Graph/Marketing API **v20.0** (old; current v25).

**Verdict — what's reusable vs must be new:**
| Asset | Reuse? | Why (verified) |
|---|---|---|
| Business Manager (Comarnic Mountain Chalet) | ✅ **Reuse** | Prereq already met. It's UNVERIFIED — see §3; verification not needed to manage your OWN ad account. |
| "Access token only" CAPI app | ✅ **for CAPI / conversion tracking** · ❌ **for ad management** | **Verified (2-1):** *"App types cannot be changed. If your app needs products… unavailable to its current type you must create a new app with a different type."* → this app **cannot be upgraded** to a Business app to run ads. Its type is the restricted CAPI vehicle. |
| Ad account + payment method | ❌ **Create** | Not present. Required for any ad spend. |
| Instagram linked to the Page | ❌ **Do** | Needed for IG placements. |
| Path to RUN ads | ❌ **Create** — pick one: | **(a)** hosted **MCP** (`mcp.facebook.com/ads`) — **verified (3-0): "no developer credentials, API setup, or coding required"**, OAuth from the ad account → *no app at all*; **or (b)** one **new Business-type app** + System User token for the **Ads CLI**. |

**Bottom line:** Keep the Business Manager + the CAPI app (for tracking). For *running ads* you do **not** reuse the CAPI app — either go **app-less via the hosted MCP**, or create **one new Business app** for the CLI. (Verified: creating/managing ads needs the `ads_management` permission; the Marketing API's three use cases are lead-capture / create-&-manage-ads / measure-performance.)

**UNVERIFIED (rate-limited — confirm cheaply before relying):** that the CAPI access token is a **Pixel/dataset-level token from Events Manager** (not app-level) and that Events Manager **auto-provisions a CAPI app + system user** — if true, even the existing CAPI *app* may be unnecessary and a **dataset token alone** suffices for `meta-capi.ts`. Also unverified: exact business-verification triggers, Custom/Lookalike audience creation via CLI/MCP, and the TikTok equivalent.

---

## TL;DR — the two things that change our plan
On **29 Apr 2026** Meta launched **"Meta Ads AI Connectors"** (open beta) = **an official first-party MCP server + an official Ads CLI**. This definitively resolves the earlier uncertainty: **Meta DOES have an official ads MCP server** (verified at infra level — `mcp.facebook.com` resolves to Facebook's own CDN/ASN and returns a real MCP OAuth challenge). It is *separate* from Google's Oct 2025 read-only Google Ads MCP.

**For our approve-before-publish, self-hosted-agent design, the CLI is the better fit** (System User token + PAUSED-by-default). The hosted MCP is the lighter, no-infra alternative.

---

## 1. Meta Ads CLI (official) — the recommended execution path for us
Source: [Introducing Ads CLI (Meta blog, 29 Apr 2026)](https://developers.facebook.com/blog/post/2026/04/29/introducing-ads-cli/), [Ads CLI overview](https://developers.facebook.com/documentation/ads-commerce/ads-ai-connectors/ads-cli/ads-cli-overview)

- **Auth:** a Meta **System User access token**; loads secrets from **env vars / `.env`** (not CLI args). ✅ fits our GCP Secret Manager pattern.
- **PAUSED by default:** *"Resources are created in PAUSED status by default, so nothing goes live until you are ready."* `--status` defaults to PAUSED for campaign/ad set/ad. ✅ **this is the approve-before-publish gate for free.**
- **Full CRUD** on: campaigns, ad sets, ads, ad creatives; product catalogs/items/sets; **datasets (conversion pixels)** create/connect; **insights** (spend/impressions/CTR/ROAS, breakdowns). (Does NOT expose full CRUD on ad accounts or Pages.)
- **Agent-oriented:** output `table`/`json`/`plain`; `--no-input` + `--force` for unattended runs; exit codes `0` success / `3` auth / `4` API (range 0–5).
- **Runtime:** **Python ≥3.12, PyPI package `meta-ads`** (pip/uv). ⚠️ `npm install -g @meta/ads-cli` is FALSE (404). Do NOT conflate with the unrelated third-party `attainmentlabs/meta-ads-cli`.
- **Targets Marketing API v25.0.**

## 2. Meta Ads MCP server (official) — the no-infra alternative
Source: [Meta Ads AI Connectors (Meta for Business)](https://www.facebook.com/business/news/meta-ads-ai-connectors), [Help 1456422242197840](https://www.facebook.com/business/help/1456422242197840)

- **Remote, Meta-hosted** at a single fixed endpoint **`https://mcp.facebook.com/ads`** (shared across supported AI agents).
- **OAuth** ("Meta-authenticated connection"): *"no developer credentials, API setup, or coding required."* Setup = add connector URL → authorize via Meta Business OAuth → approve scopes.
- **Scopes advertised:** `ads_management`, `ads_read`, `catalog_management`, `business_management`, `pages_show_list`, `instagram_basic`.
- **READ + WRITE** — ~**29 tools / 5 categories**: Campaign Management (5, write — create/edit campaigns, ad sets, ads via natural language), Product Catalog (10), Assets (3), Diagnostics (4, read), Insights (7, read). Created entities land **PAUSED**.
- **Requires a compatible MCP client** that can do the remote-OAuth handshake (built for Claude/ChatGPT-style agents). OpenClaw is an MCP client — but the interactive OAuth authorization is the open question for an *unattended* agent.

## 3. Marketing API — current state
Source: [Marketing API changelog](https://developers.facebook.com/documentation/ads-commerce/marketing-api/marketing-api-changelog/versions)

- **Current = v25.0 (18 Feb 2026). There is NO v26** as of Jul 2026. (Note: the "v25 = Feb 2025" framing is wrong; early-2025 was v22.0.)
- **Advantage+ Creative via the raw API is enrollment-only:** `degrees_of_freedom_spec > creative_features_spec` with `enroll_status OPT_IN/OPT_OUT` + previews. **The AI creative *generation* is NOT prompt-driven through the API** — the "URL + budget, AI does the rest" flow runs in **Ads Manager UI / business agent**, not raw API prompts.
- Legacy Advantage+ Shopping/App **campaign-creation** APIs are being deprecated toward Advantage+ structures (tied to v25; ~Q1 2026, a ~19 May 2026 extension date surfaced but is **unverified**).
- **Audiences (Custom/Lookalike) via CLI/MCP: UNVERIFIED** — the CLI overview doesn't list audience CRUD; treat as *not available via CLI* until confirmed (raw Marketing API still can). Not a blocker for us — see note below.

## 4. Setup & App Review
Source: [System Users — install apps & generate tokens](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens/), [System Users overview](https://developers.facebook.com/docs/business-management-apis/system-users/overview/)

- **App Review is NOT required to manage your OWN ad account.** It's only for managing OTHER businesses' accounts (the "Business On Behalf Of" path).
- **The Developer app + System User must live in the SAME Business Manager that owns the ad account.**
- **Prereqs:** Business Manager (admin) · ad account + payment method · Developer app (Business type) with Marketing API · System User assigned to the ad account · Pixel/dataset · Instagram account linked to the Page (for IG placements). Business verification may be needed for some access tiers.
- **Scopes for ad management:** `ads_management`, `ads_read`, `business_management` (+ `pages_manage_ads` etc.).
- **Token security:** System User tokens can be **non-expiring** ("Never expires") but Meta now **recommends 60-day expiring** (`set_token_expires_in_60_days=true`) as best practice → store in Secret Manager, prefer rotation.
- Note: "Ads Management Standard Access (AMSA)" was **renamed "Marketing API Access Tier"** (~4 May 2026).

## 5. Advantage+ / AI Sandbox / full automation
- **Advantage+ Creative** (Meta AI features): text generation, image expansion, image generation, image retouching — via **Ads Manager UI**. Source: [Advantage+ Creative](https://www.facebook.com/business/ads/meta-advantage-plus/creative).
- **AI Sandbox** = generative AI features native to Ads Manager (not API/CLI).
- **Full "URL + budget → AI does everything"** end-to-end automation runs via Ads Manager UI / business agent, **not** the raw API.

## 6. Unofficial self-hostable option (fallback)
- **`pipeboard-co/meta-ads-mcp`** — community, NOT a Meta product; calls Meta's public APIs; ~29 read+write tools incl. `create_campaign/create_adset/create_ad/create_ad_creative/upload_ad_image`; new campaigns start paused. Source: [GitHub](https://github.com/pipeboard-co/meta-ads-mcp). (The "42/230+ tools" figure is Pipeboard's hosted-product marketing, not this repo.)

---

## Implications for OUR architecture (OpenClaw + Core)
1. **Don't hand-roll a Marketing-API `metaAdsService`.** Drive the **official Ads CLI** instead. PAUSED-by-default = our approve gate for free; deterministic exit codes + json output = clean agent integration.
2. **Where the token/CLI lives (the decision):** the CLI needs a **System User token** — a Core-side money/publishing secret. Two options mirroring the WhatsApp split:
   - **Core runs the CLI** (Execution Gateway) on the brain's approved proposal — keeps the secret boundary intact.
   - **OpenClaw runs the CLI** — simpler agentically, defensible *because* everything lands PAUSED until a human activates in Ads Manager. But the Meta token then lives on the VM.
   - Lean **Core** for consistency; PAUSED-default makes VM acceptable.
3. **The hosted MCP** (`mcp.facebook.com/ads`) is the more "conversational" path and needs no app/token/code — but its interactive OAuth suits attended AI clients; for our unattended, gated agent the **CLI is cleaner**. Keep MCP as the fast-path option.
4. **Audience reality (unchanged):** 130 past guests are too small to be a useful FB/IG *ad* audience — reach them free via WhatsApp (built). FB/IG = **new acquisition** (interest/geo, Pixel retargeting, Lookalike-from-Pixel once seeded). CLI audience-creation being unverified is therefore low-impact.
5. **Creative generation stays partly on Meta:** Advantage+ generates creative from your assets/URL in Ads Manager — so the "brain generates creative" role can lean on Meta's own AI + your real photos, rather than us building a full creative pipeline.

## Open questions to resolve BEFORE building (re-verify)
- Does the CLI/MCP support Custom/Lookalike **audience creation** (+ min sizes, hashing)? (Unverified.)
- Exact **CAPI** event-sending depth within CLI/MCP (dataset connect confirmed; full event ingestion not).
- Precise **Advantage+ Shopping/App API deprecation** timeline (the ~19 May 2026 date unverified).
- **CLI vs MCP** recommended production path for an unattended agent; does the MCP OAuth need Business Verification the CLI avoids?
- **TikTok** equivalent CLI/MCP + its approval model (later expansion).

## What Meta provides vs what we build/run
| Concern | Meta provides | We build / run |
|---|---|---|
| Ad creation/mgmt API | Marketing API v25 + **Ads CLI** + hosted **MCP** | Invoke the CLI (or MCP) from OpenClaw/Core |
| Safety gate | **PAUSED-by-default** on create | Approval step (Telegram) before activating |
| Creative generation | Advantage+ AI (image/text/video) in Ads Manager | Brief/curate + approve; feed real photos |
| Audiences | Custom/Lookalike via raw API | Pixel + interest/geo config; suppression list (have) |
| Conversion tracking | Pixel/CAPI endpoints | CAPI wiring (`meta-capi.ts` foundation exists) |
| Hosting | MCP server (Meta-hosted); Meta ad delivery | The agent runtime (OpenClaw) + token in Secret Manager |
| Account/identity | Business Manager, ad account, OAuth | Create the account, app, System User, link Page/IG, add payment (owner action) |

---

## 8. SETUP RUNBOOK — get to "able to run FB/IG ads" (owner actions)

The critical path to running ads. Steps 1–4 are the SAME regardless of which run-path you pick (§ path choice below); they need the owner's login/identity/payment and cannot be automated. Everything is inside the existing Business Manager **"Comarnic Mountain Chalet"** (ID `284793355854966`).

1. **Ad account + payment method** — Business Settings → Accounts → Ad Accounts → *Add → Create a new ad account* (currency RON, timezone Europe/Bucharest). Then Billing → add a card. *Without this, nothing can spend.*
2. **Link Instagram to the Page** — Business Settings → Accounts → Instagram accounts → connect the property's IG, and link it to the **Comarnic Mountain Chalet** Facebook Page. *Required for IG placements.*
3. **Pixel / dataset + Conversions API** — Events Manager → confirm/create a **Pixel (dataset)**; note the **Pixel ID**. Under the pixel's Conversions API → *Set up manually* → **Generate access token** (a dataset-level token). *This is the measurement layer — reuses the existing "Access token only" CAPI app / or the dataset token alone (see §0 UNVERIFIED note; confirm which).*
4. **(Maybe) Business verification** — start it if Meta prompts for higher access/spend; NOT required to manage your own ad account (§3). Currently UNVERIFIED — fine to begin.

**Then choose the run-path:**
- **A · Hosted MCP (fastest, app-less, recommended to start):** connect `mcp.facebook.com/ads` to an AI agent via Meta OAuth — no developer app, no token, no code. Create campaigns conversationally; they land PAUSED for review. Best for validating "do ads produce bookings?" before any build.
- **B · Ads CLI (for the OpenClaw automation later):** create ONE new **Business-type** app in this same Business Manager, add a **System User**, assign it to the ad account, generate a token (store in GCP Secret Manager), run the `meta-ads` CLI. This is the path for the agentic brain→approve→execute loop.

**Recommended sequence:** setup 1–3 → run first campaign via **A (MCP)** or Ads Manager → wire **Pixel+CAPI conversion tracking** (Core build, `meta-capi.ts`) so bookings attribute to ads → only after ads are proven, build **B** (OpenClaw agentic automation). Don't build the automation before proving the ads work.

---

## 9. Contract spike — VERIFIED against the live account (9 Jul 2026, read-only)
Facts read directly from ad account **`act_543311232953437`** (Bogdan-Comarnic) + its existing campaigns. Ground truth for building; re-check before go-live (beta).

**Account:** currency **RON**, timezone **CET**, `HAS_VALID_PAYMENT_METHODS`, trust tier 1, `IS_IN_ODAX_EXPERIENCE` (new outcome objectives), business = Comarnic (`284793355854966`). Instagram actor id = **`17841435421272996`**.

**Budgets are in MINOR UNITS (bani)** — verified: old `daily_budget:"1000"` = 10 RON/day. Account minimums:
- `min_daily_budget` = **464 bani = 4.64 RON/day** (tiny — small tests are cheap).
- `min_campaign_group_spend_cap` = **50000 bani = 500 RON** ← a campaign-level spend cap **cannot be below 500 RON**. So control a *small* test via **daily budget (~5 RON/day) + an end date**, NOT a sub-500-RON campaign cap. (Resolves Fable M3.)
- `spend_cap` = **"0"** → NO account-level spending limit set. **Set one in Ads Manager as the platform backstop** (Fable C1).

**special_ad_categories (Fable H4.1 — the Housing question, ANSWERED by precedent):** this account has run vacation-rental ads BOTH as `[]` AND as `["HOUSING"]`. So Meta does NOT force these into HOUSING — **declare `special_ad_categories: []`** for direct-booking/travel ads (the account's own `[]` campaigns ran fine). HOUSING remains a latent ad-review risk; if ever forced, Lookalikes/detailed targeting are lost. `special_ad_categories` IS a required create param.

**Custom Audiences:** `tos_accepted.web_custom_audience_tos = 1` (website/pixel audiences OK); **customer-file ToS NOT accepted** → uploading email/phone lists needs a one-time ToS acceptance first. And existing audiences return **`delivery_status 300: "Audience is too small to be used"`** — confirms the audience/Lookalike layer is premature at this scale (Fable M1: cut from Phase 1).

**Creative flow works (Fable H4.3):** `/act_/adimages` reachable (existing image_hash present). Accepted `object_story_spec` shape:
```
object_story_spec: { page_id, instagram_user_id, link_data: { link, message, image_hash, call_to_action:{type:"LEARN_MORE"}, use_flexible_image_aspect_ratio } }
```
The **`link`** field is where the `?utm_source=facebook&utm_campaign=<adCampaigns.id>` MUST go (Fable H1).

**Ad-set targeting shape (validated):** `geo_locations{ cities:[{country,key,radius,distance_unit,region}], location_types:["home","recent"] }, age_min, age_max`. Owner's prior play: RO cities (Bucharest 25mi, Braila, Constanta, Galati…), age 30–45.

**STILL UNVERIFIED (no account precedent — verify at first PAUSED create):** `OUTCOME_SALES` needs ad-set `optimization_goal:OFFSITE_CONVERSIONS` + `promoted_object:{pixel_id, custom_event_type:PURCHASE}`. The account's history is all LINK_CLICKS/OUTCOME_TRAFFIC/MESSAGES — no conversion campaigns yet.

**API version:** calls used v21 but Meta's paging responses returned **v25.0** URLs → v25 is current; use a current `GRAPH_API_VERSION` constant (existing code hardcodes v21, expiring ~late 2026 — consolidate, Fable L2).

### 9b. Phase-1 create-contract spike (live PAUSED create+delete, 9 Jul 2026)
Ran the full OUTCOME_SALES chain against `act_543311232953437` PAUSED, then deleted. Findings:

- **Campaign (OUTCOME_SALES) requires `is_adset_budget_sharing_enabled` = `true|false`** when NOT using campaign-level budget (ad-set budgets). Omitting it → error 100/4834011 "Must specify True or False in is_adset_budget_sharing_enabled". Pass `false`.
- ✅ **Conversion optimization VERIFIED WORKING:** ad set with `optimization_goal=OFFSITE_CONVERSIONS`, `billing_event=IMPRESSIONS`, `promoted_object={pixel_id, custom_event_type:PURCHASE}`, `conversion_domain=prahova-chalet.ro`, `bid_strategy=LOWEST_COST_WITHOUT_CAP`, `daily_budget=5000` (50 RON) — accepted. This was the big open question (no account precedent). Resolved.
- ❌ **Creative creation REQUIRES the app to be in LIVE (public) mode.** With the "rentalspot" app in Development, `/adcreatives` → "Ads creative post was created by an app that is in development mode. It must be in public to create this ad." **OWNER ACTION: publish the app (Development → Live).** (Correction: unpublished is fine for token/campaign/adset ops, but NOT for creating ad creatives, which publish as the Page.)
- Complex params (`promoted_object`, `targeting`, `object_story_spec`, `special_ad_categories`) go as **JSON strings** in the form body (confirms the Phase-0 client needs JSON.stringify for non-primitives).
- All PAUSED test objects deleted cleanly (`{"success":true}`).

### 9c. Phase-1 contract VERIFIED end-to-end (app Live, 10 Jul 2026)
After publishing the "rentalspot" app (Development → Live), the full chain was
created PAUSED and deleted cleanly — zero spend. `effective_status: IN_PROCESS`
= accepted into review but PAUSED, cannot spend. **Also verified:** `/adcreatives`
**accepts (ignores) `status=PAUSED`**, so the PAUSED-enforcing `createResource()`
is safe to use uniformly for all four object types — the single enforcement
point holds, no bypass for creatives.

Exact accepted payloads (all against `act_543311232953437`, Graph **v25.0**,
token in `Authorization: Bearer` header; complex fields as JSON strings):

**Campaign** — POST `act_<id>/campaigns`
```
name, objective=OUTCOME_SALES, special_ad_categories=[], status=PAUSED,
is_adset_budget_sharing_enabled=false
```
**Ad Set** — POST `act_<id>/adsets`
```
name, campaign_id, billing_event=IMPRESSIONS, optimization_goal=OFFSITE_CONVERSIONS,
promoted_object={pixel_id, custom_event_type:"PURCHASE"},
daily_budget=<bani>, conversion_domain=<eTLD+1 of landing page>,
targeting={geo_locations:{countries:[...]}}, bid_strategy=LOWEST_COST_WITHOUT_CAP,
status=PAUSED
```
**Creative** — POST `act_<id>/adcreatives`
```
name, object_story_spec={page_id, link_data:{link (with utm_*), message,
image_hash, call_to_action:{type:"LEARN_MORE"}}}
```
**Ad** — POST `act_<id>/ads`
```
name, adset_id, creative={creative_id}, status=PAUSED
```
Notes: budgets in **bani** (minor units); Meta auto-adds `smart_pse_enabled:false`
to `promoted_object`; `conversion_domain` must match the landing page's registrable
domain (prahova-chalet.ro). Insights read-back for ROAS still to be exercised in
the create functions, not the spike.

---

## 10. Creative assets & AI generation — verified specs (10 Jul 2026)
Verified against developers.facebook.com (v25.0) + facebook.com/business ad-guide. Source tiers: **[P]** = read on a Meta property, **[S]** = secondary/snippet (spot-check before hard-coding). Extends/corrects §3/§5.

**Image specs [P]:** JPG/PNG, **max 30 MB**, **min width 600px**, aspect-ratio tolerance **±3%**. Per placement: FB Feed **4:5** (also 1:1, 1.91:1), rec 1440×1800, min 600×750; Stories/Reels **9:16**, 1080×1920; FB right-column **1:1**; IG Feed 1.91:1→4:5. **The "20% text rule" is RETIRED (since Sep 2020), not enforced** — only a soft "less text performs better" recommendation; claims of a silent 2026 delivery penalty are [S] folklore, unconfirmed. Text (FB Feed/Awareness only, [P]): primary **50–150 chars** before "See more", headline **27 chars**; other placement/objective limits [S]/UNCONFIRMED — use `/act_<id>/generatepreview` rather than hard-coding truncation.

**Video specs [P]:** MP4/MOV, H.264/H.265, **16:9 → 9:16**, min width 1200px (rec 1280×720+, scale up for 9:16), 24–60 fps, "up to 10 GB recommended" (the blog "4 GB max" is NOT what Meta's doc says). Upload `/act_<id>/advideos` is **chunked + ASYNC** (`upload_phase: start→transfer→finish`) → poll `GET /<video_id>?fields=status` until `processing_phase.status=complete` before use. Length limits UNCONFIRMED on a Meta source.

**image_hash is (very likely) ACCOUNT-SCOPED [P-inferred]:** `/act_<id>/adimages` → `{hash,url,...}` (the returned `url` is temp — "do NOT use in creative"). The reference exposes `copy_from:{source_account_id,hash}` specifically to copy an image into ANOTHER account → strong evidence hashes don't transfer across accounts. **CONFIRMS the per-account upload cache design** `(assetId, adAccountId)→image_hash`. Verify empirically (upload same file to 2 accounts, diff hashes). Agency note: `copy_from` lets us copy a master account's image to each property account without re-uploading bytes.

**`asset_feed_spec` — multi-asset/multi-ratio in ONE ad, API-creatable [P] (KEY):** POST `/act_<id>/adcreatives` with `asset_feed_spec` carrying `images[]`(≤~10)/`videos[]`, `bodies[]`/`titles[]`/`descriptions[]`(≤5 each), `link_urls[]`, `call_to_action_types[]`, `ad_formats`(`SINGLE_IMAGE|CAROUSEL_IMAGE|SINGLE_VIDEO|AUTOMATIC_FORMAT`), `asset_customization_rules[]`. So ONE ad can hold per-placement ratio variants and Meta picks per placement — **this is the API-native answer to "proper crops vs auto-crop": provide the crops as assets, let Meta select.** Not UI-only. (Catalog ads use a different `preferred_image_tags`/`adapt_to_placement` path — catalog-only, overkill for 1–2 properties.)

**AI creative generation — API vs UI (corrects §3/§5) [P]:** the earlier "AI gen is not API-driven" is INCOMPLETE. Two layers:
- **API-CONTROLLABLE via `degrees_of_freedom_spec.creative_features_spec`** (per-feature `{enroll_status: OPT_IN|OPT_OUT}`, submitted on adcreative/ad create): `text_generation` (copy variations), **`image_uncrop`** (AI expand/outcrop a still to fit a ratio — placement-limited to IG/Reels/Stories/Mobile-Feed), **`image_animation`** (still→short video), `image_background_gen` (**catalog ads only**), `music`/`music_generation`, `standard_enhancements` bundle (image touch-ups, text optim — sub-features NOT individually API-toggleable since v22.0, bundle-only). Workflow: create PAUSED → GET preview to see the AI output → then ACTIVE. **These directly cover our ratio-fill + still→video gaps, for free, via the API.**
- **NOT API-accessible (UI / Business-AI-agent only):** free-form **prompt-to-image / prompt-to-video** (AI Sandbox/Creative Studio) — no endpoint. The Apr-2026 Ads CLI/MCP "Assets" tools appear to be upload/list only, no generation. → **Any *prompted* generation we must run ourselves** (Core-side), then upload as a normal asset.

**AI-content labeling [P]:** Meta auto-labels ads "created or significantly edited" with generative AI ("AI info" on About-this-ad); minor edits (resize/color) don't trigger. Political/social-issue ads have stricter mandatory AI disclosure. → another reason to prefer real photos + light enhancement over heavy generation.

**Rights/consent [S, consistent]:** advertiser must own/license every asset (image/video/music); IP infringement → rejection/termination. People need releases; don't fabricate the property (trust + policy + chargeback risk).

### 9d. Phase-2a contract spike (live PAUSED, 10 Jul 2026) — upload + creative/adset fields
Verified against `act_543311232953437` (v25), all PAUSED + deleted, zero spend:
- **Image upload — multipart works.** `POST /act_<id>/adimages` with `curl -F "<field>=@file.jpg"` (or Node FormData/Blob) → `{"images":{"<field>":{"hash","width","height",...}}}`. Uploaded a 2048×1536 / 1.7MB JPG → hash returned. (§10: max 30MB, min width 600px — size-guard before base64 which inflates +33%; the returned `url` is temporary, store the HASH only.)
- **Ad set `start_time` + `end_time` accepted with `daily_budget`** — a bounded run (auto-stop) works; read-back confirmed both. Use for the first live test's spend bound (Meta campaign spend-cap floor is 500 RON, too high for a small test).
- **Creative `object_story_spec` accepts `instagram_user_id`** (→ IG placements, not FB-only), **`use_flexible_image_aspect_ratio:true`** (Meta auto-fits placements), and **`link_data.name`** (the headline). All read back correctly.
- **B1 (build, verify at live test):** create injects PAUSED into campaign+adset+ad; Meta `effective_status` is a hierarchy rollup, so activation must un-pause ALL THREE (campaign + adset + ad) to deliver — un-pausing only the campaign leaves the ad paused. Pause stays campaign-only (ancestor pause gates children). Not verified autonomously (would require real delivery/spend) — confirm at the owner-gated live test.

### 9e. Phase-2a console-pipeline validation (dry-run, 10 Jul 2026) — two fixes
Ran `composeAndCreateAd` (the real console path: Storage image upload → neutral compose → chain) against the live account in DRY RUN, self-cleaned. Two live-only bugs found + fixed:
- **Storage bucket:** `admin.storage().bucket()` (no-arg) throws "Bucket name not specified or invalid" — the Admin SDK isn't initialized with a `storageBucket`. Fix: pass the bucket name explicitly from `FIREBASE_STORAGE_BUCKET`/`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (set locally + in apphosting.yaml). `adImages.ts`.
- **Advantage+ Audience flag REQUIRED:** ad set create with audience targeting (age/interests) → error **100 / subcode 1870227** "Advantage Audience Flag Required" — must set `targeting.targeting_automation.advantage_audience` to 0 or 1. (The §9b/§9c spikes used geo-only, so never hit it.) Fix: `createAdSet` injects `targeting_automation:{advantage_audience:0}` (respect exact targeting; caller can override). `campaignBuilder.ts`.
- Everything else worked: image dedup cache hit on re-run, full PAUSED chain, `adCampaigns` draft doc (no spendCap = un-activatable), `activateCampaign`→`dry-run` (two-switch gate), clean delete. Zero spend. Validator: `scripts/growth-validate-compose.ts`.

### 9f. Phase-2b contract spike (city targeting + Advantage+ audience + multi-image, 10 Jul 2026)
All verified live PAUSED + deleted, zero spend. This is the contract for the richer targeting/creative build.

**City name→key resolution:** `GET /search?type=adgeolocation&location_types=["city"]&q=<name>&country_code=RO&limit=1` → `data[].{key,name,region,region_id,country_code}`. Verified keys: **București=1910415, Ploiești=1925836, Constanța=1913456**. Cities MUST be targeted by `key`, never name.

**City targeting (ad set):** `targeting.geo_locations.cities:[{key, radius, distance_unit:"kilometer"}]` + `location_types:["home","recent"]`. Read-back confirms.

**Advantage+ audience OWNS demographics (KEY design fact):** with `targeting_automation.advantage_audience:1` you CANNOT hard-set `age_min` > 25 (err 100/1870188) nor `age_max` < 65 (err 100/1870189) — age becomes a *suggestion* only; **only geo is a hard control**. So: `advantage_audience:1` (Meta's conversion recommendation, best cold-start) ⇒ drop hard age, rely on GEO + ad copy to qualify. Use `advantage_audience:0` only when you need exact age/gender/interest control (then age is honored). The two are mutually exclusive on age.

**Multi-image = Dynamic Creative (`asset_feed_spec`):** creative = `object_story_spec:{page_id, instagram_user_id}` (NO link_data) + `asset_feed_spec:{images:[{hash},…], bodies:[{text},…], titles:[{text}], descriptions:[{text}], link_urls:[{website_url}], call_to_action_types:["LEARN_MORE"], ad_formats:["AUTOMATIC_FORMAT"]}`. Meta mixes assets + picks per placement.
**GOTCHA:** a Dynamic-Creative ad fails on a normal ad set — err 100/**1885998** "Cannot Create Dynamic Creative ad In Non-Dynamic Creative Ad Set". The AD SET must be created with **`is_dynamic_creative:true`**. Single-image `object_story_spec` creatives stay on normal (non-dynamic) ad sets. So the composer picks the path by asset count: 1 image → object_story_spec/normal adset; 2+ images or copy variants → asset_feed_spec + `is_dynamic_creative:true` adset.
