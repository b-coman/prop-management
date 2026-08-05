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
 *   1b. Audience   — a LEAD never stayed, so any phrase asserting a past stay is a factual error.
 *   2. Voice       — emoji kept light; self-ID present; length in range; an opt-out for a first
 *                    contact, for anyone who never engaged, and for every lead.
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
  /** 'lead' = never stayed. Stay language is a factual error for them, not a style choice. */
  audienceKind?: 'guest' | 'lead';
  /** Cross-channel state from the pack (a logged phone call counts, unlike thread length alone). */
  relationshipState?: 'first-contact' | 'silent' | 'active' | 'lapsed';
}

/**
 * Phrases that assert a past stay. Harmless for a guest, false for a lead — and a message that
 * tells someone "it was lovely having you" when they never came is the one error that cannot be
 * walked back. Deliberately narrow: only patterns that CLAIM a stay, not warm language in general.
 */
const CLAIMS_A_STAY = /\b(c[âa]nd a[țt]i fost la noi|c[âa]nd ai fost la noi|de c[âa]nd a[țt]i stat|c[âa]nd a[țt]i stat|ne-a[țt]i vizitat|a[țt]i fost oaspe|ne bucur[ăa]m c[ăa] a[țt]i stat|sper c[ăa] v-a pl[ăa]cut (sejurul|vizita)|last time you stayed|when you stayed with us|your stay with us)\b/i;

export interface DraftRules {
  minChars?: number; maxChars?: number;
  selfIdMarkers?: string[];             // any one must appear (case-insensitive, diacritic-loose)
  optOutMarkers?: string[];             // any one must appear on a first contact
}

const DEFAULTS: Required<DraftRules> = {
  minChars: 200, maxChars: 700,
  selfIdMarkers: ['bogdan', 'comarnic', 'casuta', 'căsuța'],
  optOutMarkers: ['stop', 'dezabon', 'nu va mai', 'nu te mai', 'nu iti mai scriu', 'nu mai doriti', 'nu mai vreti', 'spuneti-mi', 'scrieti-mi', 'nu va mai deranjez'],
};
// Emoji are ALLOWED (the owner uses them lightly in his real messages) — we only flag OVERUSE.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;
const EMOJI_MAX = 3;
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

    // 1b. a lead never stayed — stay language is a factual error, not a stylistic one
    const isLead = g.audienceKind === 'lead';
    if (isLead && CLAIMS_A_STAY.test(body)) {
      errors.push('claims a past stay for a LEAD who has never stayed — build on what they asked for (requestedPeriod / nonConversionReason), not on a visit that never happened');
    }

    // 2. voice
    // A logged phone call makes someone NOT a first contact even with an empty thread, and leaves
    // them a first contact despite a full thread only when they never engaged at all — so prefer
    // the pack's cross-channel state and fall back to thread length.
    const firstContact = g.relationshipState ? g.relationshipState === 'first-contact' : (g.thread || []).length === 0;
    const emojiCount = (body.match(EMOJI) || []).length;
    if (emojiCount > EMOJI_MAX) warnings.push(`${emojiCount} emoji — keep them light (1-2, only to underline)`);
    // Self-ID: a first/cold contact MUST say who is writing (a stranger needs it); when continuing an
    // active thread, re-introducing reads as a form letter — so it is only a soft nudge there.
    if (!r.selfIdMarkers.some((m) => loose(body).includes(loose(m)))) {
      if (firstContact) errors.push('no self-identification (a first contact must say who is writing)');
      else warnings.push('no self-identification (fine when continuing an active thread)');
    }
    if (body.length < r.minChars) errors.push(`too short (${body.length} < ${r.minChars})`);
    else if (body.length > r.maxChars) warnings.push(`long (${body.length} > ${r.maxChars})`);
    // Opt-out: required for a first contact, for anyone who has never engaged, and for every lead —
    // an enquiry that never became a stay is a thinner basis for writing again than a real stay is.
    const needsOptOut = firstContact || isLead || g.relationshipState === 'silent';
    if (needsOptOut && !r.optOutMarkers.some((m) => loose(body).includes(loose(m)))) {
      warnings.push(`no opt-out line found (${isLead ? 'lead' : firstContact ? 'first contact' : 'never engaged'})`);
    }

    return { guestId: d.guestId, errors, warnings };
  });

  const ok = campaignErrors.length === 0 && perGuest.every((p) => p.errors.length === 0);
  return { ok, perGuest, errors: campaignErrors };
}
