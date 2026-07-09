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
