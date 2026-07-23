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

/** The planner's typed output — validated before anything queues (plan §7.4). */
export interface CampaignBrief {
  propertyId: string;
  opportunity: Opportunity;
  act: boolean;                  // false = decline; audience must then be empty
  intent: CampaignIntent;
  occasion: { name: string | null; point: string };   // the "what & why now"
  offer: { discountPct: number | null; description: string };
  audience: BriefAudienceEntry[];                       // ⊆ the eligible set (enforced by validatePlan)
  generalAngle: string;                                 // the brief the copywriter particularises
  rationale: string;
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

// ── pure guards ──────────────────────────────────────────────────────────────
export function briefGuestIds(brief: Pick<CampaignBrief, 'audience'>): string[] {
  return brief.audience.map((a) => a.guestId);
}

export function isDeclined(brief: Pick<CampaignBrief, 'act' | 'audience'>): boolean {
  return !brief.act && brief.audience.length === 0;
}
