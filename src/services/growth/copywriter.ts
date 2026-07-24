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

THE RULES
1. CONTINUE THE RELATIONSHIP — do not cold-open. Each guest has a thread (verbatim history) and a
   relationship state. Read them and write the NEXT message in an ongoing conversation: pick up the
   thread, never re-introduce yourself to someone you spoke with recently, and NEVER re-announce
   something the thread shows you already told them. Follow voiceRules.continuity / selfId / updates.
2. Ground every guest-specific claim. You may only state a fact about a guest that appears in that
   guest's groundedFacts; list the exact keys in factsUsed. Never invent stays, preferences, names,
   numbers, or updates. The thread is context for continuity and tone — not a source of new claims.
3. Write in the owner's voice (study voiceProfile.exemplars — lean toward what "booked"; copy the
   register, not the content) and in each guest's writeLanguage, WITHOUT diacritics. Obey voiceRules
   (length, emoji only sparingly to underline, register consistency, self-ID/opt-out/offer/updates
   as they apply per relationship).
4. Match the ASK to campaign.intent (voiceRules.intent). "gap_fill" carries the offer + a booking
   invite. "share" is a NO-ASK, no-offer keep-in-touch / re-introduction — just a warm hello that
   keeps the door open; never mention a discount or ask them to book.
5. Positive and careful. Every message is warm and forward-looking. Follow voiceRules.sentiment for
   any careFlag; never reference an unresolved problem.

You are trusted to make the judgment calls the rules frame — whether to self-ID, whether to raise an
update, whether to offer an opt-out, how much to reference the last exchange — from each guest's real
history. Be the thoughtful host writing to someone you know, not a mail-merge.

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
    const toolUseId = toolUse?.id as string | undefined;

    lastValidation = validateDrafts(validationGuests, drafts);
    const warnings = lastValidation.perGuest.flatMap((p) => p.warnings.map((w) => `${p.guestId}: ${w}`));
    logger.info('copywriter generateDrafts attempt', { attempt, drafts: drafts.length, ok: lastValidation.ok, errors: lastValidation.errors.length });

    if (lastValidation.ok) {
      return { ok: true, drafts, errors: [], warnings, attempts: attempt };
    }
    if (attempt > maxRepairs) break;

    // Bounded repair: hand back the exact per-guest errors and ask to fix only those. Because the
    // assistant turn contains a tool_use, the API REQUIRES the next turn to carry a matching
    // tool_result — so the error feedback rides in the tool_result block, not a plain user message.
    const perGuestErrs = lastValidation.perGuest.filter((p) => p.errors.length).map((p) => `- ${p.guestId}: ${p.errors.join('; ')}`).join('\n');
    const campErrs = lastValidation.errors.length ? `Campaign-level: ${lastValidation.errors.join('; ')}\n` : '';
    const repairText = `The validator rejected some drafts. Fix EXACTLY these and re-emit ALL guests via emit_drafts (a bounded repair, not a rewrite):\n${campErrs}${perGuestErrs}\n\nReminder: assert only groundedFacts keys and list them in factsUsed; no emoji; a first/cold contact must self-identify; give first-contact and silent guests an opt-out.`;
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({
      role: 'user',
      content: toolUseId
        ? [{ type: 'tool_result', tool_use_id: toolUseId, content: repairText }]
        : repairText,
    });
  }

  const errors = [
    ...lastValidation.errors,
    ...lastValidation.perGuest.filter((p) => p.errors.length).map((p) => `${p.guestId}: ${p.errors.join('; ')}`),
  ];
  return { ok: false, drafts, errors, warnings: [], attempts: maxRepairs + 1 };
}
