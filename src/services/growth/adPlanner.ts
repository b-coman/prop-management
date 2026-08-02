/**
 * adPlanner (in-app) — turns ONE analyst-routed ads opportunity into a reviewable ad PLAN
 * (`AdBrief`), by calling Claude with the deterministic `adPlannerPack`. The acquisition twin of
 * `copywriter.ts`: same shape (build pack → forced tool call → validate → one bounded repair), but
 * it plans a paid push (geo + budget + timing + a creative brief) instead of writing a per-guest
 * message. It PLANS — it does not write final ad copy or choose exact photos (that is the creative
 * intelligence, step 4), and it does not create or activate anything on Meta.
 *
 * Guardrails on MONEY + geo are enforced in CODE (`validateAdPlan`: budget ceiling, spend envelope,
 * cities ⊆ candidates, future end time). The LLM owns the judgement (which cities, how much, the
 * angle, and whether to act at all). It never ships an over-budget or off-geo plan.
 *
 * Server-only. Degrades (throws a clear error) if ANTHROPIC_API_KEY is absent.
 */
import { getAnthropicClient, COPYWRITER_MODEL } from '@/lib/growth/anthropic';
import { buildAdPlannerPack, type AdPlannerPack } from '@/lib/growth/adPlannerPack';
import { validateAdPlan, type AdPlannerPackForValidation } from '@/lib/growth/validateAdPlan';
import type { AdBrief, AdOpportunity } from '@/lib/growth/contracts';
import { loggers } from '@/lib/logger';

const logger = loggers.ads;

const AD_BRIEF_TOOL = {
  name: 'emit_ad_brief',
  description: 'Emit the ad plan: whether to act, the geo targeting, the budget, the end time, and the creative brief.',
  input_schema: {
    type: 'object' as const,
    properties: {
      act: { type: 'boolean', description: 'true = run this push; false = decline (weak opportunity) — then cities must be empty' },
      objective: { type: 'string', enum: ['sales'], description: "always 'sales' (2a's only verified objective)" },
      cities: {
        type: 'array',
        description: 'a SUBSET of the pack\'s targeting.candidateCities — never invent a key. Each: the exact key + name from the pack, plus a radius in km (1-80).',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'the exact candidateCities[].key from the pack' },
            name: { type: 'string' },
            radius: { type: 'number', description: 'kilometers, 1-80' },
          },
          required: ['key', 'name', 'radius'],
        },
      },
      dailyBudgetMinor: { type: 'number', description: 'bani (minor units). Must be ≤ constraints.maxDailyBudgetMinor, AND dailyBudgetMinor × runDays ≤ constraints.maxTotalSpendMinor.' },
      runDays: { type: 'number', description: 'the run length in DAYS from today (a small integer, e.g. 5-21). The code converts this to the end date — do NOT compute dates yourself. dailyBudgetMinor × runDays must stay within maxTotalSpendMinor.' },
      creativeBrief: { type: 'string', description: 'the angle + which gallery asset THEMES to favor + tone. NOT final ad copy and NOT specific chosen photos — a brief for the creative stage.' },
      rationale: { type: 'string', description: 'why this geo / budget / timing (or, if act:false, why decline).' },
    },
    required: ['act', 'objective', 'cities', 'dailyBudgetMinor', 'runDays', 'creativeBrief', 'rationale'],
  },
};

const SYSTEM = `You are the ad planner for a small Romanian mountain-chalet rental. The analyst has
routed ONE opportunity to Meta ads — paid acquisition, reaching STRANGERS (not past guests; that is
the WhatsApp arm). Your job: decide WHERE (a subset of the candidate cities + a per-city radius),
HOW MUCH (a daily budget within the envelope), HOW LONG (a bounded end date), and write a
creativeBrief (the angle + which asset themes to favor + tone). You PLAN only — you do NOT write the
final ad copy or choose exact photos (the creative stage does that), and nothing you emit spends
money until a human approves and activates it.

THE RULES
1. NARROW, NEVER WIDEN. Pick cities ONLY from the pack's targeting.candidateCities, using their exact
   keys — never invent a geo key. Keep dailyBudgetMinor ≤ constraints.maxDailyBudgetMinor, and
   dailyBudgetMinor × runDays ≤ constraints.maxTotalSpendMinor (the revenue-at-risk envelope). You
   pick runDays (a small integer, the run length in days from TODAY) — the code turns it into the end
   date, so you never do date arithmetic; just keep dailyBudgetMinor × runDays within the envelope.
2. SIZE CONSERVATIVELY. This account has NO conversion history (account.hasConversionHistory) — an
   OUTCOME_SALES campaign starts cold and early results are noisy. This is a LEARNING test, not a
   spend-the-envelope exercise: prefer a small daily budget and a bounded end date. Past CTR/CPC
   (account.lifetime) tell you the account's reach is cheap; you do not need a large budget to learn.
3. GEO + ANGLE QUALIFY THE AUDIENCE. There is no age/gender/interest control (Advantage+ Audience
   owns demographics). Choose feeder cities that fit the property and the occasion (a mountain
   weekend sells to the valley's near cities + Bucharest), and let the creativeBrief's angle do the
   rest. Favor gallery asset THEMES that match the occasion (from the pack's assets — reference
   themes/tags, do not pick exact files).
4. GROUND EVERY CHOICE in the pack (the opportunity, account performance, candidate cities, assets,
   landing). Do not assert a fact the pack does not contain.
5. OR DECLINE. If the opportunity is weak — no occasion, tiny value, or the account is blocked — set
   act:false and say why in the rationale, with cities empty. A forced ad spends real money, unlike
   a WhatsApp message; declining is a valid, valuable output.

Return your plan by calling emit_ad_brief. Nothing else.`;

export interface GenerateAdPlanResult {
  ok: boolean;
  brief: AdBrief | null;
  errors: string[];
  warnings: string[];
  attempts: number;
}

interface EmitAdBriefInput {
  act: boolean;
  objective: 'sales';
  cities: Array<{ key: string; name: string; radius: number }>;
  dailyBudgetMinor: number;
  runDays: number;
  creativeBrief: string;
  rationale: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Generate an ad plan for one ads-routed opportunity. Builds the pack, runs the LLM, validates, and
 * on failure feeds the validator errors back for ONE bounded repair before returning
 * (ok:false + errors) — never ships an over-budget or off-geo plan.
 */
export async function generateAdPlan(
  opportunity: AdOpportunity,
  opts?: { asOf?: Date; maxRepairs?: number; pack?: AdPlannerPack }
): Promise<GenerateAdPlanResult> {
  const client = getAnthropicClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY not configured — the in-app ad planner is unavailable');

  // Reuse a prebuilt pack when the caller already has one (the orchestrator builds it ONCE and feeds
  // both the planner and the copywriter) — else build it here.
  const pack = opts?.pack ?? (await buildAdPlannerPack(opportunity, { asOf: opts?.asOf }));
  const validationPack: AdPlannerPackForValidation = {
    constraints: { maxDailyBudgetMinor: pack.constraints.maxDailyBudgetMinor, maxTotalSpendMinor: pack.constraints.maxTotalSpendMinor },
    targeting: { candidateCityKeys: pack.targeting.candidateCityKeys },
  };
  const maxRepairs = opts?.maxRepairs ?? 1;

  const packJson = JSON.stringify({
    opportunity: pack.opportunity,
    constraints: pack.constraints,
    targeting: pack.targeting,
    account: pack.account,
    page: pack.page,
    assets: pack.assets,
    landing: pack.landing,
    method: pack.method,
  });
  const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [
    { role: 'user', content: `Here is the ad-planner pack. Produce ONE ad plan and call emit_ad_brief.\n\n${packJson}` },
  ];

  let brief: AdBrief | null = null;
  let lastValidation = { ok: false, errors: [] as string[], warnings: [] as string[] };

  for (let attempt = 1; attempt <= maxRepairs + 1; attempt++) {
    const resp = await client.messages.create({
      model: COPYWRITER_MODEL, // Opus 4.8 — same model as the copywriter (no `thinking` param: incompatible with forced tool_choice)
      max_tokens: 4096,
      system: SYSTEM,
      tools: [AD_BRIEF_TOOL],
      tool_choice: { type: 'tool', name: 'emit_ad_brief' },
      messages: messages as never,
    });
    const toolUse = resp.content.find((b: { type: string }) => b.type === 'tool_use') as { id?: string; input?: EmitAdBriefInput } | undefined;
    const input = toolUse?.input;
    const toolUseId = toolUse?.id;

    // The model emits runDays (a small integer it can reason about); the CODE computes endTime, so
    // the validator's days-to-endTime matches the model's budget×runDays math exactly — no LLM date
    // arithmetic (the failure mode the first live run exposed).
    brief = input
      ? {
          propertyId: pack.opportunity.propertyId,
          opportunity: pack.opportunity,
          act: input.act,
          objective: input.objective,
          targeting: { cities: (input.cities ?? []).map((c) => ({ key: c.key, name: c.name, radius: c.radius })) },
          dailyBudgetMinor: input.dailyBudgetMinor,
          endTime: new Date(Date.now() + Math.max(1, Math.round(input.runDays)) * DAY_MS).toISOString(),
          creativeBrief: input.creativeBrief,
          rationale: input.rationale,
        }
      : null;

    const v = brief
      ? validateAdPlan(validationPack, brief)
      : { ok: false, errors: ['the model returned no ad brief'], warnings: [] };
    lastValidation = { ok: v.ok, errors: v.errors, warnings: v.warnings };
    logger.info('adPlanner generateAdPlan attempt', { attempt, act: brief?.act, ok: v.ok, errors: v.errors.length });

    if (v.ok) return { ok: true, brief, errors: [], warnings: v.warnings, attempts: attempt };
    if (attempt > maxRepairs) break;

    // Bounded repair: hand back the exact errors (via a tool_result, required after a tool_use) and
    // ask to fix ONLY those and re-emit.
    const repairText =
      `The plan failed validation. Fix EXACTLY these and re-emit via emit_ad_brief:\n- ${lastValidation.errors.join('\n- ')}\n\n` +
      `Reminder: cities only from candidateCities (exact keys); dailyBudgetMinor ≤ maxDailyBudgetMinor; ` +
      `dailyBudgetMinor × runDays ≤ maxTotalSpendMinor (do the multiplication — both are integers you control).`;
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({
      role: 'user',
      content: toolUseId ? [{ type: 'tool_result', tool_use_id: toolUseId, content: repairText }] : repairText,
    });
  }

  return { ok: false, brief, errors: lastValidation.errors, warnings: lastValidation.warnings, attempts: maxRepairs + 1 };
}
