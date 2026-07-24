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
import type { LanguageCode } from '@/types';

// ── analyst → planner ────────────────────────────────────────────────────────
/** One routed opportunity the analyst decided WhatsApp should act on (plan §3.1). */
export interface Opportunity {
  id: string;
  propertyId: string;
  source: 'gap' | 'named_period' | 'cancellation';
  window: { start: string; end: string; nights: number };   // YYYY-MM-DD
  daysOut: number;
  occasion?: { name: string; type: string; startDate: string; endDate: string; source?: string | null } | null;
  valueAtRisk?: number | null;                              // nights × baseline ADR, if known
  instrument: 'whatsapp';                                   // the analyst routed it here
  rationale?: string;
}

// ── planner → copywriter / validator / createManualCampaign ──────────────────
export type CampaignIntent = 'gap_fill' | 'share';

/** One selected recipient, with the planner's per-guest reasoning. */
export interface BriefAudienceEntry {
  guestId: string;
  angle: string;                 // why this guest, in one line (due? fit? relationship?)
  careFlags?: string[];          // e.g. ['complaint-in-thread'] — the copywriter must handle gently
}

/**
 * The offer, as part of the campaign FRAMING (owner-editable). A superset so a plain percent
 * offer stays `{discountPct}` (back-compat) while richer forms carry their own params. Whatever
 * the form, `effectiveDiscountPct()` derives the economic size the margin guard checks — the
 * copywriter only ever PHRASES this (channel-aware), never inflates it.
 */
export interface CampaignOffer {
  type?: 'percent' | 'free_night' | 'fixed' | 'none';
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
  opportunity: Opportunity;
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
  opportunity: Opportunity;
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
    rows.push({
      guestId: a.guestId,
      angle: a.angle,
      careFlags: a.careFlags,
      language: d.language,
      body: d.body,
      factsUsed: d.factsUsed,
      careHandled: d.careHandled,
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
