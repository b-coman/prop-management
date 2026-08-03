/**
 * contracts — the typed artifacts the Opportunity-Engine stages pass to each other.
 *
 * The pipeline is analyst → planner → copywriter → the existing admin/outbox flow. Each stage
 * emits a human-readable report AND a JSON object conforming to the schema here; the next stage
 * consumes that object. In the skill/prototype phase the "bus" is just files on disk; the same
 * types are reused unchanged when the chain is orchestrated in-app. Keeping the contracts in one
 * place is what lets disparate agents communicate structurally (plan §2 principle 4).
 *
 * Pure types + a couple of pure guards — no Firestore, no network.
 */
import type { AdObjective, CityTarget, LanguageCode } from '@/types';

// ── analyst → router → per-instrument planner ────────────────────────────────
/**
 * The instrument the analyst routed an opportunity to (promotion-system-architecture.md §3.3/§3.4).
 * ONE shared detector, MANY responses: a warm past-guest message (`whatsapp`), a paid acquisition
 * push to strangers (`ads`), or an organic brand post (`page`). Each instrument has its own planner
 * downstream — this field says which one owns a given opportunity. The analyst emits the general
 * `Opportunity`; the router/planners narrow (see the subtypes below).
 */
export type OpportunityInstrument = 'whatsapp' | 'ads' | 'page';

/** One sized/dated/priced opportunity the analyst routed to an instrument (plan §3.1). */
export interface Opportunity {
  id: string;
  propertyId: string;
  source: 'gap' | 'named_period' | 'cancellation';
  window: { start: string; end: string; nights: number };   // YYYY-MM-DD
  daysOut: number;
  occasion?: { name: string; type: string; startDate: string; endDate: string; source?: string | null } | null;
  valueAtRisk?: number | null;                              // nights × baseline ADR, if known
  instrument: OpportunityInstrument;                        // which instrument the analyst routed it to
  rationale?: string;
}

/**
 * Instrument-narrowed opportunity subtypes. Each arm's planner consumes ONLY its own kind — the
 * WhatsApp planner/copywriter path takes a `WhatsAppOpportunity`, the ad planner (being built) an
 * `AdOpportunity`, the page planner a `PageOpportunity`. Narrowing here makes a mis-routed
 * opportunity a COMPILE error, not a runtime surprise, while the analyst still emits the general
 * `Opportunity`.
 */
export type WhatsAppOpportunity = Opportunity & { instrument: 'whatsapp' };
export type AdOpportunity = Opportunity & { instrument: 'ads' };
export type PageOpportunity = Opportunity & { instrument: 'page' };

// ── analyst output: the Situation Report + its recommendations (Move 2, arch §7 M2) ──────────────
/**
 * The analyst's FULL instrument menu — deliberately broader than `OpportunityInstrument` (which is
 * only the three campaign arms). The analyst may recommend a price/min-stay/LOS/OTA change or, most
 * importantly, `none` (do nothing). Only `CAMPAIGN_ACTIONS` have a downstream arm; the rest are owner
 * actions surfaced for the human to act on. A routable recommendation converts to a narrow
 * `Opportunity` at hand-off (P5).
 */
export type RecommendedAction = OpportunityInstrument | 'price' | 'minstay' | 'los' | 'ota' | 'none';
export const CAMPAIGN_ACTIONS = ['whatsapp', 'ads', 'page'] as const;
export function isRoutable(o: Pick<AnalystOpportunity, 'action'>): boolean {
  return (CAMPAIGN_ACTIONS as readonly string[]).includes(o.action);
}

/** One ranked flag in the Situation Report. `evidence` is the grounding contract: a pack path + the value there. */
export interface Flag {
  severity: 'red' | 'amber' | 'yellow';
  what: string;
  evidence: { path: string; value: string };
  whoActs: 'owner' | 'system';
}

/**
 * The analyst's diagnosis — the typed twin of the `situation-analyst` skill's text Situation Report.
 * Every number must trace to the pack (the validator checks flag evidence paths). "Nothing is wrong"
 * is a valid, important output — that is what `normal` + an empty/low-severity `flags` express.
 */
export interface SituationReport {
  headline: string;
  flags: Flag[];                                   // ranked by money at risk
  normal: string[];                                // what looks alarming but isn't, and why
  questions: string[];                             // what the data cannot explain (a human answer would change the call)
  confidence: { sure: string[]; thin: string[]; guessing: string[] };
  packGaps?: string[];                             // facts it needed and could not get
}

/**
 * One recommendation the analyst routed to an action. If `action ∈ CAMPAIGN_ACTIONS` it has an arm
 * (P5 hand-off → a PAUSED draft); otherwise it is an owner action (price/min-stay/OTA) or `none`.
 * The analyst EMITS this shape; the service adds id/propertyId/source when persisting (P3).
 */
export interface AnalystOpportunity {
  window?: { start: string; end: string; nights: number } | null;   // the dated window (absent for price/ota/none)
  occasion?: string | null;
  valueAtRisk?: number | null;                     // money at stake, cited from the pack, if known
  action: RecommendedAction;
  audience?: string | null;                        // for campaign actions: who to reach
  rationale: string;                               // why this action fits the size + cause
  rejected?: string | null;                        // the instrument(s) it considered and rejected, and why
}

/** The analyst's complete output: the diagnosis + the routed recommendations. */
export interface AnalystOutput {
  report: SituationReport;
  opportunities: AnalystOpportunity[];
}

// ── planner → copywriter / validator / createManualCampaign ──────────────────
export type CampaignIntent = 'gap_fill' | 'share';

/** One selected recipient, with the planner's per-guest reasoning. */
export interface BriefAudienceEntry {
  guestId: string;
  angle: string;                 // why this guest, in one line (due? fit? relationship?)
  careFlags?: string[];          // e.g. ['complaint-in-thread'] — the copywriter must handle gently
  additive?: boolean;            // true = a first-timer appended ON TOP of the warm audience (does NOT
                                 // count against the run cap; a first WhatsApp contact for a fitting guest)
}

/**
 * The offer, as part of the campaign FRAMING (owner-editable). A superset so a plain percent
 * offer stays `{discountPct}` (back-compat) while richer forms carry their own params. Whatever
 * the form, `effectiveDiscountPct()` derives the economic size the margin guard checks — the
 * copywriter only ever PHRASES this (channel-aware), never inflates it.
 */
export type CampaignOfferType = 'percent' | 'free_night' | 'fixed' | 'none';

export interface CampaignOffer {
  type?: CampaignOfferType;
  discountPct?: number | null;   // percent offers (also the back-compat field)
  freeNightAfter?: number;       // free_night: stay N nights, the (N+1)th is free
  amount?: number;               // fixed: absolute amount off (currency = RON)
  description: string;           // human phrasing shown at the gate; the copywriter may reword per guest
}

/**
 * A campaign-level UPDATE to announce (part of the framing). `effectiveDate` is what makes it
 * TRUTHFUL to call "new": the copywriter-pack surfaces an update to a guest ONLY if their last
 * stay predates it (they haven't experienced it). Whether it's worth mentioning to that guest,
 * and how, is the copywriter's judgment — this only bounds it to guests it's genuinely new to.
 */
export interface CampaignUpdate {
  id: string;                    // stable slug, e.g. 'fire-pit'
  text: string;                  // what changed, in the owner's words
  effectiveDate: string;         // YYYY-MM-DD — only guests whose last stay is BEFORE this hear it as new
}

/** The planner's typed output — the draft FRAMING the human gate edits before the copywriter runs (§7.4). */
export interface CampaignBrief {
  propertyId: string;
  opportunity: WhatsAppOpportunity;   // the WhatsApp arm only ever plans a whatsapp-routed opportunity
  act: boolean;                  // false = decline; audience must then be empty
  intent: CampaignIntent;
  occasion: { name: string | null; point: string };   // the "what & why now"
  offer: CampaignOffer;
  updates?: CampaignUpdate[];                           // news to weave in, date-targeted (framing)
  audience: BriefAudienceEntry[];                       // ⊆ the eligible set (enforced by validatePlan)
  generalAngle: string;                                 // the brief the copywriter particularises
  rationale: string;
}

/**
 * Derive the economic size of an offer as a percentage, for the margin guard. Pure.
 * - percent    → discountPct
 * - free_night → 1/(freeNightAfter+1)  (stay 3 get 4th free = 25%)
 * - none       → 0
 * - fixed      → null (can't be a % without an ADR; the guard warns rather than blocks)
 */
export function effectiveDiscountPct(offer: CampaignOffer | undefined | null): number | null {
  if (!offer) return null;
  const type = offer.type ?? (offer.discountPct != null ? 'percent' : 'none');
  switch (type) {
    case 'none': return 0;
    case 'percent': return offer.discountPct ?? 0;
    case 'free_night': {
      const n = offer.freeNightAfter ?? 0;
      return n > 0 ? Math.round((1 / (n + 1)) * 100) : null;
    }
    case 'fixed': return null;
    default: return offer.discountPct ?? null;
  }
}

// ── ad planner → ad creative intelligence / validateAdPlan ───────────────────
/**
 * The ad planner's typed output — the reviewable BRIEF for a Meta acquisition push
 * (promotion-system-architecture.md §4.2, the twin of `CampaignBrief`). The planner
 * decides WHERE (geo), HOW MUCH (budget), HOW LONG (end time), and the ANGLE; it does
 * NOT write copy or pick photos — that is the creative intelligence (step 4), which
 * turns this brief into a PAUSED Meta ad via `adComposer.composeAndCreateAd`.
 *
 * `targeting.cities` and `objective` reuse the NEUTRAL `@/types` shapes so a validated
 * brief threads straight into `ComposeAndCreateAdInput` without remapping. No age/gender/
 * interests: the composer's baked `advantage_audience:1` OWNS demographics (§9f) — geo +
 * copy qualify the audience. `validateAdPlan` is the money/margin gate (budget ceiling,
 * future end time, geo present, cities ⊆ the pack's candidates — narrows-never-widens).
 */
/**
 * The operator (or analyst) FRAMING that shapes an ad to the OUTCOME + AUDIENCE, on top of the
 * opportunity's period/occasion. Threaded through the planner's `creativeBrief` so the copy AND the
 * photo choice BOTH bend to it — the connective tissue that makes the ad one coherent thing rather
 * than disparate stages. `audience` steers the copy ANGLE + photo THEMES (not Meta demographics —
 * Advantage+ owns those), so a "couples, off-peak, food-and-fire" ad reads and looks different from
 * a "families, school-break, playground" ad for the very same window.
 */
export interface AdFraming {
  /** What success looks like — e.g. "fill these nights with high-margin DIRECT bookings", not just clicks. */
  goal?: string;
  /** Who the ad is for — e.g. "adult couples for a quiet off-peak weekend" / "families with kids for the school break". */
  audience?: string;
}

export interface AdBrief {
  propertyId: string;
  opportunity: AdOpportunity;   // the ads arm only ever plans an ads-routed opportunity
  act: boolean;                 // false = decline; a declined plan carries no targeting
  objective: AdObjective;       // 2a: 'sales' (→ Meta OUTCOME_SALES)
  targeting: {
    /** Selected city targets — a SUBSET of the pack's candidate cities (validateAdPlan enforces). */
    cities: CityTarget[];
  };
  dailyBudgetMinor: number;     // bani — ≤ MAX_DAILY_BUDGET_MINOR (validated)
  endTime: string;              // ISO 8601 — bounds the run + the spend-cap math
  creativeBrief: string;        // the brief the creative intelligence particularises: what to say/show, tone, which photo themes
  rationale: string;            // why this geo / budget / timing
}

// ── copywriter → grounding validator / outbox ────────────────────────────────
/** One drafted, per-guest message (plan §7.5). `factsUsed` is the grounding contract. */
export interface DraftMessage {
  guestId: string;
  language: LanguageCode;
  body: string;
  factsUsed: string[];           // every guest-specific claim, each keyed to a groundedFacts entry
  careHandled?: string;          // how a careFlag was addressed (e.g. resolved-issue PS)
}

// ── landing: planner brief + copywriter drafts → a reviewable draft campaign ──
/**
 * One recipient's fully-prepared row, ready for Gate-1 review: the planner's per-guest
 * reasoning (`angle`, `careFlags`) joined to the copywriter's bespoke `body`. This is what
 * the owner sees and edits in Admin, and what queues to the outbox verbatim on approve.
 */
export interface ProposedDraft {
  guestId: string;
  angle: string;              // from the brief — why this guest (shown at Gate 1)
  careFlags?: string[];       // carried from the brief for the reviewer's context
  additive?: boolean;         // a first-timer added on top of the warm audience (badged at Gate 1)
  language: LanguageCode;
  body: string;               // the copywriter's per-guest message
  factsUsed: string[];        // grounding contract (already validated)
  careHandled?: string;
}

/** The campaign-level "what & why now" stored alongside the per-guest drafts. */
export interface CampaignProposal {
  intent: CampaignIntent;
  occasion: { name: string | null; point: string };
  offer: CampaignOffer;
  updates?: CampaignUpdate[];
  generalAngle: string;
  rationale: string;
  opportunity: WhatsAppOpportunity;
}

// ── pure guards / joins ──────────────────────────────────────────────────────
export function briefGuestIds(brief: Pick<CampaignBrief, 'audience'>): string[] {
  return brief.audience.map((a) => a.guestId);
}

export function isDeclined(brief: Pick<CampaignBrief, 'act' | 'audience'>): boolean {
  return !brief.act && brief.audience.length === 0;
}

/**
 * Join a validated brief + drafts into per-guest reviewable rows. Pure. Assumes both were
 * already validated (validatePlan + validateDrafts) so coverage is 1:1 — a guest in the brief
 * with no matching draft is dropped here (the validators are the gate, not this join).
 */
export function toProposedDrafts(
  brief: Pick<CampaignBrief, 'audience'>,
  drafts: DraftMessage[]
): ProposedDraft[] {
  const draftFor = new Map(drafts.map((d) => [d.guestId, d]));
  const rows: ProposedDraft[] = [];
  for (const a of brief.audience) {
    const d = draftFor.get(a.guestId);
    if (!d) continue;
    // Default every optional field — Firestore's Admin SDK rejects `undefined` on write, and these
    // are persisted verbatim by createProposedCampaign/setCampaignDrafts.
    rows.push({
      guestId: a.guestId,
      angle: a.angle ?? '',
      careFlags: a.careFlags ?? [],
      additive: a.additive ?? false,
      language: d.language,
      body: d.body,
      factsUsed: d.factsUsed ?? [],
      careHandled: d.careHandled ?? '',
    });
  }
  return rows;
}

/** Extract the campaign-level proposal metadata from a brief. Pure. */
export function toCampaignProposal(brief: CampaignBrief): CampaignProposal {
  return {
    intent: brief.intent,
    occasion: brief.occasion,
    offer: brief.offer,
    updates: brief.updates ?? [],
    generalAngle: brief.generalAngle,
    rationale: brief.rationale,
    opportunity: brief.opportunity,
  };
}
