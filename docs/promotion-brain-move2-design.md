# Move 2 — the in-app situation analyst (the brain's body)

**Status:** design, agreed 2026-08-03. Anchors `promotion-system-architecture.md` §7 M2. Build from this.

## Goal
Move the analyst from a Claude-Code *skill over a CLI pack* to an **in-app service** that produces a
typed, persisted **Situation Report + routed Opportunities**, which the owner reads / edits / challenges /
approves in Admin, then hands to the already-built arms. After this, *"the analyst routes in code"* is true,
and the owner's role shifts from transcriber to approver.

## How it runs (decided)
- **In-app on Cloud Run.** Triggered by a **"Run analysis" button in Admin** (manual only for now; the
  weekly cron is deferred until the brain is calibrated — owner's call).
- The **LLM call is server-side** via the Anthropic API (`ANTHROPIC_API_KEY`), forced tool-call, with the
  situation-analyst *method* as the system prompt — the exact pattern of `adPlanner.ts`.
- **No new tokens:** `ANTHROPIC_API_KEY` + Firestore Admin SDK + `META_ADS_TOKENS` (brand-health sensor) —
  all already provisioned.
- The **`situation-analyst` skill stays** as the interactive console (backtests, deep-dives, "why did you
  say that") over the same pack lib. Production loop = in-app; exploration = Claude Code. Single-sourced
  method text, so skill and service cannot diverge.

## Data model (Firestore; Admin-SDK-only writes)
- **`situationReports/{runId}`** — `{ propertyId, asOf, createdAt, createdBy, status:'open'|'archived',
  report: SituationReport, steer?: string, supersedesRunId?: string }`. `steer` = the owner's challenge note
  if this run was a re-run.
- **`opportunities/{oppId}`** — `{ runId, propertyId, createdAt, ...Opportunity (window, daysOut, occasion?,
  valueAtRisk?, instrument, audience?, rationale, rejectedAlternatives?), status:'pending'|'approved'|
  'dismissed'|'snoozed', ownerEdit?, ownerNote?, disposedBy?, disposedAt?, handoffRef? }`. `handoffRef` = the
  arm draft it created on approval (e.g. `adCampaigns/{id}`).

## Contracts (`src/lib/growth/contracts.ts`)
- Add **`SituationReport`** = `{ headline, flags: Flag[], normal: string[], questions: string[],
  confidence: { sure: string[], thin: string[], guess: string[] }, dataCaveats: string[] }`;
  `Flag = { severity:'red'|'amber'|'yellow', what, evidence: {path, value}, whoActs }`.
- **`Opportunity`** already exists — reuse; add `audience?` + `rejectedAlternatives?` if absent.
- The LLM's forced-tool output = `{ report: SituationReport, opportunities: Opportunity[] }`.

## The service (`src/services/growth/situationAnalyst.ts`)
`runSituationAnalysis(propertyId, { asOf?, steer? })`:
1. `buildSituationPack(propertyId, asOf)` — the in-app pack (P1).
2. Anthropic forced tool-call: system = `SITUATION_ANALYST_METHOD` (single-sourced from the skill), user =
   the pack (+ the steer note, if a re-run).
3. `validateSituationReport(result, pack)` — bounded retry on violation (like `generateAdPlan`).
4. return typed `{ report, opportunities }`.

## Validator (`src/lib/growth/validateSituationReport.ts`) — enforce in code what the skill enforces in prose
- Every numeric claim in a flag/opportunity must resolve to a **pack path** (no invented figures — "you read,
  you never compute").
- `instrument ∈` the menu `{whatsapp, ads, page, price, minstay, los, ota, none}`.
- Each `opportunity.window ⊆` a real `inventory.freeRuns` entry (narrows-never-widens).
- **`none` (do nothing) is always valid** — a system that can't say "this is normal" can't be trusted.

## Server actions (`src/app/admin/situation/actions.ts`)
- `runAnalysisAction(propertyId)` → run → persist report + opportunities → `runId`.
- `reRunWithSteerAction(runId, steer)` → re-run with the owner's challenge → supersede.
- `editOpportunityAction(oppId, patch)` → edit window/instrument/framing/value + `ownerNote`.
- `approveOpportunityAction(oppId)` → **route to the arm**: ads → `generateAdProposalAction`/`planAndCreative`
  (a Firestore-only ad draft); whatsapp → the campaigns generate flow; page → page-post; price/none → mark
  actioned (owner acts). Records `handoffRef`.
- `dismissOpportunityAction(oppId, reason)` / `snoozeOpportunityAction(oppId, until)`.

## The Admin surface (`/admin/situation`)
- **[Run analysis]** button.
- **Latest report**: headline · flags (each with its evidence path+value) · NORMAL · questions · confidence ·
  caveats.
- **Opportunities**: each card = window · instrument · value · rationale · *what it rejected* +
  **[Edit] [Challenge] [Approve] [Dismiss] [Snooze]**. Challenge = a note box → re-run (supersede) → new report.
- Approved cards show the hand-off (e.g. "→ ad draft `/admin/ads/{id}`").

## Human-in-the-loop — two review layers, nothing auto-executes
1. **Shape the thinking** (this surface): read evidence → edit / challenge-rerun / approve / dismiss.
2. **Shape the execution** (the arm): the ad review-before-push / WhatsApp Gate-1 — a second look.
Nothing spends or sends without passing **both**. Owner dispositions (approved/edited/dismissed + reasons) are
recorded — the raw material for calibrating the brain to the owner's judgment.

## Guardrails
- The analyst **proposes**; it never sends or spends. No money/send path in this service.
- The validator enforces truth + menu + window in code.
- The arms' existing gates (two-switch, spend cap, consent/suppression) are untouched.
- `situationReports` + `opportunities` = Admin-SDK-only writes; super-admin/owner read (firestore.rules).

## Phases (each shippable + tested; stop between)
- **P1 — pack in-app.** Extract the full pack builder → `src/lib/growth/situationPack.ts`
  (`buildSituationPack(propertyId, asOf)`); `scripts/situation-pack.ts` becomes a thin CLI wrapper. **Verify
  byte-identical** output (same diff technique as Move 1). *Prereq for everything.*
- **P2 — analyst service + validator + `SituationReport` type.** Test on live data; compare the typed output
  against the skill's Situation Report for the same week.
- **P3 — landing + read-only Admin.** Persist reports+opportunities; a read-only `/admin/situation` (report +
  opportunities + evidence). *You can read + we calibrate before any actions exist.*
- **P4 — the human loop.** Edit / challenge-rerun / dismiss / snooze + dispositions.
- **P5 — approve → arm hand-off.** Approve routes the (possibly edited) opportunity into the existing arm
  draft flows (which keep their own review gates).
- **Deferred:** weekly cron (owner's call, later); per-arm ledger wiring (M4); WhatsApp in-app planner (M6).

## Definition of done (Move 2)
Admin **[Run analysis]** → a validated Situation Report + routed Opportunities appear, every number cited to
the pack. The owner reads the evidence, edits/challenges/re-runs, and approves → the matching arm produces a
draft (with its own review). *"The analyst routes in code"* is now true. Nothing executes without the owner's
two approvals.
