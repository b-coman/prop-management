/**
 * validatePlan — the deterministic gate between the WhatsApp planner (an LLM) and anything that
 * queues. Enforces plan §2 principle 1 ("the LLM narrows, never widens") in CODE, not in a human
 * spot-check: a planner is a language model, so the guarantee that it only ever selected eligible,
 * in-cap, offer-legal guests has to be a pure function that runs every time.
 *
 * This is the PLANNER-stage validator (narrows-never-widens · run cap · offer inequality). The
 * COPYWRITER-stage duties (grounding: only-true facts · voice conformance · self-ID/opt-out) are a
 * separate validator that ships with the copywriter (§7.7). Keep them separate; they check
 * different artifacts.
 *
 * Pure — no Firestore, no network — so it is exhaustively unit-testable and safe to import from
 * both the prototype CLI (scripts/validate-plan.ts) and the eventual in-app orchestration.
 * The executionGateway re-runs its own gates at send time regardless; this is the earlier,
 * campaign-level backstop that stops a bad plan from ever reaching the outbox.
 */

import type { CampaignBrief } from './contracts';
import { effectiveDiscountPct } from './contracts';

/** The subset of the planner pack this validator needs. */
export interface PlannerPackForValidation {
  constraints: { runCap: number };
  offer: { maxDiscountPct: number | null };
  audience: {
    eligible: Array<{ guestId: string }>;
    ineligible?: Array<{ guestId: string }>;
  };
}

export interface PlanValidationResult {
  ok: boolean;
  errors: string[];   // hard failures — reject the whole plan (feed back to the planner; §7.4 repair loop)
  warnings: string[]; // worth surfacing at Gate 1 but not blocking
  stats: { selected: number; eligible: number; runCap: number };
}

/**
 * Validate a planner CampaignBrief against its pack. The errors are written to be repair-prompt-
 * ready: on failure, feed them back to the planner (bounded to 1–2 retries), then escalate to the
 * human. Never silently drop the offending ids and proceed — that hides a reasoning defect.
 */
export function validatePlan(
  pack: PlannerPackForValidation,
  brief: Pick<CampaignBrief, 'act' | 'audience' | 'offer'>
): PlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const eligible = new Set(pack.audience.eligible.map((g) => g.guestId));
  const ineligible = new Set((pack.audience.ineligible ?? []).map((g) => g.guestId));
  const ids = brief.audience.map((a) => a.guestId);
  const cap = pack.constraints.runCap;

  // A plan that declined to act is valid iff it selected nobody.
  if (!brief.act) {
    if (ids.length > 0) {
      errors.push(`act:false but ${ids.length} guest(s) selected — a declined plan must select nobody`);
    }
    return { ok: errors.length === 0, errors, warnings, stats: { selected: ids.length, eligible: eligible.size, runCap: cap } };
  }

  // 1. Narrows-never-widens: every selected id must be in the eligible set.
  const notEligible = ids.filter((id) => !eligible.has(id));
  if (notEligible.length) {
    // Distinguish "reached into the ineligible set" from "invented an id" — different failure modes.
    const fromIneligible = notEligible.filter((id) => ineligible.has(id));
    const invented = notEligible.filter((id) => !ineligible.has(id));
    if (fromIneligible.length) errors.push(`selected ${fromIneligible.length} INELIGIBLE guest(s): ${fromIneligible.join(', ')}`);
    if (invented.length) errors.push(`selected ${invented.length} UNKNOWN guest id(s) not in the pack: ${invented.join(', ')}`);
  }

  // 2. No duplicates.
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) errors.push(`duplicate guest id(s): ${[...new Set(dupes)].join(', ')}`);

  // 3. Run cap.
  if (ids.length > cap) errors.push(`selected ${ids.length} > run cap ${cap}`);

  // 4. Empty acting plan.
  if (ids.length === 0) errors.push('act:true but no guests selected');

  // 5. Offer inequality: whatever the offer FORM (percent, free-night, fixed), its economic size
  // must not exceed the ceiling that keeps direct above OTA net. effectiveDiscountPct() derives it.
  const d = effectiveDiscountPct(brief.offer);
  if (d == null && brief.offer?.type === 'fixed') {
    warnings.push('a fixed-amount offer was set — its % value depends on the nightly rate; confirm it keeps direct above OTA net manually');
  } else if (d != null && d > 0) {
    const ceiling = pack.offer.maxDiscountPct;
    if (ceiling == null) {
      warnings.push(`an offer worth ~${d}% was set but the pack has no maxDiscountPct (missing net-ADR data) — confirm the offer manually`);
    } else if (d > ceiling) {
      errors.push(`offer worth ~${d}% exceeds the ceiling ${ceiling}% — it would give away the direct-channel margin (§0.5 offer inequality)`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, stats: { selected: ids.length, eligible: eligible.size, runCap: cap } };
}
