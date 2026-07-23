/**
 * validateDrafts — the deterministic gate between the WhatsApp copywriter (an LLM) and the outbox.
 * The COPYWRITER-stage validator; the planner-stage one is validatePlan. It enforces the three
 * duties from plan §7.6–7.7:
 *
 *   1. Grounding   — every declared factsUsed key exists in that guest's groundedFacts. This is a
 *                    DECLARED-fact check, not prose-claim extraction (undecidable): the copywriter
 *                    must declare each guest-specific claim, and we verify the declarations are all
 *                    grounded. Also: no affection/"we-fixed-it" claim for a complaint guest unless a
 *                    grounded issueResolved:* fact backs it.
 *   2. Voice       — no emoji; self-ID present; length in range; opt-out iff first contact.
 *   3. Coverage    — exactly one draft per selected guest, each with matching phone/language later
 *                    (phone/lang are re-checked at send by executionGateway).
 *
 * Pure — importable by the prototype CLI and the eventual in-app orchestration. A failure feeds
 * back to the copywriter (bounded repair, §7.4 pattern); never queue an ungrounded message.
 */
import type { DraftMessage } from './contracts';

export interface GuestForDraftValidation {
  guestId: string;
  careFlags?: string[];
  groundedFacts: Array<{ key: string; value: unknown }>;
  thread: Array<unknown>;               // length 0 ⇒ first contact ⇒ opt-out required
}

export interface DraftRules {
  minChars?: number; maxChars?: number;
  selfIdMarkers?: string[];             // any one must appear (case-insensitive, diacritic-loose)
  optOutMarkers?: string[];             // any one must appear on a first contact
}

const DEFAULTS: Required<DraftRules> = {
  minChars: 200, maxChars: 700,
  selfIdMarkers: ['bogdan', 'comarnic', 'casuta', 'căsuța'],
  optOutMarkers: ['stop', 'dezabon', 'nu va mai', 'nu mai doriti', 'nu mai vreti', 'spuneti-mi', 'scrieti-mi', 'nu va mai deranjez'],
};
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️]/u;
const COMPLAINT_WORDS = /problem|scuze|imi pare rau|îmi pare rău|neplac|deranj|presiune|defect|stricat|reparat|rezolvat/i;
const loose = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface DraftsValidationResult {
  ok: boolean;
  perGuest: Array<{ guestId: string; errors: string[]; warnings: string[] }>;
  errors: string[];   // campaign-level (coverage)
}

export function validateDrafts(
  guests: GuestForDraftValidation[],
  drafts: DraftMessage[],
  rules: DraftRules = {}
): DraftsValidationResult {
  const r = { ...DEFAULTS, ...rules };
  const byGuest = new Map(guests.map((g) => [g.guestId, g]));
  const draftFor = new Map(drafts.map((d) => [d.guestId, d]));
  const campaignErrors: string[] = [];

  // coverage: exactly one draft per selected guest, and no draft for an unselected guest.
  for (const g of guests) if (!draftFor.has(g.guestId)) campaignErrors.push(`no draft for selected guest ${g.guestId}`);
  for (const d of drafts) if (!byGuest.has(d.guestId)) campaignErrors.push(`draft for a guest not in the brief: ${d.guestId}`);
  const dupes = drafts.map((d) => d.guestId).filter((id, i, a) => a.indexOf(id) !== i);
  if (dupes.length) campaignErrors.push(`multiple drafts for: ${[...new Set(dupes)].join(', ')}`);

  const perGuest = drafts.filter((d) => byGuest.has(d.guestId)).map((d) => {
    const g = byGuest.get(d.guestId)!;
    const errors: string[] = []; const warnings: string[] = [];
    const facts = new Set(g.groundedFacts.map((f) => f.key));
    const body = d.body || '';

    // 1. grounding — declared facts must all be whitelisted
    const ungrounded = (d.factsUsed || []).filter((k) => !facts.has(k));
    if (ungrounded.length) errors.push(`ungrounded factsUsed (not in groundedFacts): ${ungrounded.join(', ')}`);

    // sentiment: complaint guest + no grounded resolution ⇒ must not touch the problem
    const isComplaint = (g.careFlags || []).includes('complaint-in-thread');
    const hasResolved = [...facts].some((k) => k.startsWith('issueResolved'));
    if (isComplaint && !hasResolved && COMPLAINT_WORDS.test(body)) {
      errors.push('references a past problem for a complaint guest with no grounded issueResolved fact — write forward-looking, do not mention it');
    }

    // 2. voice
    if (EMOJI.test(body)) errors.push('contains emoji (forbidden)');
    if (!r.selfIdMarkers.some((m) => loose(body).includes(loose(m)))) errors.push('no self-identification (open by saying who is writing)');
    if (body.length < r.minChars) errors.push(`too short (${body.length} < ${r.minChars})`);
    else if (body.length > r.maxChars) warnings.push(`long (${body.length} > ${r.maxChars})`);
    const firstContact = (g.thread || []).length === 0;
    if (firstContact && !r.optOutMarkers.some((m) => loose(body).includes(loose(m)))) warnings.push('first contact but no opt-out line found');

    return { guestId: d.guestId, errors, warnings };
  });

  const ok = campaignErrors.length === 0 && perGuest.every((p) => p.errors.length === 0);
  return { ok, perGuest, errors: campaignErrors };
}
