/**
 * copywriter (in-app) — turns an approved campaign FRAMING (CampaignBrief) into one grounded,
 * voice-matched WhatsApp message per selected guest, by calling Claude with the deterministic
 * copywriter fact pack. This is the server-side runtime of the .claude/skills/whatsapp-copywriter
 * skill: same pack, same rules, same grounding contract — just executed in-app so the owner can
 * hit "Generate" in Admin instead of an operator running it.
 *
 * Guardrails on truth + margin are enforced in CODE (validateDrafts: factsUsed ⊆ groundedFacts,
 * no emoji, self-ID, opt-out, sentiment). The LLM owns relevance, presentation, and voice. A
 * bounded repair loop feeds validator errors back once before giving up.
 *
 * Server-only. Degrades (throws a clear error) if ANTHROPIC_API_KEY is absent.
 */
import { getAnthropicClient, COPYWRITER_MODEL } from '@/lib/growth/anthropic';
import { buildCopywriterPack } from '@/lib/growth/copywriterPack';
import { validateDrafts, type GuestForDraftValidation } from '@/lib/growth/validateDrafts';
import type { CampaignBrief, DraftMessage } from '@/lib/growth/contracts';
import { loggers } from '@/lib/logger';

const logger = loggers.campaign;

const DRAFTS_TOOL = {
  name: 'emit_drafts',
  description: 'Emit the final per-guest WhatsApp drafts, one object per selected guest.',
  input_schema: {
    type: 'object' as const,
    properties: {
      drafts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            guestId: { type: 'string' },
            language: { type: 'string', enum: ['ro', 'en'] },
            body: { type: 'string', description: 'the full message, ready to send' },
            factsUsed: { type: 'array', items: { type: 'string' }, description: 'the groundedFacts key of every guest-specific claim made' },
            careHandled: { type: 'string', description: 'how any careFlag was handled (empty if none)' },
          },
          required: ['guestId', 'language', 'body', 'factsUsed'],
        },
      },
    },
    required: ['drafts'],
  },
};

const SYSTEM = `You are the WhatsApp copywriter for a small Romanian mountain-chalet rental. You write one
message per selected past guest, in the OWNER's voice, grounded in what is genuinely true about THAT
guest, never a broadcast. You draft only — the owner reviews and sends by hand.

THE THREE RULES
1. Ground every guest-specific claim. You may only state a fact about a guest that appears in that
   guest's groundedFacts. List in factsUsed the exact keys of every guest-specific claim you made.
   Never invent stays, preferences, names, numbers, or updates. The thread is for AVOIDING repetition
   and matching tone — not a licence to assert new facts.
2. Write in the owner's voice (study voiceProfile.exemplars — lean toward what "booked"; copy the
   register, not the content) and in each guest's writeLanguage. Romanian WITHOUT diacritics. Obey
   every rule in voiceRules (length, no emoji, self-identification on line one, opt-out only on a
   first contact = empty thread, offer presentation, updates).
3. Positive and careful. Every message is warm and forward-looking. Follow voiceRules.sentiment for
   any careFlag; never reference an unresolved problem.

Return your work by calling the emit_drafts tool with exactly one draft per guest in the pack — no
prose, no extra guests, none skipped.`;

function packGuestsForValidation(pack: Awaited<ReturnType<typeof buildCopywriterPack>>): GuestForDraftValidation[] {
  return pack.guests
    .filter((g: any) => !g.error)
    .map((g: any) => ({ guestId: g.guestId, careFlags: g.careFlags || [], groundedFacts: g.groundedFacts || [], thread: g.thread || [] }));
}

export interface GenerateDraftsResult {
  ok: boolean;
  drafts: DraftMessage[];
  errors: string[];
  warnings: string[];
  attempts: number;
}

/**
 * Generate per-guest drafts for a framing. Runs the LLM, validates, and on failure feeds the
 * validator errors back for ONE bounded repair before returning (ok:false + errors) — never
 * silently ships an ungrounded message.
 */
export async function generateDrafts(brief: CampaignBrief, opts?: { asOf?: Date; maxRepairs?: number }): Promise<GenerateDraftsResult> {
  const client = getAnthropicClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY not configured — the in-app copywriter is unavailable');

  const pack = await buildCopywriterPack(brief, { asOf: opts?.asOf });
  const validationGuests = packGuestsForValidation(pack);
  const maxRepairs = opts?.maxRepairs ?? 1;

  // The pack (facts + voice + rules) as the user turn. Threads can be long; this is one call.
  const packJson = JSON.stringify({ campaign: pack.campaign, voiceProfile: pack.voiceProfile, voiceRules: pack.voiceRules, guests: pack.guests });
  const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [
    { role: 'user', content: `Here is the copywriter pack. Draft one message per guest and call emit_drafts.\n\n${packJson}` },
  ];

  let drafts: DraftMessage[] = [];
  let lastValidation = { ok: false, errors: [] as string[], perGuest: [] as Array<{ guestId: string; errors: string[]; warnings: string[] }> };

  for (let attempt = 1; attempt <= maxRepairs + 1; attempt++) {
    const resp = await client.messages.create({
      model: COPYWRITER_MODEL,
      max_tokens: 8192,
      system: SYSTEM,
      tools: [DRAFTS_TOOL],
      tool_choice: { type: 'tool', name: 'emit_drafts' },
      messages,
    });
    const toolUse = resp.content.find((b: any) => b.type === 'tool_use') as any;
    drafts = (toolUse?.input?.drafts ?? []) as DraftMessage[];

    lastValidation = validateDrafts(validationGuests, drafts);
    const warnings = lastValidation.perGuest.flatMap((p) => p.warnings.map((w) => `${p.guestId}: ${w}`));
    logger.info('copywriter generateDrafts attempt', { attempt, drafts: drafts.length, ok: lastValidation.ok, errors: lastValidation.errors.length });

    if (lastValidation.ok) {
      return { ok: true, drafts, errors: [], warnings, attempts: attempt };
    }
    if (attempt > maxRepairs) break;

    // Bounded repair: hand back the exact per-guest errors and ask to fix only those.
    const perGuestErrs = lastValidation.perGuest.filter((p) => p.errors.length).map((p) => `- ${p.guestId}: ${p.errors.join('; ')}`).join('\n');
    const campErrs = lastValidation.errors.length ? `Campaign-level: ${lastValidation.errors.join('; ')}\n` : '';
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({
      role: 'user',
      content: `The validator rejected some drafts. Fix EXACTLY these and re-emit ALL guests via emit_drafts (a bounded repair, not a rewrite):\n${campErrs}${perGuestErrs}\n\nReminder: assert only groundedFacts keys and list them in factsUsed; no emoji; self-ID on line one; opt-out only on first contact.`,
    });
  }

  const errors = [
    ...lastValidation.errors,
    ...lastValidation.perGuest.filter((p) => p.errors.length).map((p) => `${p.guestId}: ${p.errors.join('; ')}`),
  ];
  return { ok: false, drafts, errors, warnings: [], attempts: maxRepairs + 1 };
}
