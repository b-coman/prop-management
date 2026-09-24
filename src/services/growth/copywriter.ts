/**
 * copywriter (in-app) - turns an approved campaign FRAMING (CampaignBrief) into one grounded,
 * voice-matched WhatsApp message per selected guest, by calling Claude with the deterministic
 * copywriter fact pack. This is the server-side runtime of the .claude/skills/whatsapp-copywriter
 * skill: same pack, same rules, same grounding contract - just executed in-app so the owner can
 * hit "Generate" in Admin instead of an operator running it.
 *
 * One call PER GUEST. Until Sep 2026 all guests went into one call (20 full threads, thinking off,
 * 8192 output tokens), which spread the model's attention across everyone and produced mail-merge
 * copy. Now each guest gets the model's full attention (Opus 5.5, adaptive thinking), while the shared
 * part of the pack (campaign, voice, rules) is a cached prefix so it is paid for once.
 *
 * Guardrails on truth + margin are enforced in CODE (validateDrafts: factsUsed within groundedFacts,
 * no invented discount, light emoji, self-ID, opt-out, sentiment). The LLM owns relevance,
 * presentation, and voice. A bounded repair feeds validator errors back once per guest.
 *
 * Server-only. Degrades (throws a clear error) if ANTHROPIC_API_KEY is absent.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, WHATSAPP_COPYWRITER_MODEL, WHATSAPP_COPYWRITER_EFFORT } from '@/lib/growth/anthropic';
import { buildCopywriterPack } from '@/lib/growth/copywriterPack';
import { quoteStay } from '@/lib/pricing/quote-stay';
import { parseISO } from 'date-fns';
import { validateDrafts, checkCampaignCopy, type GuestForDraftValidation } from '@/lib/growth/validateDrafts';
import type { CampaignBrief, DraftMessage } from '@/lib/growth/contracts';
import { loggers } from '@/lib/logger';

const logger = loggers.campaign;

/** Guests drafted in parallel. Keeps a 20-guest run to a few minutes without tripping rate limits. */
const CONCURRENCY = 4;

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    guestId: { type: 'string' },
    language: { type: 'string', enum: ['ro', 'en'] },
    body: { type: 'string', description: 'the full message, ready to send' },
    factsUsed: { type: 'array', items: { type: 'string' }, description: 'the groundedFacts key of every guest-specific claim made' },
    careHandled: { type: 'string', description: 'how any careFlag was handled (empty if none)' },
    continuity: { type: 'string', description: 'one line: what in this conversation the message picks up from (their last words, a plan they mentioned, a question), or "no prior conversation"' },
  },
  required: ['guestId', 'language', 'body', 'factsUsed', 'careHandled', 'continuity'],
  additionalProperties: false,
};

const SYSTEM = `You are the WhatsApp copywriter for a small Romanian mountain-chalet rental. You write one
message to one past guest at a time, in the OWNER's voice, grounded in what is genuinely true about THAT
guest, never a broadcast. You draft only — the owner reviews and sends by hand.

THE RULES
0. THIS IS A CONVERSATION, NOT A CAMPAIGN. You are the host, a person who remembers these guests.
   Before writing, read the thread and find where it left off: what did they last say? Did they
   say they would think about it, come back in July, let you know in September, travel with a dog
   or kids, ask about something? The message should read as your natural next reply to THAT, and
   only then bring the news. If the thread gives you nothing, keep it simple and warm. When the
   owner has written a master message, the news part is HIS text - keep it; what makes each
   message personal is the opening from your conversation and the details that are theirs.
1. CONTINUE THE RELATIONSHIP — do not cold-open. Each guest has a thread (verbatim history) and a
   relationship state. Read them and write the NEXT message in an ongoing conversation: pick up the
   thread, never re-introduce yourself to someone you spoke with recently, and NEVER re-announce
   something the thread shows you already told them. Follow voiceRules.continuity / selfId / updates.
2. Ground every guest-specific claim. Facts from their record come from groundedFacts (list the
   keys in factsUsed). Things from the CONVERSATION may be referred to too (what they or the owner
   said), but cite the message you are building on as "thread:<its ts>" in factsUsed, exactly as
   the ts appears in the thread. Paraphrase warmly; never paste their words back at them. Never
   invent stays, preferences, names, numbers, or updates, and never bring up a past problem.
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

You get the shared campaign pack (campaign, voiceProfile, voiceRules) and ONE guest. Return exactly
one draft for that guest, as JSON matching the output schema.`;

function toValidationGuest(g: any): GuestForDraftValidation {
  return {
    guestId: g.guestId, careFlags: g.careFlags || [], groundedFacts: g.groundedFacts || [], thread: g.thread || [],
    audienceKind: g.audienceKind, relationshipState: g.relationship?.state,
    booksDirect: (g.groundedFacts || []).some((f: any) => f.key === 'booksDirect'),
  };
}

export interface GenerateDraftsResult {
  ok: boolean;
  drafts: DraftMessage[];
  errors: string[];
  warnings: string[];
  attempts: number;
  /** Tokens across every call, for cost tracking. */
  usage: TokenUsage;
}

export interface TokenUsage { input: number; output: number; cacheRead: number; cacheWrite: number }
const addUsage = (u: TokenUsage, r: Anthropic.Beta.BetaUsage) => {
  u.input += r.input_tokens; u.output += r.output_tokens;
  u.cacheRead += r.cache_read_input_tokens ?? 0; u.cacheWrite += r.cache_creation_input_tokens ?? 0;
};

export interface ModelChoice { id: string; effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' }

interface GuestResult { draft: DraftMessage | null; errors: string[]; warnings: string[]; attempts: number; usage: TokenUsage }

/** Pull the JSON draft out of a structured-output response, or say why there is none. */
function readDraft(resp: Anthropic.Beta.BetaMessage): { draft: DraftMessage | null; problem?: string } {
  if (resp.stop_reason === 'max_tokens') return { draft: null, problem: 'the model ran out of output tokens' };
  if (resp.stop_reason === 'refusal') return { draft: null, problem: 'the model declined to write this message' };
  const text = resp.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('');
  try {
    return { draft: JSON.parse(text) as DraftMessage };
  } catch {
    return { draft: null, problem: 'the model returned unreadable output' };
  }
}

async function draftOneGuest(
  client: Anthropic,
  sharedBlock: Anthropic.Beta.BetaTextBlockParam,
  guest: any,
  rules: { offer: CampaignBrief['offer']; intent: string; masterMessage?: string },
  maxRepairs: number,
  model: ModelChoice,
): Promise<GuestResult> {
  const vGuest = toValidationGuest(guest);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: [sharedBlock, { type: 'text', text: `Write the message for this guest.\n\n${JSON.stringify(guest)}` }] },
  ];
  const usage: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let last: GuestResult = { draft: null, errors: ['not attempted'], warnings: [], attempts: 0, usage };

  for (let attempt = 1; attempt <= maxRepairs + 1; attempt++) {
    const resp = await client.beta.messages.create({
      model: model.id,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: model.effort, format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
      // Opus 5 and 5.5 can decline a request; fall back to Opus 4.8 inside the same call instead of failing.
      ...(model.id === 'claude-opus-4-8' ? {} : { betas: ['server-side-fallback-2026-06-01'], fallbacks: [{ model: 'claude-opus-4-8' }] }),
      system: SYSTEM,
      messages,
    });
    addUsage(usage, resp.usage);
    const { draft, problem } = readDraft(resp);
    if (!draft) {
      last = { draft: null, errors: [problem!], warnings: [], attempts: attempt, usage };
      break;   // nothing to repair from
    }
    draft.guestId = guest.guestId;   // the model echoes it; never trust it to route a message
    const v = validateDrafts([vGuest], [draft], rules);
    const pg = v.perGuest[0] ?? { errors: [], warnings: [] };
    last = { draft, errors: [...v.errors, ...pg.errors], warnings: pg.warnings, attempts: attempt, usage };
    if (last.errors.length === 0 || attempt > maxRepairs) break;

    // Bounded repair: append the model's turn unchanged and name exactly what to fix.
    messages.push({ role: 'assistant', content: resp.content as Anthropic.Beta.BetaContentBlockParam[] });
    messages.push({ role: 'user', content: `The validator rejected this draft. Fix exactly these and return the full draft again:\n- ${last.errors.join('\n- ')}\n\nReminder: assert only groundedFacts keys and list them in factsUsed; no discount unless the offer has one; a first/cold contact must say who is writing.` });
  }
  return last;
}

/**
 * Generate per-guest drafts for a framing. Drafts every guest (in parallel batches), validates each,
 * and gives each failing guest ONE repair. Returns ok:false with the errors if any guest still
 * fails - never silently ships an ungrounded message.
 */
export async function generateDrafts(brief: CampaignBrief, opts?: { asOf?: Date; maxRepairs?: number; model?: ModelChoice; warmCache?: boolean }): Promise<GenerateDraftsResult> {
  const client = getAnthropicClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY not configured — the in-app copywriter is unavailable');

  const pack = await buildCopywriterPack(brief, { asOf: opts?.asOf });
  const maxRepairs = opts?.maxRepairs ?? 1;
  const rules = { offer: brief.offer, intent: brief.intent, masterMessage: brief.masterMessage?.trim() || undefined };
  const model: ModelChoice = opts?.model ?? { id: WHATSAPP_COPYWRITER_MODEL, effort: WHATSAPP_COPYWRITER_EFFORT };

  // The shared pack is identical for every guest: cache it so 20 calls pay for it about once.
  const sharedBlock: Anthropic.Beta.BetaTextBlockParam = {
    type: 'text',
    text: `The shared campaign pack:\n\n${JSON.stringify({ campaign: pack.campaign, voiceProfile: pack.voiceProfile, voiceRules: pack.voiceRules })}`,
    cache_control: { type: 'ephemeral' },
  };

  const guests = pack.guests.filter((g: any) => !g.error);
  const errors: string[] = pack.guests.filter((g: any) => g.error).map((g: any) => `${g.guestId}: ${g.error}`);
  const results: Array<GuestResult & { guestId: string }> = [];
  // The first guest runs alone so it writes the shared-pack cache; the rest then read it instead of
  // all missing at once (4 parallel first calls each paid the full cache write in testing). A caller
  // that already warmed the cache in an earlier batch passes warmCache: false and runs straight away.
  const warm = opts?.warmCache ?? true;
  const first = warm ? 1 : CONCURRENCY;
  for (let i = 0; i < guests.length; i = i === 0 ? first : i + CONCURRENCY) {
    const batch = guests.slice(i, i === 0 ? first : i + CONCURRENCY);
    const done = await Promise.all(batch.map(async (g: any) => {
      try {
        return { guestId: g.guestId, ...(await draftOneGuest(client, sharedBlock, g, rules, maxRepairs, model)) };
      } catch (e) {
        logger.error('copywriter guest draft failed', e as Error, { guestId: g.guestId });
        return { guestId: g.guestId, draft: null, errors: [(e as Error).message || 'call failed'], warnings: [], attempts: 1, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
      }
    }));
    results.push(...done);
  }

  // Only drafts that passed validation. A guest whose draft still fails after the repair is reported
  // in errors and gets no draft, so a caller can keep that guest's previous message.
  const drafts = results.filter((r) => r.draft && r.errors.length === 0).map((r) => r.draft!) as DraftMessage[];
  results.filter((r) => r.errors.length).forEach((r) => errors.push(`${r.guestId}: ${r.errors.join('; ')}`));
  const warnings = results.flatMap((r) => r.warnings.map((w) => `${r.guestId}: ${w}`));
  const attempts = Math.max(0, ...results.map((r) => r.attempts));
  logger.info('copywriter generateDrafts done', { guests: guests.length, drafts: drafts.length, failed: errors.length });

  const usage: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  results.forEach((r) => { usage.input += r.usage.input; usage.output += r.usage.output; usage.cacheRead += r.usage.cacheRead; usage.cacheWrite += r.usage.cacheWrite; });
  logger.info('copywriter usage', { model: model.id, ...usage });

  return { ok: errors.length === 0 && drafts.length === pack.guests.length, drafts, errors, warnings, attempts, usage };
}

const MASTER_SYSTEM = `You write the MASTER WhatsApp message for a campaign from a small Romanian mountain-chalet
rental, in the OWNER's voice. The owner will read it, edit it until it is right, and then a copywriter
personalises it for each guest. So write the one message he would send to a typical guest on the list.

- Generic, not personal: greet with "Buna!" and no name, use informal tu, and make no guest-specific
  claim (no "when you stayed", no season of their stay, no party size). Those are added per guest.
- Carry the campaign: the occasion and why now, the exact dates, the offer as campaign.offer
  describes it, and for "gap_fill" a light, warm ask. For "share" there is no offer and no ask.
- If examplePrice is given, include it as an example ("de exemplu, 3 nopti ... pentru 4 persoane
  sunt 2.287 lei"), written with a dot for thousands. Each guest later gets the price for their
  own party size in its place. Say "cam" before it if you like: it is rounded.
- Leave out the booking channel (Booking, Airbnb, booking direct): it depends on the guest and is
  added per guest.
- campaign.generalAngle is a brief for you, not text to copy. Say it in plain, everyday words.
- Follow voiceRules (length, language, punctuation, emoji, offer) and imitate voiceProfile.exemplars.

Return JSON matching the output schema: the message, and one short line of notes for the owner on
anything you were unsure about (empty if nothing).`;

const MASTER_SCHEMA = {
  type: 'object',
  properties: {
    body: { type: 'string', description: 'the master message' },
    notes: { type: 'string', description: 'one line for the owner, or empty' },
  },
  required: ['body', 'notes'],
  additionalProperties: false,
};

export interface MasterMessageResult { ok: boolean; body: string; notes: string; errors: string[]; warnings: string[]; usage: TokenUsage }

/**
 * Draft the campaign's master message from its framing: one message the owner edits before the
 * copywriter personalises it per guest. Reads the same pack as the per-guest writer (voice, rules,
 * campaign) plus a head-count of who is on the list, and runs the same campaign-wide copy checks.
 */
export async function generateMasterMessage(brief: CampaignBrief, opts?: { model?: ModelChoice }): Promise<MasterMessageResult> {
  const client = getAnthropicClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY not configured — the in-app copywriter is unavailable');
  const model: ModelChoice = opts?.model ?? { id: WHATSAPP_COPYWRITER_MODEL, effort: WHATSAPP_COPYWRITER_EFFORT };

  const pack = await buildCopywriterPack({ ...brief, masterMessage: undefined });
  const guests = pack.guests.filter((g: any) => !g.error);
  const has = (g: any, k: string) => (g.groundedFacts || []).some((f: any) => f.key === k);
  const audience = {
    total: guests.length,
    leads: guests.filter((g: any) => g.audienceKind === 'lead').length,
    repeatGuests: guests.filter((g: any) => has(g, 'isRepeatGuest')).length,
    withChildren: guests.filter((g: any) => has(g, 'hadChildren')).length,
    activeThreads: guests.filter((g: any) => g.relationship?.state === 'active').length,
  };
  const { masterMessage: _unused, ...campaign } = pack.campaign;
  // An example price for the most common party size on the list, from the site's own quote. The
  // master is written for no one in particular, so without this it has no number to show.
  let examplePrice: { guests: number; totalLei: number; checkIn: string; checkOut: string; nights: number } | null = null;
  if (brief.stay) {
    const sizes = guests.map((g: any) => g.dossier?.partySize).filter((n: any) => Number(n) > 0).map(Number);
    const counts = new Map<number, number>(); sizes.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));
    const common = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 4;
    const q = await quoteStay({ propertyId: brief.propertyId, checkIn: parseISO(brief.stay.checkIn), checkOut: parseISO(brief.stay.checkOut), adults: common, children: 0, hasSplit: false });
    // Rounded down to 50 lei, the way the owner quotes (see priceForParty in copywriterPack).
    if (q.available) examplePrice = { guests: common, totalLei: Math.floor(Math.round(q.pricing.total) / 50) * 50, checkIn: brief.stay.checkIn, checkOut: brief.stay.checkOut, nights: q.pricing.numberOfNights };
  }
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: `Write the master message.\n\n${JSON.stringify({ campaign, audience, examplePrice, voiceProfile: pack.voiceProfile, voiceRules: pack.voiceRules })}` },
  ];
  const usage: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let result: MasterMessageResult = { ok: false, body: '', notes: '', errors: ['not attempted'], warnings: [], usage };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const resp = await client.beta.messages.create({
      model: model.id,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: model.effort, format: { type: 'json_schema', schema: MASTER_SCHEMA } },
      ...(model.id === 'claude-opus-4-8' ? {} : { betas: ['server-side-fallback-2026-06-01'], fallbacks: [{ model: 'claude-opus-4-8' }] }),
      system: MASTER_SYSTEM,
      messages,
    });
    addUsage(usage, resp.usage);
    const text = resp.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('');
    let out: { body?: string; notes?: string } = {};
    try { out = JSON.parse(text); } catch { /* handled below */ }
    if (!out.body) { result = { ...result, errors: [resp.stop_reason === 'refusal' ? 'the model declined to write this message' : 'the model returned no message'] }; break; }
    const check = checkCampaignCopy(out.body, { offer: brief.offer, intent: brief.intent });
    result = { ok: check.errors.length === 0, body: out.body, notes: out.notes ?? '', errors: check.errors, warnings: check.warnings, usage };
    if (result.ok) break;
    messages.push({ role: 'assistant', content: resp.content as Anthropic.Beta.BetaContentBlockParam[] });
    messages.push({ role: 'user', content: `Fix exactly these and return the full message again:\n- ${check.errors.join('\n- ')}` });
  }
  logger.info('copywriter master message', { ok: result.ok, errors: result.errors.length, model: model.id, ...usage });
  return result;
}
