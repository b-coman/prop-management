/**
 * situationAnalyst (in-app) — the shared BRAIN's runtime (arch §7 M2). Builds the deterministic
 * situation pack, calls Claude with the analyst METHOD as its system prompt (forced tool call), and
 * returns a typed SituationReport + routed AnalystOpportunity[]. The twin of adPlanner/copywriter:
 * same shape (build pack → forced tool call → validate → bounded repair). It PROPOSES only — it never
 * sends, spends, or writes anything (persistence + hand-off to the arms are P3/P5).
 *
 * The analyst's judgement is the LLM's; the guardrails (menu, window ⊆ a real free run) are enforced
 * in CODE (validateSituationReport). Grounding (every flag cites a pack path) is checked and surfaced
 * as warnings for the calibration phase. Server-only; throws a clear error if ANTHROPIC_API_KEY absent.
 */
import { getAnthropicClient, COPYWRITER_MODEL } from '@/lib/growth/anthropic';
import { buildSituationPack, type SituationPack } from '@/lib/growth/situationPack';
import { SITUATION_ANALYST_METHOD } from '@/lib/growth/situationAnalystMethod';
import { validateSituationReport } from '@/lib/growth/validateSituationReport';
import type { AnalystOutput, AnalystOpportunity, SituationReport } from '@/lib/growth/contracts';
import { loggers } from '@/lib/logger';

const logger = loggers.campaign;

const SITUATION_TOOL = {
  name: 'emit_situation',
  description: 'Emit the Situation Report (the diagnosis) and the routed opportunities.',
  input_schema: {
    type: 'object' as const,
    properties: {
      report: {
        type: 'object',
        description: 'The diagnosis. Every number must exist in the pack (cite it in a flag evidence path).',
        properties: {
          headline: { type: 'string', description: 'One or two sentences: what is actually going on. If nothing changed, say so.' },
          flags: {
            type: 'array',
            description: 'Ranked by MONEY AT RISK (not by how precisely a thing can be measured). Empty is fine if nothing is wrong.',
            items: {
              type: 'object',
              properties: {
                severity: { type: 'string', enum: ['red', 'amber', 'yellow'] },
                what: { type: 'string', description: 'what is going on, in one line' },
                evidence: {
                  type: 'object',
                  description: 'the grounding: a pack path that resolves + the value there',
                  properties: {
                    path: { type: 'string', description: 'a resolvable pack path, e.g. inventory.recentCancellations.nightsReopened or performance.ytdComparable.rows[3].revpar' },
                    value: { type: 'string', description: 'the value found at that path, as text' },
                  },
                  required: ['path', 'value'],
                },
                whoActs: { type: 'string', enum: ['owner', 'system'] },
              },
              required: ['severity', 'what', 'evidence', 'whoActs'],
            },
          },
          normal: { type: 'array', items: { type: 'string' }, description: 'What looks alarming but is not, and why — this is what makes the rest credible.' },
          questions: { type: 'array', items: { type: 'string' }, description: 'What the data cannot explain and a human answer would change.' },
          confidence: {
            type: 'object',
            properties: {
              sure: { type: 'array', items: { type: 'string' } },
              thin: { type: 'array', items: { type: 'string' }, description: 'with the n' },
              guessing: { type: 'array', items: { type: 'string' } },
            },
            required: ['sure', 'thin', 'guessing'],
          },
          packGaps: { type: 'array', items: { type: 'string' }, description: 'facts you needed and could not get' },
        },
        required: ['headline', 'flags', 'normal', 'questions', 'confidence'],
      },
      opportunities: {
        type: 'array',
        description: 'Zero or more recommendations. Empty if nothing is worth acting on (say so in report.normal).',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['whatsapp', 'ads', 'page', 'price', 'minstay', 'los', 'ota', 'none'], description: 'the instrument from the menu' },
            window: {
              type: 'object',
              description: 'the dated window; REQUIRED for whatsapp/ads/page and MUST sit inside a real inventory.freeRuns entry; omit for price/ota/none',
              properties: {
                start: { type: 'string', description: 'YYYY-MM-DD' },
                end: { type: 'string', description: 'YYYY-MM-DD (checkout)' },
                nights: { type: 'number' },
              },
              required: ['start', 'end', 'nights'],
            },
            occasion: { type: 'string' },
            valueAtRisk: { type: 'number', description: 'money at stake, cited from the pack if known' },
            audience: { type: 'string', description: 'for campaign actions: who to reach (e.g. a segment description)' },
            rationale: { type: 'string', description: 'why THIS action, matched to the size + cause + the outreach/cancellation ledgers' },
            rejected: { type: 'string', description: 'which instruments you considered and rejected, and why' },
          },
          required: ['action', 'rationale'],
        },
      },
    },
    required: ['report', 'opportunities'],
  },
};

interface EmitSituationInput {
  report: SituationReport;
  opportunities: AnalystOpportunity[];
}

export interface RunSituationAnalysisResult {
  ok: boolean;
  report: SituationReport | null;
  opportunities: AnalystOpportunity[];
  errors: string[];
  warnings: string[];
  attempts: number;
  /** The pack the analysis ran over — returned so P3 can persist it (evidence links + "why did you say that"). */
  pack: SituationPack;
}

/**
 * Run the situation analysis for a property. Builds the pack, runs the LLM, validates, and on failure
 * feeds the validator errors back for a bounded repair before returning. `steer` is the owner's
 * challenge note (P4) folded into the prompt. Never sends/spends/writes.
 */
export async function runSituationAnalysis(
  propertyId: string,
  opts?: { asOf?: Date; steer?: string; maxRepairs?: number; pack?: SituationPack },
): Promise<RunSituationAnalysisResult> {
  const client = getAnthropicClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY not configured — the in-app situation analyst is unavailable');

  const asOf = opts?.asOf ?? new Date();
  const pack = opts?.pack ?? (await buildSituationPack(propertyId, asOf));
  const maxRepairs = opts?.maxRepairs ?? 1;

  const steer = opts?.steer?.trim();
  const steerBlock = steer
    ? `\n\nThe owner has left a note that MUST shape your analysis (a challenge/steer):\n"${steer}"\n` +
      `Take it seriously and adjust your findings/recommendations accordingly — but NEVER invent facts to satisfy it; ` +
      `if the pack contradicts it, say so plainly in the report.`
    : '';

  const packJson = JSON.stringify(pack);
  const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [
    { role: 'user', content: `Here is the situation pack. Analyse it and call emit_situation.${steerBlock}\n\n${packJson}` },
  ];

  let report: SituationReport | null = null;
  let opportunities: AnalystOpportunity[] = [];
  let lastValidation = { ok: false, errors: [] as string[], warnings: [] as string[] };

  for (let attempt = 1; attempt <= maxRepairs + 1; attempt++) {
    const resp = await client.messages.create({
      model: COPYWRITER_MODEL, // Opus 4.8 (no `thinking` param: incompatible with forced tool_choice)
      max_tokens: 8192,
      system: SITUATION_ANALYST_METHOD,
      tools: [SITUATION_TOOL],
      tool_choice: { type: 'tool', name: 'emit_situation' },
      messages: messages as never,
    });

    const toolUse = resp.content.find((b: { type: string }) => b.type === 'tool_use') as { id?: string; input?: EmitSituationInput } | undefined;
    const input = toolUse?.input;
    const toolUseId = toolUse?.id;

    report = input?.report ?? null;
    opportunities = Array.isArray(input?.opportunities) ? input!.opportunities : [];

    const out: AnalystOutput = { report: report as SituationReport, opportunities };
    const v = report
      ? validateSituationReport(pack, out)
      : { ok: false, errors: ['the model returned no report'], warnings: [] };
    lastValidation = { ok: v.ok, errors: v.errors, warnings: v.warnings };
    logger.info('situationAnalyst attempt', {
      attempt, propertyId, flags: report?.flags?.length ?? 0, opps: opportunities.length,
      ok: v.ok, errors: v.errors.length, warnings: v.warnings.length,
    });

    if (v.ok) return { ok: true, report, opportunities, errors: [], warnings: v.warnings, attempts: attempt, pack };
    if (attempt > maxRepairs) break;

    // Bounded repair: hand back the exact errors (via a tool_result, required after a tool_use).
    const repairText =
      `The output failed validation. Fix EXACTLY these and re-emit via emit_situation:\n- ${lastValidation.errors.join('\n- ')}\n\n` +
      `Reminder: opportunity.action must be on the menu; a whatsapp/ads/page opportunity MUST carry a window ` +
      `that sits inside a real inventory.freeRuns entry — never invent a free window.`;
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({
      role: 'user',
      content: toolUseId ? [{ type: 'tool_result', tool_use_id: toolUseId, content: repairText }] : repairText,
    });
  }

  return { ok: false, report, opportunities, errors: lastValidation.errors, warnings: lastValidation.warnings, attempts: maxRepairs + 1, pack };
}
